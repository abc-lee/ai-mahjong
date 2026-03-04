# 前端组件模块 - 开发任务书

## 模块概述

前端负责游戏界面展示、用户交互、状态管理。

## 文件结构

```
src/client/
├── main.tsx              # 入口
├── App.tsx               # 根组件
├── /pages
│   ├── Lobby.tsx         # 大厅页面
│   └── Game.tsx          # 游戏页面
├── /components
│   ├── /game
│   │   ├── Table.tsx     # 牌桌
│   │   ├── Hand.tsx      # 手牌区
│   │   ├── River.tsx     # 牌河
│   │   ├── Melds.tsx     # 副露区
│   │   ├── ActionBar.tsx # 操作按钮
│   │   ├── Tile.tsx      # 单张牌
│   │   └── PlayerSeat.tsx # 玩家座位
│   ├── /chat
│   │   ├── ChatBubble.tsx # 对话气泡
│   │   ├── ChatPanel.tsx  # 聊天面板
│   │   └── ChatInput.tsx  # 输入框
│   ├── /lobby
│   │   ├── CreateRoom.tsx
│   │   └── JoinRoom.tsx
│   └── /ui
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── Settings.tsx
├── /stores
│   ├── gameStore.ts
│   ├── chatStore.ts
│   └── settingsStore.ts
├── /hooks
│   └── useSocket.ts
└── /services
    └── socket.ts
```

---

## 1. 页面组件

### 1.1 Lobby.tsx - 大厅页面

```typescript
interface LobbyProps {}

// 功能
- 创建房间按钮
- 加入房间输入框
- 房间号显示
- 等待玩家列表
- AI 角色选择界面
```

### 1.2 Game.tsx - 游戏页面

```typescript
interface GameProps {
  roomId: string;
  playerId: string;
}

// 子组件
- Header (顶部信息栏)
- Table (牌桌)
- ActionBar (操作按钮)
- ChatPanel (聊天面板)
- Modals (弹窗)
```

---

## 2. 游戏组件

### 2.1 Table.tsx - 牌桌

```typescript
interface TableProps {
  players: PlayerPublic[];
  currentPlayerIndex: number;
  lastDiscard: Tile | null;
}

// 布局
- 4 个 PlayerSeat 围成一圈
- 中间是 River (牌河)
- 显示当前谁在行动
```

### 2.2 PlayerSeat.tsx - 玩家座位

```typescript
interface PlayerSeatProps {
  player: PlayerPublic;
  isCurrentPlayer: boolean;
  isSelf: boolean;  // 是否是自己
  position: 'bottom' | 'right' | 'top' | 'left';
}

// 显示
- 玩家名字 + 头像
- 手牌（自己显示正面，其他人显示背面）
- 副露区 Melds
- 弃牌区（小牌）
- 对话气泡
- 情绪表情
```

### 2.3 Hand.tsx - 手牌区

```typescript
interface HandProps {
  tiles: Tile[];
  isSelfTurn: boolean;
  onTileClick: (tile: Tile) => void;
  selectedTileId: string | null;
}

// 功能
- 显示自己的手牌
- 点击选中（高亮）
- 打出的牌飞出动画
```

### 2.4 Tile.tsx - 单张牌

```typescript
interface TileProps {
  tile: Tile;
  isHidden?: boolean;    // 是否显示背面
  isSelected?: boolean;
  isSelectable?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

// 显示
- 像素风格的牌面图片
- 背面是统一的图案
- 选中时有高亮边框
- 可点击时有悬浮效果
```

### 2.5 ActionBar.tsx - 操作按钮

```typescript
interface ActionBarProps {
  canChi: boolean;
  canPeng: boolean;
  canGang: boolean;
  canHu: boolean;
  onChi: () => void;
  onPeng: () => void;
  onGang: () => void;
  onHu: () => void;
  onPass: () => void;
}

// 按钮
- [吃] [碰] [杠] [胡] [跳过]
- 只有可用时才高亮
- 有倒计时显示
```

### 2.6 River.tsx - 牌河

```typescript
interface RiverProps {
  discards: Tile[];
}

// 显示
- 每个玩家的弃牌区
- 6 列布局
- 新打出的牌有入场动画
```

---

## 3. 聊天组件

### 3.1 ChatPanel.tsx - 聊天面板

```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  onVoiceSend: (audio: Blob) => void;
}

// 显示
- 消息列表（滚动）
- 输入框
- 语音按钮
- 发送按钮
```

