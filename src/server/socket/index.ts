/**
 * Socket.io 主设置
 */

import { Server } from 'socket.io';
import { RoomManager } from '../room/RoomManager';
import { 
  handleCreateRoom,
  handleCreateRoomAI,
  handleJoinRoom,
  handleLeaveRoom,
  handleRoomList,
  handleReady,
  handleGameStart,
  handleDraw,
  handleDiscard,
  handleAction,
  handlePass,
  handleDisconnect,
  broadcastGameState,
  handleJoinAI,
  handleAIDecision,
  handleAgentCommand,
  handleReconnectAI,
  handleGetReconnectableRooms,
  handleAgentSpeak,
  handleStimulusResponse,
  handleGetEmotion,
  handleGetSpeechHistory,
} from './handlers';

export function setupSocket(io: Server): void {
  const roomManager = new RoomManager();
  
  io.on('connection', (socket) => {
    console.log(`玩家连接: ${socket.id}`);
    
    // 房间事件
    socket.on('room:create', (data, callback) => handleCreateRoom(io, socket, roomManager, data, callback));
    socket.on('room:join', (data, callback) => handleJoinRoom(io, socket, roomManager, data, callback));
    socket.on('room:leave', (callback) => handleLeaveRoom(io, socket, roomManager, callback));
    socket.on('room:list', (callback) => handleRoomList(roomManager, callback));
    socket.on('room:ready', (data, callback) => handleReady(io, socket, roomManager, data, callback));
    
    // 游戏事件
    socket.on('game:start', (callback) => handleGameStart(io, socket, roomManager, callback));
    socket.on('game:draw', (callback) => handleDraw(io, socket, roomManager, callback));
    socket.on('game:discard', (data, callback) => handleDiscard(io, socket, roomManager, data, callback));
    socket.on('game:action', (data, callback) => handleAction(io, socket, roomManager, data, callback));
    socket.on('game:pass', (callback) => handlePass(io, socket, roomManager, callback));
    
    // AI 玩家事件
    socket.on('room:createAI', (data, callback) => handleCreateRoomAI(io, socket, roomManager, data, callback));
    socket.on('room:joinAI', (data, callback) => handleJoinAI(io, socket, roomManager, data, callback));
    socket.on('ai:decision', (data, callback) => handleAIDecision(io, socket, roomManager, data, callback));
    socket.on('agent:command', (data, callback) => handleAgentCommand(io, socket, roomManager, data, callback));
    socket.on('agent:reconnect', (data, callback) => handleReconnectAI(io, socket, roomManager, data, callback));
    socket.on('agent:getReconnectableRooms', (data, callback) => handleGetReconnectableRooms(socket, roomManager, data, callback));
    
    // 发言系统事件
    socket.on('agent:speak', (data, callback) => handleAgentSpeak(io, socket, roomManager, data, callback));
    socket.on('agent:stimulusResponse', (data, callback) => handleStimulusResponse(io, socket, roomManager, data, callback));
    socket.on('agent:getEmotion', (data, callback) => handleGetEmotion(io, socket, roomManager, data, callback));
    socket.on('agent:getSpeechHistory', (data, callback) => handleGetSpeechHistory(io, socket, roomManager, data, callback));
    
    // 断开连接
    socket.on('disconnect', () => handleDisconnect(io, socket, roomManager));
  });
}

export { broadcastGameState };
