# AI Agent 接入任务清单

> 更新时间：2026-03-05
> 状态：待实施

---

## 1. 改动总览

### 需要修改的文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/shared/types/player.ts` | 修改 | 扩展 PlayerType |
| `src/server/ai/AIAdapter.ts` | 修改 | 支持 Agent 连接 |
| `src/server/ai/AIManager.ts` | 修改 | 管理 Agent 连接 |
| `src/server/socket/handlers.ts` | 修改 | 处理 Agent 指令 |
| `src/server/socket/index.ts` | 修改 | 注册新事件 |

### 需要新建的文件

| 文件 | 说明 |
|------|------|
| `src/server/prompt/CommandParser.ts` | 指令解析器 |
| `src/server/prompt/commands.json` | 指令集定义 |
| `src/server/prompt/locales/zh-CN.json` | 中文语言包 |

---

## 2. 详细任务

### Phase 1: 类型定义（0.5 天）

#### Task 1.1: 修改 PlayerType

**文件**: `src/shared/types/player.ts`

**当前代码** (Line 9):
```typescript
export type PlayerType = 'human' | 'ai';
```

**改为**:
```typescript
export type PlayerType = 'human' | 'ai-agent' | 'ai-auto';
```

#### Task 1.2: 扩展 Player 接口

**文件**: `src/shared/types/player.ts`

**添加字段**:
```typescript
export interface Player {
  // ... existing fields
  
  // AI 控制（agent 和 auto 共用）
  aiControl?: {
    mode: 'agent' | 'auto';
    agentSessionId?: string;  // Agent 会话 ID
    disconnectedAt?: number;  // 断线时间
  };
}
```

#### Task 1.3: 兼容性处理

**问题**: 现有代码检查 `player.type === 'ai'`

**需要修改的位置**:
- `src/server/room/RoomManager.ts` Line 321: `type: 'ai'` → `type: 'ai-agent'`
- `src/server/ai/AIManager.ts` Line 45: `player.type === 'ai'` → `player.type.startsWith('ai')`
- `src/server/socket/handlers.ts` Line 89: `player.type === 'ai'` → `player.type === 'ai-agent'`
- `src/client/components/GameBoard/PlayerArea.tsx` Line 106: 同上

---

### Phase 2: 指令解析器（0.5 天）

#### Task 2.1: 创建指令定义

**新建文件**: `src/server/prompt/commands.json`

```json
{
  "version": "1.0",
  "commands": [
    {
      "name": "chat",
      "params": ["message"],
      "description": "发送聊天消息"
    },
    {
      "name": "draw",
      "params": [],
      "description": "摸牌"
    },
    {
      "name": "discard",
      "params": ["tileId"],
      "description": "打牌"
    },
    {
      "name": "action",
      "params": ["action", "tiles?"],
      "description": "吃碰杠胡"
    },
    {
      "name": "pass",
      "params": [],
      "description": "跳过"
    },
    {
      "name": "ready",
      "params": ["ready"],
      "description": "准备"
    },
    {
      "name": "add_auto_player",
      "params": [],
      "description": "添加自动托管"
    }
  ]
}
```

#### Task 2.2: 创建 CommandParser

**新建文件**: `src/server/prompt/CommandParser.ts`

```typescript
import commands from './commands.json';

export interface AgentCommand {
  cmd: string;
  [key: string]: any;
}

export class CommandParser {
  private validCommands: Set<string>;
  
  constructor() {
    this.validCommands = new Set(commands.commands.map(c => c.name));
  }
  
  parse(json: string): AgentCommand | null {
    try {
      const obj = JSON.parse(json);
      if (obj.cmd && this.validCommands.has(obj.cmd)) {
        return obj as AgentCommand;
      }
      return null;
    } catch {
      return null;
    }
  }
  
  validate(command: AgentCommand): boolean {
    return this.validCommands.has(command.cmd);
  }
}

export const commandParser = new CommandParser();
```

---

### Phase 3: Socket 事件处理（1 天）

#### Task 3.1: 修改 handleJoinAI

**文件**: `src/server/socket/handlers.ts`

**位置**: Line 559-615

