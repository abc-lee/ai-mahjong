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
  handleAgentRequestState,
  handleAddFriend,
  handleRemoveFriend,
  handleGetFriends,
} from './handlers';

// 全局 RoomManager 实例
let roomManagerInstance: RoomManager | null = null;

export function setupSocket(io: Server): void {
  roomManagerInstance = new RoomManager();
  
  io.on('connection', (socket) => {
    console.log(`玩家连接: ${socket.id}`);
    
    // 房间事件
    socket.on('room:create', (data, callback) => handleCreateRoom(io, socket, roomManagerInstance!, data, callback));
    socket.on('room:join', (data, callback) => handleJoinRoom(io, socket, roomManagerInstance!, data, callback));
    socket.on('room:leave', (callback) => handleLeaveRoom(io, socket, roomManagerInstance!, callback));
    socket.on('room:list', (callback) => handleRoomList(roomManagerInstance!, callback));
    socket.on('room:ready', (data, callback) => handleReady(io, socket, roomManagerInstance!, data, callback));
    
    // 游戏事件
    socket.on('game:start', (callback) => handleGameStart(io, socket, roomManagerInstance!, callback));
    socket.on('game:draw', (callback) => handleDraw(io, socket, roomManagerInstance!, callback));
    socket.on('game:discard', (data, callback) => handleDiscard(io, socket, roomManagerInstance!, data, callback));
    socket.on('game:action', (data, callback) => handleAction(io, socket, roomManagerInstance!, data, callback));
    socket.on('game:pass', (callback) => handlePass(io, socket, roomManagerInstance!, callback));
    
    // AI 玩家事件
    socket.on('room:createAI', (data, callback) => handleCreateRoomAI(io, socket, roomManagerInstance!, data, callback));
    socket.on('room:joinAI', (data, callback) => handleJoinAI(io, socket, roomManagerInstance!, data, callback));
    socket.on('ai:decision', (data, callback) => handleAIDecision(io, socket, roomManagerInstance!, data, callback));
    socket.on('agent:command', (data, callback) => handleAgentCommand(io, socket, roomManagerInstance!, data, callback));
    socket.on('agent:reconnect', (data, callback) => handleReconnectAI(io, socket, roomManagerInstance!, data, callback));
    socket.on('agent:getReconnectableRooms', (data, callback) => handleGetReconnectableRooms(socket, roomManagerInstance!, data, callback));
    socket.on('agent:requestState', (callback) => handleAgentRequestState(io, socket, roomManagerInstance!, callback));
    
    // 发言系统事件
    socket.on('agent:speak', (data, callback) => handleAgentSpeak(io, socket, roomManagerInstance!, data, callback));
    socket.on('agent:stimulusResponse', (data, callback) => handleStimulusResponse(io, socket, roomManagerInstance!, data, callback));
    socket.on('agent:getEmotion', (data, callback) => handleGetEmotion(io, socket, roomManagerInstance!, data, callback));
    socket.on('agent:getSpeechHistory', (data, callback) => handleGetSpeechHistory(io, socket, roomManagerInstance!, data, callback));
    
    // 好友系统事件
    socket.on('friend:add', (data, callback) => handleAddFriend(io, socket, roomManagerInstance!, data, callback));
    socket.on('friend:remove', (data, callback) => handleRemoveFriend(io, socket, roomManagerInstance!, data, callback));
    socket.on('friend:list', (callback) => handleGetFriends(io, socket, roomManagerInstance!, callback));
    
    // 断开连接
    socket.on('disconnect', () => handleDisconnect(io, socket, roomManagerInstance!));
  });
}

export function getRoomManager(): RoomManager | null {
  return roomManagerInstance;
}

export { broadcastGameState };
