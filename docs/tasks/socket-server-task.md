# Socket.io 服务端模块 - 开发任务书

## 模块概述

负责处理实时通信，包括房间管理、玩家连接、游戏状态同步。

## 文件结构

```
src/server/
├── index.ts            # 入口
├── app.ts              # Express 应用
├── /socket
│   ├── handlers.ts     # 事件处理器
│   └── events.ts       # 事件定义
├── /room
│   ├── RoomManager.ts  # 房间管理
│   └── PlayerSession.ts # 玩家会话
└── /utils
    └── storage.ts      # 战绩存储
```

---

## 1. RoomManager.ts - 房间管理

### 职责
- 创建/销毁房间
- 玩家加入/离开
- 房间列表管理

### 类设计

```typescript
class RoomManager {
  private rooms: Map<string, Room>;
  
  // 创建房间，返回房间号
  createRoom(hostId: string, hostName: string): string;
  
  // 获取房间
  getRoom(roomId: string): Room | undefined;
  
  // 加入房间
  joinRoom(roomId: string, playerId: string, playerName: string, isAI: boolean): boolean;
  
  // 离开房间
  leaveRoom(roomId: string, playerId: string): void;
  
  // 踢出玩家
  kickPlayer(roomId: string, kickerId: string, targetId: string): boolean;
  
  // 检查房间是否存在
  roomExists(roomId: string): boolean;
  
  // 获取房间玩家列表
  getPlayers(roomId: string): Player[];
  
  // 房间是否已满
  isRoomFull(roomId: string): boolean;
  
  // 销毁房间（无人时自动清理）
  destroyRoom(roomId: string): void;
}

// 房间数据
interface Room {
  id: string;
  hostId: string;
  players: Player[];
  gameState: GameState | null;
  createdAt: number;
  settings: GameSettings;
}
```

### 边界情况
- 房间号生成：4位数字，避免重复
- 同一玩家不能重复加入同一房间
- 房主离开时，自动转让给下一个玩家
- 房间无人时自动销毁

---

## 2. PlayerSession.ts - 玩家会话

### 职责
- 管理玩家连接状态
- 断线重连
- 超时处理

### 类设计

```typescript
class PlayerSession {
  private sessions: Map<string, Session>;
  
  // 注册玩家会话
  registerSession(playerId: string, socketId: string, roomId: string): void;
  
  // 获取玩家会话
  getSession(playerId: string): Session | undefined;
  
  // 通过 socket 获取玩家
  getPlayerBySocket(socketId: string): { playerId: string; roomId: string } | undefined;
  
  // 更新心跳时间
  updateHeartbeat(playerId: string): void;
  
  // 检查是否在线
  isOnline(playerId: string): boolean;
  
  // 设置离线
  setOffline(playerId: string): void;
  
  // 断线重连
  reconnect(playerId: string, newSocketId: string): boolean;
  
  // 清理过期会话
  cleanupExpired(): void;
}

interface Session {
  playerId: string;
  socketId: string;
  roomId: string;
  lastHeartbeat: number;
  isOnline: boolean;
  reconnectToken?: string;  // 用于断线重连
}
```

### 断线重连逻辑
1. 玩家断线后，标记为离线
2. 5 分钟内可以重连
3. 重连后恢复游戏状态
4. 超过 5 分钟，自动离开房间

---

## 3. handlers.ts - 事件处理器

### 职责
- 处理所有 Socket.io 事件
- 调用游戏引擎和房间管理器

### 处理的事件

```typescript
// === 房间相关 ===
function handleCreateRoom(socket: Socket, data: { nickname: string });
function handleJoinRoom(socket: Socket, data: { roomId: string; nickname: string });
function handleJoinAI(socket: Socket, data: { roomId: string; agentId: string; agentName: string });
function handleLeaveRoom(socket: Socket);
function handleKickPlayer(socket: Socket, data: { targetId: string });

// === 游戏相关 ===
function handleStartGame(socket: Socket);
function handleDraw(socket: Socket);
function handleDiscard(socket: Socket, data: { tileId: string });
function handleAction(socket: Socket, data: { action: string; tiles?: string[] });
function handlePass(socket: Socket);

// === 聊天相关 ===
function handleChatSend(socket: Socket, data: { message: string });
function handleVoiceSend(socket: Socket, data: { audio: Buffer });

// === 角色选择 ===
function handleCharacterList(socket: Socket);
function handleCharacterSelect(socket: Socket, data: { characterIds: string[] });

// === 心跳 ===
function handlePing(socket: Socket);
```

### AI 玩家连接处理