**改动**:
- 支持 `type: 'ai-agent' | 'ai-auto'` 参数
- 创建 AIAdapter 时传入 agent 连接信息

#### Task 3.2: 新增 handleAgentCommand

**文件**: `src/server/socket/handlers.ts`

**新增函数**:
```typescript
export async function handleAgentCommand(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: string,  // JSON string
  callback?: (response: { success: boolean; error?: string }) => void
) {
  const command = commandParser.parse(payload);
  if (!command) {
    // 无法识别，重发规则
    sendWelcomeToAgent(socket);
    callback?.({ success: false, error: 'unknown_command' });
    return;
  }
  
  // 执行指令
  switch (command.cmd) {
    case 'chat':
      // 处理聊天
      break;
    case 'draw':
      // 调用 handleDraw 逻辑
      break;
    case 'discard':
      // 调用 handleDiscard 逻辑
      break;
    // ...
  }
}
```

#### Task 3.3: 修改 broadcastGameState

**文件**: `src/server/socket/handlers.ts`

**位置**: Line 62-108

**改动**: 对 AI Agent 发送结构化消息而非调用 adapter

```typescript
// 当前代码 (Line 89-106):
} else if (player.type === 'ai') {
  // AI 玩家：调用 AIAdapter
  const adapter = aiManager.getAdapter(player.id);
  // ...
}

// 改为:
} else if (player.type === 'ai-agent') {
  // AI Agent: 通过 Socket 发送 Prompt
  const agentSocket = getAgentSocket(player.id);
  if (agentSocket) {
    agentSocket.emit('agent:your_turn', {
      phase: turnPhase,
      hand: player.hand,
      lastDrawnTile,
      gameState: publicState,
    });
  } else {
    // Agent 断线，降级到自动托管
    player.aiControl = { mode: 'auto', disconnectedAt: Date.now() };
    const adapter = aiManager.getAdapter(player.id);
    // ... 使用 adapter 自动打牌
  }
}
```

---

### Phase 4: AIAdapter 改造（0.5 天）

#### Task 4.1: 添加 Agent 连接支持

**文件**: `src/server/ai/AIAdapter.ts`

**改动**:
- 接收可选的 agentSocket 参数
- 当有 agent 连接时，不主动决策，等待 agent 指令
- 用于 `ai-auto` 模式或 Agent 断线降级

```typescript
export class AIAdapter {
  private player: Player;
  private config: AIConfig;
  private agentSocket?: Socket;  // 新增
  
  constructor(player: Player, agentSocket?: Socket) {
    this.player = player;
    this.config = player.aiConfig!;
    this.agentSocket = agentSocket;
  }
  
  // handleEvent 只在没有 agent 连接时执行
  async handleEvent(event: GameEvent): Promise<AIDecision | null> {
    if (this.agentSocket) {
      // 有 Agent 连接，不主动决策
      return null;
    }
    // ... existing logic
  }
}
```

---

## 3. 测试任务

### Task T.1: 单 Agent 连接测试

```bash
# 启动服务器
npm run dev:server

# 用脚本模拟 Agent 连接
node scripts/test-agent-connect.js
```

### Task T.2: 4 Agent 打牌测试

创建测试脚本，启动 4 个模拟 Agent 进行完整游戏。

---

## 4. 进度跟踪

| # | 任务 | 状态 | 备注 |
|---|------|------|------|
| 1.1 | 修改 PlayerType | ✅ 完成 | |
| 1.2 | 扩展 Player 接口 | ✅ 完成 | |
| 1.3 | 兼容性处理 | ✅ 完成 | |
| 2.1 | 创建 commands.json | ✅ 完成 | |
| 2.2 | 创建 CommandParser | ✅ 完成 | |
| 3.1 | 修改 handleJoinAI | ✅ 完成 | |
| 3.2 | 新增 handleAgentCommand | ✅ 完成 | |
| 3.3 | 修改 broadcastGameState | ✅ 完成 | |
| 4.1 | AIAdapter 改造 | ✅ 完成 | 已在 broadcastGameState 处理 |
| T.1 | 测试脚本 | ✅ 完成 | scripts/test-agent-connect.ts |
| T.2 | 运行测试 | ⏳ 待执行 | |

---

*更新时间：2026-03-05*
