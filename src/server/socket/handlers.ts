/**
 * Socket.io 事件处理器
 */

import { Socket, Server } from 'socket.io';
import { RoomManager, Room as ServerRoom } from '../room/RoomManager';
import { Player, PendingAction, Tile, GameStatePublic, Room, PlayerPublic, toPublicPlayer } from '../../shared/types';
import { aiManager } from '../ai/AIManager';
import { getSpeechManager, removeSpeechManager, SpeechManager } from '../speech/SpeechManager';

// Socket 数据类型
interface SocketData {
  playerId: string;
  playerName: string;
  roomId?: string;
  clientType?: 'human' | 'ai';  // 玩家类型
  agentId?: string;              // AI Agent ID
}

// 事件载荷类型
interface CreateRoomPayload {
  playerName: string;
}

interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

interface DiscardPayload {
  tileId: string;
}

interface ActionPayload {
  action: 'chi' | 'peng' | 'gang' | 'hu';
  tiles?: Tile[];
}

// 响应类型
interface ErrorResponse {
  message: string;
}

/**
 * 将服务端 Room 转换为客户端 Room（可序列化）
 */
function toClientRoom(serverRoom: ServerRoom): Room {
  return {
    id: serverRoom.id,
    name: serverRoom.name,
    host: serverRoom.host,
    players: serverRoom.players.map(toPublicPlayer),
    spectators: serverRoom.spectators.map(toPublicPlayer),
    state: serverRoom.state,
    createdAt: serverRoom.createdAt.getTime(),
    settings: serverRoom.settings,
  };
}

/**
 * 广播游戏状态给房间内所有玩家（人类 + AI）
 */
