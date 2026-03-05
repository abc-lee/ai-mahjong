/**
 * Socket 处理器 - 共享工具函数
 */

import { Server, Socket } from 'socket.io';
import { RoomManager, Room as ServerRoom } from '../../room/RoomManager';
import { Player, PendingAction, Tile, Room, toPublicPlayer } from '../../../shared/types';

/**
 * Socket 数据类型
 */
export interface SocketData {
  playerId: string;
  playerName: string;
  roomId?: string;
  clientType?: 'human' | 'ai';
  agentId?: string;
}

/**
 * 将服务端 Room 转换为客户端 Room（可序列化）
 */
export function toClientRoom(serverRoom: ServerRoom): Room {
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
 * 检查是否是 AI Agent
 */
export function isAIAgent(socket: Socket): boolean {
  return socket.data.clientType === 'ai-agent';
}

/**
 * 检查是否是人类玩家
 */
export function isHuman(socket: Socket): boolean {
  return socket.data.clientType === 'human' || !socket.data.clientType;
}

/**
 * 获取房间内的玩家 Socket
 */
export function getPlayerSocket(io: Server, playerId: string): Socket | undefined {
  return Array.from(io.sockets.sockets.values())
    .find(s => s.data.playerId === playerId);
}

/**
 * 获取房间内的 AI Agent Socket
 */
export function getAgentSocket(io: Server, playerId: string): Socket | undefined {
  return Array.from(io.sockets.sockets.values())
    .find(s => s.data.playerId === playerId && s.data.clientType === 'ai-agent');
}

export type { Server, Socket, RoomManager };