### 3.2 ChatBubble.tsx - 对话气泡

```typescript
interface ChatBubbleProps {
  message: string;
  playerName: string;
  position: 'bottom' | 'right' | 'top' | 'left';
  duration?: number;  // 显示时长
}

// 显示
- 在玩家头像旁边弹出
- 3-5 秒后自动消失
- 有动画效果
```

### 3.3 ChatInput.tsx - 输入框

```typescript
interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendVoice: (audio: Blob) => void;
}

// 功能
- 文字输入框
- 语音按钮（按住录音）
- 发送按钮
- 最长录音 60 秒
```

---

## 4. 大厅组件

### 4.1 CreateRoom.tsx - 创建房间

```typescript
interface CreateRoomProps {
  onCreate: (nickname: string) => void;
}

// 功能
- 输入昵称
- 点击创建房间
- 显示房间号
```

### 4.2 JoinRoom.tsx - 加入房间

```typescript
interface JoinRoomProps {
  onJoin: (roomId: string, nickname: string) => void;
}

// 功能
- 输入房间号
- 输入昵称
- 点击加入
```

---

## 5. UI 组件

### 5.1 Modal.tsx - 弹窗

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// 用途
- 设置面板
- 游戏结束结算
- 踢人确认
```

### 5.2 Settings.tsx - 设置面板

```typescript
interface SettingsProps {
  settings: GameSettings;
  onUpdate: (settings: Partial<GameSettings>) => void;
}

// 设置项
- 番型选择（多选）
- 难度选择
- 音效开关
- 战绩保存开关
- 清空战绩按钮
```

---

## 6. 状态管理 (Zustand)

### 6.1 gameStore.ts

```typescript
interface GameStore {
  // 状态
  roomId: string | null;
  playerId: string | null;
  gameState: GameStatePublic | null;
  myHand: Tile[];
  isMyTurn: boolean;
  availableActions: PendingAction[];
  
  // 操作
  setRoomId: (id: string) => void;
  setGameState: (state: GameStatePublic) => void;
  setMyHand: (tiles: Tile[]) => void;
  setMyTurn: (isTurn: boolean) => void;
  setAvailableActions: (actions: PendingAction[]) => void;
}
```

### 6.2 chatStore.ts

```typescript
interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  isAI: boolean;
  timestamp: number;
}
```

### 6.3 settingsStore.ts

```typescript
interface SettingsStore {
  settings: GameSettings;
  updateSettings: (s: Partial<GameSettings>) => void;
  loadSettings: () => void;
  saveSettings: () => void;
}
```

---

## 7. Hooks

### 7.1 useSocket.ts

```typescript
function useSocket() {
  // 返回 socket 实例和状态
  return {
    socket: Socket | null,
    isConnected: boolean,
    connect: () => void,
    disconnect: () => void,
  };
}
```

---

## 8. 服务层

### 8.1 socket.ts

```typescript
class SocketService {
  private socket: Socket | null = null;
  
  connect(url: string, auth: HumanAuth | AIAuth): void;
  disconnect(): void;
  
  // 发送事件
  emit(event: string, data: any): void;
  
  // 监听事件
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: (data: any) => void): void;
  
  // 房间操作
  createRoom(nickname: string): Promise<string>;
  joinRoom(roomId: string, nickname: string): Promise<void>;
  leaveRoom(): void;
  
  // 游戏操作
  startGame(): void;
  draw(): Promise<Tile>;
  discard(tileId: string): void;
  performAction(action: PendingAction): void;
  pass(): void;
  
  // 聊天
  sendMessage(msg: string): void;
  sendVoice(audio: Blob): void;
}

export const socketService = new SocketService();
```

---

## 9. 动画要求

使用 Framer Motion：

| 组件 | 动画 |
|------|------|
| Tile | 入场、选中、打出飞出 |
| ChatBubble | 弹出、消失 |
| Modal | 淡入淡出 |
| PlayerSeat | 轮到时高亮闪烁 |
| 惩罚动画 | 头像变形、特效 |

---

## 10. 响应式设计

| 屏幕尺寸 | 布局 |
|----------|------|
| 桌面 (>1024px) | 4 个玩家正常分布 |
| 平板 (768-1024px) | 压缩间距 |
| 手机 (<768px) | 简化布局，手牌横向滚动 |

---

## 测试要求

- 测试组件渲染
- 测试状态更新
- 测试用户交互
- 测试 Socket 连接