export function broadcastGameState(io: Server, roomId: string, roomManager: RoomManager): void {
  const room = roomManager.getRoom(roomId);
  if (!room?.gameEngine) return;

  // 获取发言管理器
  let speechManager: SpeechManager | null = null;
  try {
    speechManager = getSpeechManager(io, roomId);
  } catch (e) {
    // 发言系统可能未初始化
  }

  // 找到当前回合玩家，开始等待计时
  const currentPlayerIndex = room.gameEngine.getState().currentPlayerIndex;
  const currentPlayer = room.players[currentPlayerIndex];
  if (currentPlayer && speechManager) {
    speechManager.startWaitingTimer(currentPlayer.id, currentPlayer.name);
  }

  // 遍历所有玩家
  for (const player of room.players) {
    const publicState = room.gameEngine.getPublicState(player.id);
    const yourTurn = room.gameEngine.isPlayerTurn(player.id);
    const lastDrawnTile = room.gameEngine.getLastDrawnTile(player.id);
    const turnPhase = room.gameEngine.getTurnPhase();

    console.log(`[broadcastGameState] player=${player.name}(${player.id.slice(0,4)}), type=${player.type}, yourTurn=${yourTurn}, turnPhase=${turnPhase}`);

    if (player.type === 'human') {
      // 人类玩家：通过 Socket 发送
      const socket = Array.from(io.sockets.sockets.values())
        .find(s => s.data.playerId === player.id);
      
      if (socket) {
        socket.emit('game:state', {
          state: publicState,
          yourHand: player.hand,
          yourTurn,
          lastDrawnTile,
          turnPhase,
        });
      }
    } else if (player.type === 'ai-agent') {
      // AI Agent 玩家：检查是否有连接的 socket
      const agentSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.data.playerId === player.id && s.data.clientType === 'ai-agent');
      
      console.log(`[broadcastGameState] 查找 Agent socket: playerId=${player.id}, 找到=${!!agentSocket}, yourTurn=${yourTurn}`);
      
      if (agentSocket && yourTurn) {
        // Agent 已连接：发送自然语言 Prompt
        console.log(`[broadcastGameState] 发送 agent:your_turn 给 ${player.name}, phase=${turnPhase}`);
        
        // 导入 Prompt 生成器
        const { generateYourTurnPrompt } = require('../prompt/PromptNL');
        
        // 生成自然语言 Prompt（包含情绪上下文）
        let prompt = generateYourTurnPrompt({
          phase: turnPhase,
          hand: player.hand,
          lastDrawnTile,
          gameState: publicState,
        });
        
        // 添加情绪上下文
        if (speechManager) {
          const emotionPrompt = speechManager.generateEmotionPrompt(player.id, player.name);
          prompt = emotionPrompt + '\n' + prompt;
        }
        
        agentSocket.emit('agent:your_turn', {
          prompt,  // 自然语言文本
          // 同时保留结构化数据供脚本使用
          phase: turnPhase,
          hand: player.hand,
          lastDrawnTile,
        });
        
        // 添加超时机制：如果 AI 5秒内没有响应，自动托管
        const timeoutKey = `ai_timeout_${player.id}`;
        if (global[timeoutKey]) clearTimeout(global[timeoutKey]);
        
        global[timeoutKey] = setTimeout(() => {
          // 检查是否还在等待这个玩家
          const currentRoom = roomManager.getRoom(roomId);
          if (!currentRoom || !currentRoom.gameEngine) return;
          
          const isStillWaiting = currentRoom.gameEngine.isPlayerTurn(player.id);
          const currentPhase = currentRoom.gameEngine.getTurnPhase();
          
          if (isStillWaiting && currentPhase === turnPhase) {
            console.log(`[AI Timeout] ${player.name} 超时，自动托管处理`);
            
            // 执行自动决策
            const adapter = aiManager.getAdapter(player.id);
            if (adapter) {
              adapter.handleEvent({
                type: turnPhase === 'draw' ? 'YOUR_TURN_DRAW' : 'YOUR_TURN_DISCARD',
                lastDrawnTile,
                gameState: publicState,
              }).then(decision => {
                if (decision) {
                  executeAIDecision(roomId, player.id, decision, roomManager, io);
                }
              }).catch(err => {
                console.error(`[AI Timeout] 自动决策失败:`, err);
                // 强制摸牌或打牌
                if (turnPhase === 'draw') {
                  const gameEngine = currentRoom.gameEngine;
                  gameEngine.drawTile(player.id);
                  broadcastGameState(io, roomId, roomManager);
                } else if (turnPhase === 'discard' && player.hand.length > 0) {
                  const tile = player.hand[player.hand.length - 1];
                  currentRoom.gameEngine.discardTile(player.id, tile.id);
                  broadcastGameState(io, roomId, roomManager);
                }
              });
            } else {
              // 没有 adapter，强制执行
              console.log(`[AI Timeout] ${player.name} 无 adapter，强制执行`);
              if (turnPhase === 'draw') {
                currentRoom.gameEngine.drawTile(player.id);
                broadcastGameState(io, roomId, roomManager);
              } else if (turnPhase === 'discard' && player.hand.length > 0) {
                const tile = player.hand[player.hand.length - 1];
                currentRoom.gameEngine.discardTile(player.id, tile.id);
                broadcastGameState(io, roomId, roomManager);
              }
            }
          }
        }, 5000); // 5秒超时
      } else if (player.aiControl?.mode === 'auto' || !agentSocket) {
        // Agent 断线或降级为自动托管：使用 AIAdapter
        const adapter = aiManager.getAdapter(player.id);
        if (adapter && yourTurn) {
          adapter.handleEvent({
            type: turnPhase === 'draw' ? 'YOUR_TURN_DRAW' : 'YOUR_TURN_DISCARD',
            lastDrawnTile,
            gameState: publicState,
          }).then(decision => {
            if (decision) {
              executeAIDecision(roomId, player.id, decision, roomManager, io);
            }
          }).catch(err => {
            console.error(`[AIAdapter] 决策失败:`, err);
          });
        }
      }
    } else if (player.type === 'ai-auto') {
      // 自动托管玩家：使用 AIAdapter
      const adapter = aiManager.getAdapter(player.id);
      if (adapter && yourTurn) {
        adapter.handleEvent({
          type: turnPhase === 'draw' ? 'YOUR_TURN_DRAW' : 'YOUR_TURN_DISCARD',
          lastDrawnTile,
          gameState: publicState,
        }).then(decision => {
          if (decision) {
            executeAIDecision(roomId, player.id, decision, roomManager, io);
          }
        }).catch(err => {
          console.error(`[AIAdapter] 决策失败:`, err);
        });
      }
    }
  }
}

/**
 * 执行 AI 决策
 */
function executeAIDecision(
  roomId: string,
  playerId: string,
  decision: { action: string; tileId?: string; tiles?: string[] },
  roomManager: RoomManager,
  io: Server
): void {
  const room = roomManager.getRoom(roomId);
  if (!room?.gameEngine) return;

  console.log(`[AI] 玩家 ${playerId.slice(0,4)} 执行决策: ${decision.action}`);

  switch (decision.action) {
    case 'draw':
      const tile = room.gameEngine.drawTile(playerId);
      if (tile) {
        broadcastGameState(io, roomId, roomManager);
      }
      break;
      
    case 'discard':
      if (decision.tileId) {
        room.gameEngine.discardTile(playerId, decision.tileId);
        broadcastGameState(io, roomId, roomManager);
        
        // 检查是否有 pendingActions
        const state = room.gameEngine.getState();
        if (state.pendingActions.length > 0) {
          handleAIActions(roomId, roomManager, io);
        }
      }
      break;
      
    case 'chi':
    case 'peng':
    case 'gang':
    case 'hu':
      const pendingAction: PendingAction = {
        playerId,
        action: decision.action as 'chi' | 'peng' | 'gang' | 'hu',
        tiles: decision.tiles?.map(id => ({ id } as Tile)),
        priority: decision.action === 'hu' ? 4 : decision.action === 'gang' ? 3 : decision.action === 'peng' ? 2 : 1,
      };
      room.gameEngine.performAction(playerId, pendingAction);
      broadcastGameState(io, roomId, roomManager);
      break;
      
    case 'pass':
      room.gameEngine.passAction(playerId);
      broadcastGameState(io, roomId, roomManager);
      break;
  }
}