```typescript
// AI 连接时携带的认证信息
interface AIAuth {
  type: 'ai';
  agentId: string;
  agentName: string;
  token?: string;  // 可选的安全验证
}

// 真人连接时携带的认证信息
interface HumanAuth {
  type: 'human';
  nickname: string;
}

// 处理连接
io.on('connection', (socket) => {
  const auth = socket.handshake.auth;
  
  if (auth.type === 'ai') {
    // AI 玩家连接
    socket.data.isAI = true;
    socket.data.agentId = auth.agentId;
    socket.data.name = auth.agentName;
  } else {
    // 真人玩家连接
    socket.data.isAI = false;
    socket.data.name = auth.nickname;
  }
});
```

---

## 4. storage.ts - 战绩存储

### 职责
- 保存/读取战绩
- 战绩统计

### 类设计

```typescript
class StatsStorage {
  private filePath: string;
  
  constructor(filePath: string);
  
  // 读取战绩
  loadStats(): GameStats;
  
  // 保存战绩
  saveStats(stats: GameStats): void;
  
  // 添加一条记录
  addRecord(record: GameRecord): void;
  
  // 清空战绩
  clearStats(): void;
  
  // 获取统计
  getSummary(): { totalGames: number; wins: number; winRate: number };
}

interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  totalScore: number;
  history: GameRecord[];
}

interface GameRecord {
  timestamp: number;
  players: string[];
  winner: number;
  winningHand: WinningHand;
  scores: number[];
}
```

---

## 5. app.ts - Express 应用

### 职责
- 创建 HTTP 服务器
- 配置 Socket.io
- 提供静态文件服务

### 结构

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// 静态文件
app.use(express.static(path.join(__dirname, '../../client')));

// API 路由
app.get('/api/room/:id', (req, res) => { /* 获取房间信息 */ });
app.get('/api/settings', (req, res) => { /* 获取默认设置 */ });
app.get('/api/stats', (req, res) => { /* 获取战绩 */ });

// Socket.io 事件处理
io.on('connection', (socket) => {
  // 注册所有事件处理器
});

export { app, httpServer, io };
```

---

## 6. events.ts - 事件定义

### 事件常量

```typescript
// 客户端 → 服务端
export const CLIENT_EVENTS = {
  // 房间
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  JOIN_ROOM_AI: 'room:joinAI',
  LEAVE_ROOM: 'room:leave',
  KICK_PLAYER: 'player:kick',
  
  // 游戏
  START_GAME: 'game:start',
  DRAW: 'game:draw',
  DISCARD: 'game:discard',
  ACTION: 'game:action',
  PASS: 'game:pass',
  
  // 聊天
  CHAT_SEND: 'chat:send',
  VOICE_SEND: 'voice:send',
  
  // 角色
  CHARACTER_LIST: 'character:list',
  CHARACTER_SELECT: 'character:select',
  
  // 心跳
  PING: 'ping',
} as const;

// 服务端 → 客户端
export const SERVER_EVENTS = {
  // 房间
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  PLAYER_JOINED: 'room:playerJoined',
  PLAYER_LEFT: 'room:playerLeft',
  PLAYER_KICKED: 'player:kicked',
  
  // 游戏
  GAME_STATE: 'game:state',
  YOUR_TURN: 'game:yourTurn',
  ACTION_REQUIRED: 'game:actionRequired',
  GAME_OVER: 'game:over',
  
  // 聊天
  CHAT_MESSAGE: 'chat:message',
  
  // 角色
  CHARACTER_LIST: 'character:list',
  CHARACTER_ASSIGNED: 'character:assigned',
  
  // 心跳
  PONG: 'pong',
  
  // 错误
  ERROR: 'error',
} as const;
```

---

## 超时机制

### 操作超时

```typescript
const TIMEOUTS = {
  DISCARD: 30000,      // 打牌 30 秒
  ACTION: 15000,       // 吃碰杠胡 15 秒
  HEARTBEAT: 60000,    // 心跳 60 秒
  RECONNECT: 300000,   // 断线重连 5 分钟
};

// 超时处理
function setupTimeout(playerId: string, action: string, callback: () => void) {
  const timeout = TIMEOUTS[action] || 30000;
  return setTimeout(() => {
    callback();
  }, timeout);
}
```

---

## 测试要求

- 测试房间创建/加入/离开
- 测试 AI 玩家连接
- 测试断线重连
- 测试超时机制
- 测试状态同步

---

## 注意事项

1. 房间号是 4 位数字，需要检查唯一性
2. 真人玩家不能被踢出
3. AI 玩家通过 agentId 标识
4. 断线重连需要恢复完整游戏状态
5. 心跳保活防止连接断开