/**
 * 处理 AI 玩家的 pendingActions
 */
function handleAIActions(roomId: string, roomManager: RoomManager, io: Server): void {
  const room = roomManager.getRoom(roomId);
  if (!room?.gameEngine) return;

  const state = room.gameEngine.getState();
  const publicState = room.gameEngine.getPublicState();
  
  // 按玩家分组
  const playerActionsMap = new Map<string, typeof state.pendingActions>();
  for (const action of state.pendingActions) {
    const existing = playerActionsMap.get(action.playerId) || [];
    existing.push(action);
    playerActionsMap.set(action.playerId, existing);
  }

  // 对每个 AI 玩家处理
  for (const [playerId, actions] of playerActionsMap) {
    const player = room.players.find(p => p.id === playerId);
    if (player?.type === 'ai-agent') {
      const adapter = aiManager.getAdapter(playerId);
      if (adapter) {
        adapter.handleEvent({
          type: 'ACTION_REQUIRED',
          availableActions: actions,
          lastDiscard: state.lastDiscard!,
          gameState: publicState,
        }).then(decision => {
          if (decision) {
            executeAIDecision(roomId, playerId, decision, roomManager, io);
          }
        }).catch(err => {
          console.error(`[AIAdapter] 操作决策失败:`, err);
        });
      }
    }
  }
}

// ==================== 房间事件 ====================

export async function handleCreateRoom(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: CreateRoomPayload,
  callback: (response: { roomId: string; room: Room } | ErrorResponse) => void
) {
  try {
    const playerId = socket.id;
    const playerName = payload.playerName || `玩家${playerId.slice(0, 4)}`;
    
    socket.data.playerId = playerId;
    socket.data.playerName = playerName;
    
    const serverRoom = roomManager.createRoom(playerId, playerName);
    socket.data.roomId = serverRoom.id;
    socket.join(serverRoom.id);
    
    callback({ roomId: serverRoom.id, room: toClientRoom(serverRoom) });
  } catch (error) {
    callback({ message: error instanceof Error ? error.message : '创建房间失败' });
  }
}

/**
 * AI Agent 创建房间（以 AI 身份）
 */
export async function handleCreateRoomAI(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    agentId: string;
    agentName: string;
    type?: 'ai-agent' | 'ai-auto';
    personality?: 'aggressive' | 'cautious' | 'balanced';
  },
  callback: (response: { roomId: string; room: Room; playerId: string; position: number } | ErrorResponse) => void
) {
  try {
    const { agentId, agentName, type, personality } = payload;
    const playerType = type || 'ai-agent';
    
    console.log(`[Server] AI ${playerType} ${agentName}(${agentId}) 创建房间`);
    
    // 设置 socket 数据
    socket.data.clientType = playerType;
    socket.data.agentId = agentId;
    socket.data.playerId = agentId;
    socket.data.playerName = agentName;
    
    // 创建房间（用 agentId 作为房主）
    const serverRoom = roomManager.createRoom(agentId, agentName);
    socket.data.roomId = serverRoom.id;
    socket.join(serverRoom.id);
    
    // 修改房主为 AI 类型
    const hostPlayer = serverRoom.players.find(p => p.id === agentId);
    if (hostPlayer) {
      hostPlayer.type = playerType;
      hostPlayer.agentId = agentId;
      hostPlayer.aiConfig = {
        personality: personality || 'balanced',
        llmEnabled: false,
        timeout: 5000,
        thinkTimeMin: 1000,
        thinkTimeMax: 3000,
        maxRetries: 3,
      };
      hostPlayer.aiControl = { mode: playerType === 'ai-auto' ? 'auto' : 'agent' };
    }
    
    // 创建 AIAdapter
    if (playerType === 'ai-agent' && hostPlayer) {
      aiManager.createAdapter(hostPlayer);
    }
    
    console.log(`[Server] AI ${playerType} ${agentName} 创建房间成功: ${serverRoom.id}`);
    
    // 广播房间更新（虽然只有一个人，但保持一致性）
    const clientRoom = toClientRoom(serverRoom);
    io.in(serverRoom.id).emit('room:updated', { room: clientRoom });
    
    if (callback) callback({ 
      roomId: serverRoom.id, 
      room: clientRoom,
      playerId: agentId,
      position: 0
    });
  } catch (error) {
    console.error(`[Server] AI 创建房间失败:`, error);
    if (callback) callback({ message: error instanceof Error ? error.message : '创建房间失败' });
  }
}

export async function handleJoinRoom(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: JoinRoomPayload,
  callback: (response: { roomId: string; room: Room; playerPosition: number } | ErrorResponse) => void
) {
  try {
    const playerId = socket.id;
    const playerName = payload.playerName || `玩家${playerId.slice(0, 4)}`;
    
    console.log(`[Server] 玩家 ${playerName}(${playerId}) 加入房间 ${payload.roomId}`);
    
    // 如果当前socket已经在其他房间，先离开
    const oldRoomId = socket.data.roomId;
    if (oldRoomId) {
      console.log(`[Server] 清理旧房间状态: ${oldRoomId}`);
      socket.leave(oldRoomId);
      try {
        roomManager.leaveRoom(oldRoomId, socket.data.playerId || playerId);
      } catch (e) {
        // 忽略错误
      }
    }
    
    socket.data.playerId = playerId;
    socket.data.playerName = playerName;
    
    roomManager.joinRoom(payload.roomId, playerId, playerName);
    const serverRoom = roomManager.getRoom(payload.roomId);
    
    if (!serverRoom) throw new Error('房间不存在');
    
    socket.data.roomId = serverRoom.id;
    socket.join(serverRoom.id);
    
    const player = serverRoom.players.find(p => p.id === playerId);
    const clientRoom = toClientRoom(serverRoom);
    
    console.log(`[Server] 房间 ${serverRoom.id} 玩家数: ${clientRoom.players.length}`);
    console.log(`[Server] 广播 room:updated 给房间 ${serverRoom.id}`);
    
    // 广播给房间所有人（包括新加入的）
    io.in(serverRoom.id).emit('room:updated', { room: clientRoom });
    
    callback({ roomId: serverRoom.id, room: clientRoom, playerPosition: player?.position ?? 0 });
  } catch (error) {
    console.error(`[Server] 加入房间失败:`, error);
    callback({ message: error instanceof Error ? error.message : '加入房间失败' });
  }
}

export async function handleLeaveRoom(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  callback: (response: { success: boolean } | ErrorResponse) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    roomManager.leaveRoom(roomId, playerId);
    socket.leave(roomId);
    socket.data.roomId = undefined;
    
    const serverRoom = roomManager.getRoom(roomId);
    if (serverRoom && serverRoom.players.length > 0) {
      io.to(roomId).emit('room:updated', { room: toClientRoom(serverRoom) });
    }
    
    roomManager.removeEmptyRooms();
    callback({ success: true });
  } catch (error) {
    callback({ message: error instanceof Error ? error.message : '离开房间失败' });
  }
}

export async function handleRoomList(
  roomManager: RoomManager,
  callback: (response: { rooms: Room[] }) => void
) {
  const serverRooms = roomManager.getRooms().filter(r => r.state === 'waiting');
  const rooms = serverRooms.map(toClientRoom);
  callback({ rooms });
}

export async function handleReady(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: { ready: boolean },
  callback: (response: { success: boolean; room?: Room } | ErrorResponse) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    console.log(`[Server] handleReady: 玩家 ${playerId} 设置准备=${payload.ready}`);
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    roomManager.setPlayerReady(roomId, playerId, payload.ready);
    
    const serverRoom = roomManager.getRoom(roomId);
    if (serverRoom) {
      const clientRoom = toClientRoom(serverRoom);
      console.log(`[Server] 广播 room:updated, 玩家数=${clientRoom.players.length}, 全部准备=${clientRoom.players.every(p => p.isReady)}`);
      // 广播给房间所有人
      io.in(roomId).emit('room:updated', { room: clientRoom });
      callback({ success: true, room: clientRoom });
    } else {
      callback({ success: true });
    }
  } catch (error) {
    console.error(`[Server] handleReady 错误:`, error);
    if (callback) callback({ message: error instanceof Error ? error.message : '设置准备状态失败' });
  }
}

// ==================== 游戏事件 ====================

export async function handleGameStart(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  callback: (response: { success: boolean } | ErrorResponse) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    console.log(`[Server] handleGameStart: 玩家 ${playerId} 尝试开始游戏`);
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    const room = roomManager.getRoom(roomId);
    if (!room) throw new Error('房间不存在');
    
    if (room.host !== playerId) throw new Error('只有房主可以开始游戏');
    
    console.log(`[Server] 开始游戏，房间 ${roomId}`);
    roomManager.startGame(roomId);
    
    // 获取更新后的房间
    const gameRoom = roomManager.getRoom(roomId);
    
    // 初始化 AIAdapter（关键修复：确保所有 AI 都有 adapter）
    if (gameRoom) {
      aiManager.initGame(gameRoom.players);
      console.log(`[Server] AIAdapter 已初始化，玩家数: ${gameRoom.players.length}`);
    }
    
    // 初始化发言系统
    const speechManager = getSpeechManager(io, roomId);
    gameRoom?.players.forEach(p => {
      speechManager.initPlayerEmotion(p.id, p.name);
    });
    
    // 广播给房间所有人（包括房主）
    io.in(roomId).emit('game:started');
    broadcastGameState(io, roomId, roomManager);
    
    if (callback) callback({ success: true });
  } catch (error) {
    console.error(`[Server] handleGameStart 错误:`, error);
    if (callback) callback({ message: error instanceof Error ? error.message : '开始游戏失败' });
  }
}

export async function handleDraw(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  callback?: (response: { tile?: Tile; error?: string }) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    const room = roomManager.getRoom(roomId);
    if (!room?.gameEngine) throw new Error('游戏未开始');
    
    const tile = room.gameEngine.drawTile(playerId);
    if (!tile) throw new Error('无法摸牌');
    
    socket.emit('game:draw', { tile });
    broadcastGameState(io, roomId, roomManager);
    
    const actions = room.gameEngine.getAvailableActions(playerId);
    if (actions.length > 0) {
      socket.emit('game:actions', { actions });
    }
    
    if (callback) callback({ tile });
  } catch (error) {
    if (callback) callback({ error: error instanceof Error ? error.message : '摸牌失败' });
  }
}

export async function handleDiscard(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: DiscardPayload,
  callback?: (response: { success: boolean } | ErrorResponse) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    const room = roomManager.getRoom(roomId);
    if (!room?.gameEngine) throw new Error('游戏未开始');
    
    const success = room.gameEngine.discardTile(playerId, payload.tileId);
    if (!success) throw new Error('无法出牌');
    
    broadcastGameState(io, roomId, roomManager);
    
    // 向有操作权的玩家发送可用操作
    const gameState = room.gameEngine.getState();
    if (gameState.pendingActions.length > 0) {
      // 收集每个玩家的所有操作，避免重复发送
      const playerActionsMap = new Map<string, typeof gameState.pendingActions>();
      for (const action of gameState.pendingActions) {
        const existing = playerActionsMap.get(action.playerId) || [];
        existing.push(action);
        playerActionsMap.set(action.playerId, existing);
      }
      
      // 对每个玩家只发送一次
      for (const [playerId, actions] of playerActionsMap) {
        const targetSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.data.playerId === playerId);
        if (targetSocket) {
          targetSocket.emit('game:actions', { actions });
        }
      }
    }
    
    if (callback) callback({ success: true });
  } catch (error) {
    if (callback) callback({ message: error instanceof Error ? error.message : '出牌失败' });
  }
}

export async function handleAction(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: ActionPayload,
  callback?: (response: { success: boolean } | ErrorResponse) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    const room = roomManager.getRoom(roomId);
    if (!room?.gameEngine) throw new Error('游戏未开始');
    
    const pendingAction: PendingAction = {
      playerId,
      action: payload.action,
      tiles: payload.tiles,
      priority: payload.action === 'hu' ? 4 : payload.action === 'gang' ? 3 : payload.action === 'peng' ? 2 : 1,
    };
    
    const success = room.gameEngine.performAction(playerId, pendingAction);
    if (!success) throw new Error('无法执行操作');
    
    // 检查游戏是否结束
    const gameState = room.gameEngine.getState();
    console.log(`[Server] handleAction: phase=${gameState.phase}, winner=${gameState.winner}, currentPlayer=${gameState.currentPlayerIndex}`);
    
    if (gameState.phase === 'finished' && gameState.winner !== null) {
      // 游戏结束时广播最终状态，清除所有玩家的 pendingActions
      broadcastGameState(io, roomId, roomManager);
      
      // 处理分数变化和情绪更新
      try {
        const speechManager = getSpeechManager(io, roomId);
        const scoreChanges = room.players.map((p, idx) => ({
          playerId: p.id,
          playerName: p.name,
          scoreChange: (p.score || 0) - (p.lastScore || 0),
        }));
        speechManager.handleScoreChanges(scoreChanges);
        
        // 更新 lastScore
        room.players.forEach(p => {
          p.lastScore = p.score || 0;
        });
        
        // 情绪衰减（为下一局做准备）
        speechManager.decayEmotions();
        
      } catch (e) {
        console.log(`[Score] 分数情绪处理失败:`, e);
      }
      
      console.log(`[Server] 发送 game:ended, winner=${gameState.winner}`);
      io.to(roomId).emit('game:ended', {
        winner: gameState.winner,
        winningHand: gameState.winningHand,
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          score: p.score || 0,
        })),
      });
    } else {
      console.log(`[Server] handleAction: 广播游戏状态给房间 ${roomId}`);
      broadcastGameState(io, roomId, roomManager);
    }
    
    if (callback) callback({ success: true });
  } catch (error) {
    if (callback) callback({ message: error instanceof Error ? error.message : '操作失败' });
  }
}

export async function handlePass(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  callback?: (response: { success: boolean } | ErrorResponse) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    const room = roomManager.getRoom(roomId);
    if (!room?.gameEngine) throw new Error('游戏未开始');
    
    room.gameEngine.passAction(playerId);
    broadcastGameState(io, roomId, roomManager);
    
    if (callback) callback({ success: true });
  } catch (error) {
    if (callback) callback({ message: error instanceof Error ? error.message : '过牌失败' });
  }
}

export async function handleDisconnect(
  io: Server,
  socket: Socket,
  roomManager: RoomManager
) {
  console.log(`玩家断开连接: ${socket.id}`);
  
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;
  const clientType = socket.data.clientType;
  
  if (roomId && playerId) {
    // AI Agent 断线：降级为自动托管，不移除玩家
    if (clientType === 'ai-agent') {
      console.log(`[断线] AI Agent ${playerId} 断线，降级为自动托管`);
      
      const room = roomManager.getRoom(roomId);
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          // 降级为自动托管模式
          player.type = 'ai-auto';
          player.aiControl = { mode: 'auto' };
          
          // 通知其他玩家
          io.to(roomId).emit('player:status', {
            playerId,
            status: 'disconnected',
            message: `${player.name} 已断线，系统自动托管`
          });
          
          // 如果当前是断线玩家的回合，触发 AI 自动决策
          if (room.gameEngine?.isPlayerTurn(playerId)) {
            console.log(`[断线] 触发自动托管决策`);
            broadcastGameState(io, roomId, roomManager);
          }
          
          return;
        }
      }
    }
    
    // 人类玩家或普通 AI：正常离开房间
    roomManager.leaveRoom(roomId, playerId);
    
    const serverRoom = roomManager.getRoom(roomId);
    if (serverRoom && serverRoom.players.length > 0) {
      io.to(roomId).emit('room:updated', { room: toClientRoom(serverRoom) });
    }
    
    roomManager.removeEmptyRooms();
  }
}

// ==================== AI 玩家事件 ====================

/**
 * AI 玩家加入房间
 */
export async function handleJoinAI(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    roomId: string;
    agentId: string;
    agentName: string;
    personality?: 'aggressive' | 'cautious' | 'balanced';
    type?: 'ai-agent' | 'ai-auto';
  },
  callback: (response: { success: boolean; playerId?: string; position?: number; error?: string }) => void
) {
  try {
    const { roomId, agentId, agentName, personality, type } = payload;
    const playerType = type || 'ai-agent';
    
    console.log(`[Server] AI ${playerType} ${agentName}(${agentId}) 尝试加入房间 ${roomId}`);
    
    // 标记为 AI 玩家
    socket.data.clientType = playerType;
    socket.data.agentId = agentId;
    socket.data.playerId = agentId;
    socket.data.playerName = agentName;
    
    // 添加 AI 玩家到房间
    const aiPlayer = roomManager.addAIPlayer(roomId, {
      agentId,
      name: agentName,
      personality,
      type: playerType,
    });
    
    socket.data.roomId = roomId;
    socket.join(roomId);
    
    // 只有 ai-agent 需要创建 AIAdapter
    // ai-auto 由服务器内部托管
    if (playerType === 'ai-agent') {
      aiManager.createAdapter(aiPlayer);
    }
    
    // 广播房间更新
    const serverRoom = roomManager.getRoom(roomId);
    if (serverRoom) {
      io.in(roomId).emit('room:updated', { room: toClientRoom(serverRoom) });
    }
    
    console.log(`[Server] AI ${playerType} ${agentName} 加入房间成功，位置: ${aiPlayer.position}`);
    
    if (callback) callback({ 
      success: true, 
      playerId: aiPlayer.id, 
      position: aiPlayer.position 
    });
  } catch (error) {
    console.error(`[Server] AI 加入房间失败:`, error);
    if (callback) callback({ 
      success: false, 
      error: error instanceof Error ? error.message : '加入失败' 
    });
  }
}

/**
 * AI 玩家发送决策
 */
export async function handleAIDecision(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    action: 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
    tileId?: string;
    tiles?: string[];
  },
  callback?: (response: { success: boolean; error?: string }) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) throw new Error('未加入房间');
    
    const room = roomManager.getRoom(roomId);
    if (!room?.gameEngine) throw new Error('游戏未开始');
    
    console.log(`[Server] AI ${playerId} 发送决策: ${payload.action}`);
    
    switch (payload.action) {
      case 'draw':
        const tile = room.gameEngine.drawTile(playerId);
        if (tile) {
          broadcastGameState(io, roomId, roomManager);
        }
        break;
        
      case 'discard':
        if (payload.tileId) {
          room.gameEngine.discardTile(playerId, payload.tileId);
          broadcastGameState(io, roomId, roomManager);
          
          // 检查是否有 pendingActions
          const state = room.gameEngine.getState();
          if (state.pendingActions.length > 0) {
            handleAIActions(roomId, roomManager, io);
          }
        }
        break;
        
      case 'chi':
      case 'peng':
      case 'gang':
      case 'hu':
        const pendingAction: PendingAction = {
          playerId,
          action: payload.action,
          tiles: payload.tiles?.map(id => ({ id } as Tile)),
          priority: payload.action === 'hu' ? 4 : payload.action === 'gang' ? 3 : payload.action === 'peng' ? 2 : 1,
        };
        room.gameEngine.performAction(playerId, pendingAction);
        broadcastGameState(io, roomId, roomManager);
        break;
        
      case 'pass':
        room.gameEngine.passAction(playerId);
        broadcastGameState(io, roomId, roomManager);
        break;
    }
    
    if (callback) callback({ success: true });
  } catch (error) {
    console.error(`[Server] AI 决策失败:`, error);
    if (callback) callback({ success: false, error: error instanceof Error ? error.message : '决策失败' });
  }
}

// ==================== AI Agent 指令处理 ====================

/**
 * 处理 AI Agent 发来的指令
 */
export async function handleAgentCommand(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: any,
  callback?: (response: { success: boolean; error?: string }) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    
    if (!roomId || !playerId) {
      throw new Error('未加入房间');
    }
    
    const room = roomManager.getRoom(roomId);
    if (!room?.gameEngine) {
      throw new Error('游戏未开始');
    }
    
    // 导入指令解析器
    const { commandParser } = await import('../prompt/CommandParser');
    
    // 解析指令
    const command = commandParser.parseObject(payload);
    if (!command) {
      // 无法识别的指令，返回错误
      callback?.({ success: false, error: 'unknown_command' });
      return;
    }
    
    console.log(`[Server] Agent ${playerId} 发送指令: ${command.cmd}`);
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('玩家不存在');
    }
    
    switch (command.cmd) {
      case 'chat':
        // 处理聊天
        if (command.message) {
          io.to(roomId).emit('chat:message', {
            playerId,
            playerName: player.name,
            message: command.message,
            timestamp: Date.now(),
          });
        }
        break;
        
      case 'draw':
        // 摸牌
        const tile = room.gameEngine.drawTile(playerId);
        if (tile) {
          broadcastGameState(io, roomId, roomManager);
        }
        break;
        
      case 'discard':
        // 打牌
        if (command.tileId) {
          room.gameEngine.discardTile(playerId, command.tileId);
          broadcastGameState(io, roomId, roomManager);
          
          // 检查是否有 pendingActions
          const state = room.gameEngine.getState();
          if (state.pendingActions.length > 0) {
            handleAIActions(roomId, roomManager, io);
          }
        }
        break;
        
      case 'action':
        // 吃碰杠胡
        if (command.action) {
          const pendingAction: PendingAction = {
            playerId,
            action: command.action,
            tiles: command.tiles?.map((id: string) => ({ id } as Tile)),
            priority: command.action === 'hu' ? 4 : command.action === 'gang' ? 3 : command.action === 'peng' ? 2 : 1,
          };
          room.gameEngine.performAction(playerId, pendingAction);
          broadcastGameState(io, roomId, roomManager);
        }
        break;
        
      case 'pass':
        // 跳过
        room.gameEngine.passAction(playerId);
        broadcastGameState(io, roomId, roomManager);
        break;
        
      case 'ready':
        // 准备/取消准备
        roomManager.setPlayerReady(roomId, playerId, command.ready ?? true);
        const updatedRoom = roomManager.getRoom(roomId);
        if (updatedRoom) {
          io.in(roomId).emit('room:updated', { room: toClientRoom(updatedRoom) });
        }
        break;
        
      case 'add_auto_player':
        // 添加自动托管玩家
        const autoPlayer = roomManager.addAIPlayer(roomId, { type: 'ai-auto' });
        io.in(roomId).emit('room:updated', { room: toClientRoom(roomManager.getRoom(roomId)!) });
        console.log(`[Server] 添加自动托管玩家: ${autoPlayer.name}`);
        break;
        
      default:
        callback?.({ success: false, error: 'unknown_command' });
        return;
    }
    
    callback?.({ success: true });
  } catch (error) {
    console.error(`[Server] Agent 指令处理失败:`, error);
    callback?.({ success: false, error: error instanceof Error ? error.message : '指令处理失败' });
  }
}

/**
 * AI Agent 重连
 * 让断线的 AI Agent 重新接管游戏
 */
export async function handleReconnectAI(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    roomId: string;
    agentId: string;
  },
  callback: (response: { success: boolean; playerId?: string; gameState?: any; error?: string }) => void
) {
  try {
    const { roomId, agentId } = payload;
    
    console.log(`[重连] AI Agent ${agentId} 尝试重连房间 ${roomId}`);
    
    const room = roomManager.getRoom(roomId);
    if (!room) {
      callback?.({ success: false, error: '房间不存在' });
      return;
    }
    
    // 查找玩家
    const player = room.players.find(p => p.id === agentId);
    if (!player) {
      callback?.({ success: false, error: '玩家不存在' });
      return;
    }
    
    // 恢复为 ai-agent 类型
    player.type = 'ai-agent';
    player.aiControl = { mode: 'agent' };
    
    // 更新 socket 数据
    socket.data.clientType = 'ai-agent';
    socket.data.agentId = agentId;
    socket.data.playerId = agentId;
    socket.data.playerName = player.name;
    socket.data.roomId = roomId;
    socket.join(roomId);
    
    // 通知其他玩家
    io.to(roomId).emit('player:status', {
      playerId: agentId,
      status: 'reconnected',
      message: `${player.name} 已重连`
    });
    
    // 返回当前游戏状态
    const gameState = room.gameEngine?.getPublicState(agentId);
    const yourTurn = room.gameEngine?.isPlayerTurn(agentId);
    
    callback?.({
      success: true,
      playerId: agentId,
      gameState: {
        state: gameState,
        yourHand: player.hand,
        yourTurn,
      }
    });
    
    // 如果是当前玩家的回合，发送 Prompt
    if (yourTurn && room.gameEngine) {
      const turnPhase = room.gameEngine.getTurnPhase();
      const lastDrawnTile = room.gameEngine.getLastDrawnTile(agentId);
      
      const { generateYourTurnPrompt } = require('../prompt/PromptNL');
      const prompt = generateYourTurnPrompt({
        phase: turnPhase,
        hand: player.hand,
        lastDrawnTile,
        gameState,
      });
      
      socket.emit('agent:your_turn', {
        prompt,
        phase: turnPhase,
        hand: player.hand,
        lastDrawnTile,
      });
    }
    
    console.log(`[重连] AI Agent ${agentId} 重连成功`);
    
  } catch (error) {
    console.error(`[重连] 失败:`, error);
    callback?.({ success: false, error: error instanceof Error ? error.message : '重连失败' });
  }
}

/**
 * 获取 AI Agent 可重连的房间列表
 */
export async function handleGetReconnectableRooms(
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    agentId: string;
  },
  callback: (response: { rooms: Array<{ roomId: string; roomName: string; playerName: string }> }) => void
) {
  const rooms = roomManager.getRooms();
  const reconnectableRooms: Array<{ roomId: string; roomName: string; playerName: string }> = [];
  
  for (const room of rooms) {
    const player = room.players.find(p => p.id === payload.agentId);
    if (player && (player.type === 'ai-auto' || player.aiControl?.mode === 'auto')) {
      reconnectableRooms.push({
        roomId: room.id,
        roomName: room.name,
        playerName: player.name,
      });
    }
  }
  
  callback?.({ rooms: reconnectableRooms });
}

// ==================== 发言系统事件 ====================

/**
 * 处理 AI 发言
 */
export async function handleAgentSpeak(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    content: string;
    emotion?: string;
    targetPlayer?: string;
  },
  callback?: (response: { success: boolean; error?: string }) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    if (!roomId || !playerId) {
      callback?.({ success: false, error: '未加入房间' });
      return;
    }

    const speechManager = getSpeechManager(io, roomId);
    
    speechManager.handleSpeech({
      playerId,
      playerName,
      content: payload.content,
      emotion: payload.emotion,
      targetPlayer: payload.targetPlayer,
      timestamp: Date.now(),
    });

    callback?.({ success: true });
  } catch (error) {
    console.error(`[Speech] 发言处理失败:`, error);
    callback?.({ success: false, error: error instanceof Error ? error.message : '发言失败' });
  }
}

/**
 * 处理情绪刺激响应
 * AI Agent 收到刺激后可以选择是否发言
 */
export async function handleStimulusResponse(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    respond: boolean;
    content?: string;
  },
  callback?: (response: { success: boolean }) => void
) {
  try {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    const playerName = socket.data.playerName;

    if (!roomId || !playerId || !payload.respond || !payload.content) {
      callback?.({ success: true });
      return;
    }

    const speechManager = getSpeechManager(io, roomId);
    
    speechManager.handleSpeech({
      playerId,
      playerName,
      content: payload.content,
      timestamp: Date.now(),
    });

    callback?.({ success: true });
  } catch (error) {
    console.error(`[Stimulus] 响应处理失败:`, error);
    callback?.({ success: true });
  }
}

/**
 * 获取玩家情绪状态
 */
export async function handleGetEmotion(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    playerId?: string;
  },
  callback: (response: { emotion?: any; error?: string }) => void
) {
  try {
    const roomId = socket.data.roomId;
    const targetId = payload.playerId || socket.data.playerId;

    if (!roomId) {
      callback?.({ error: '未加入房间' });
      return;
    }

    const speechManager = getSpeechManager(io, roomId);
    const emotion = speechManager.getEmotion(targetId);

    callback?.({ emotion });
  } catch (error) {
    callback?.({ error: error instanceof Error ? error.message : '获取情绪失败' });
  }
}

/**
 * 获取发言历史
 */
export async function handleGetSpeechHistory(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: {
    limit?: number;
  },
  callback: (response: { history?: any[]; error?: string }) => void
) {
  try {
    const roomId = socket.data.roomId;

    if (!roomId) {
      callback?.({ error: '未加入房间' });
      return;
    }

    const speechManager = getSpeechManager(io, roomId);
    const history = speechManager.getSpeechHistory(payload.limit || 20);

    callback?.({ history });
  } catch (error) {
    callback?.({ error: error instanceof Error ? error.message : '获取历史失败' });
  }
}
