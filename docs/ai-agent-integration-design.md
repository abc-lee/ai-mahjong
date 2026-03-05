# AI Agent 接入设计方案

> 版本：v1.0
> 更新时间：2026-03-05
> 目标：让 AI Agent 真正接入游戏参与打牌

---

## 1. 概述

### 1.1 背景

当前麻将游戏的基础功能已经跑通，但 AI Agent 从未真正接入过。现有代码中的 `AIAdapter` 是内置的降级逻辑，不是外部 Agent 连接。

### 1.2 目标

实现外部 AI Agent 通过 WebSocket 连接游戏服务器，接收游戏状态（Prompt），发送决策指令，参与打牌。

### 1.3 三种玩家角色

| 类型 | 标识 | 来源 | 特点 |
|------|------|------|------|
| 人类玩家 | `human` | 浏览器连接 | 看图形界面，点按钮操作 |
| AI Agent 玩家 | `ai-agent` | 外部 Agent 连接 | 收 Prompt，发 JSON 指令，有性格会聊天 |
| 自动托管 | `ai-auto` | 服务器内置 | 简单规则决策，只打牌不说话 |

---

## 2. Player 类型定义改动

### 2.1 当前定义

```typescript
// src/shared/types/player.ts
export type PlayerType = 'human' | 'ai';
```

### 2.2 改为

```typescript
// src/shared/types/player.ts
export type PlayerType = 'human' | 'ai-agent' | 'ai-auto';

export interface Player {
  id: string;
  name: string;
  position: 0 | 1 | 2 | 3;
  type: PlayerType;
  
  // 人类玩家
  socketId?: string;
  
  // AI Agent 玩家
  agentId?: string;
  agentSessionId?: string;  // Agent 会话 ID
  
  // AI 控制（agent 和 auto 共用）
  aiControl?: {
    mode: 'agent' | 'auto';           // 当前谁在控制
    disconnectedAt?: number;          // Agent 断线时间
  };
  
  // AI 配置
  aiConfig?: AIConfig;
  
  // ... 其他字段不变
}
```

### 2.3 AI Agent 断线降级

```
AI Agent 正常连接:
  type: 'ai-agent'
  aiControl.mode: 'agent'

AI Agent 断线后:
  type: 'ai-agent' (不变)
  aiControl.mode: 'auto' (切换为自动托管)
  aiControl.disconnectedAt: timestamp

AI Agent 重连:
  type: 'ai-agent'
  aiControl.mode: 'agent' (恢复)
```

---

## 3. 指令系统设计

### 3.1 指令格式

所有 AI Agent 发送的指令都是 JSON 格式：

```typescript
interface AgentCommand {
  cmd: string;           // 指令名称
  [key: string]: any;    // 指令参数
}
```

### 3.2 指令列表

| 指令 | 格式 | 说明 |
|------|------|------|
| 聊天 | `{"cmd": "chat", "message": "xxx"}` | 发送聊天消息 |
| 摸牌 | `{"cmd": "draw"}` | 摸一张牌 |
| 打牌 | `{"cmd": "discard", "tileId": "wan-1-0"}` | 打出一张牌 |
| 吃 | `{"cmd": "action", "action": "chi", "tiles": [...]}` | 吃牌 |
| 碰 | `{"cmd": "action", "action": "peng", "tiles": [...]}` | 碰牌 |
| 杠 | `{"cmd": "action", "action": "gang", "tiles": [...]}` | 杠牌 |
| 胡 | `{"cmd": "action", "action": "hu"}` | 胡牌 |
| 跳过 | `{"cmd": "pass"}` | 跳过当前操作 |
| 添加自动托管 | `{"cmd": "add_auto_player"}` | 让中间层添加自动托管 |
| 准备 | `{"cmd": "ready", "ready": true}` | 设置准备状态 |

### 3.3 服务端发给 Agent 的消息

```typescript
// 游戏开始 - 发送规则和指令集
interface WelcomeMessage {
  type: 'welcome';
  rules: string;           // 游戏规则说明
  commands: CommandDef[];  // 可用指令列表
  language: string;        // 当前语言
}

// 轮到你打牌
interface YourTurnMessage {
  type: 'your_turn';
  phase: 'draw' | 'discard';
  hand: TileInfo[];        // 你的手牌
  lastDrawn?: TileInfo;    // 刚摸到的牌
  gameState: GameStatePublic;
}

// 可以吃碰杠胡
interface ActionRequiredMessage {
  type: 'action_required';
  availableActions: ActionInfo[];
  lastDiscard: TileInfo;
  gameState: GameStatePublic;
}

// 错误反馈
interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
  hint?: string;           // 提示信息（如重新列出手牌）
}
```

---

## 4. 中间层架构

### 4.1 文件结构

```
src/server/prompt/
├── index.ts                # 导出
├── PromptEngine.ts         # 提示词引擎
├── CommandParser.ts        # 指令解析器
├── types.ts                # 类型定义
├── commands.json           # 指令集定义
└── locales/
    ├── zh-CN.json          # 中文
    ├── en-US.json          # 英文
    └── ja-JP.json          # 日文
```

### 4.2 PromptEngine 职责

```typescript
class PromptEngine {
  // 加载语言包
  loadLocale(language: string): void;
  
  // 生成欢迎消息（规则 + 指令集）
  generateWelcome(language: string): WelcomeMessage;
  
  // 生成轮次消息
  generateYourTurn(player: Player, gameState: GameStatePublic): YourTurnMessage;
  
  // 生成操作请求消息
  generateActionRequired(player: Player, actions: PendingAction[], gameState: GameStatePublic): ActionRequiredMessage;
  
  // 生成错误消息
  generateError(code: string, context?: any): ErrorMessage;
}
```

### 4.3 CommandParser 职责

```typescript
class CommandParser {
  // 解析 JSON 指令
  parse(json: string): AgentCommand | null;
  
  // 验证指令格式
  validate(command: AgentCommand): boolean;
  
  // 指令转游戏操作
  toGameAction(command: AgentCommand): GameAction;
}
```

---

## 5. Socket 事件改动

### 5.1 新增事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `agent:command` | Agent → Server | Agent 发送指令 |
| `agent:welcome` | Server → Agent | 发送规则和指令集 |
| `agent:your_turn` | Server → Agent | 轮到你打牌 |
| `agent:action_required` | Server → Agent | 可以吃碰杠胡 |
| `agent:error` | Server → Agent | 错误反馈 |

### 5.2 修改现有事件

```typescript
// room:joinAI 改为支持 type 区分
interface JoinAIPayload {
  roomId: string;
  agentId: string;
  agentName: string;
  type: 'ai-agent' | 'ai-auto';  // 新增
  personality?: string;
}
```

---

## 6. 实现任务分解

### Phase 1: 基础类型和解析器

| # | 任务 | 文件 | 优先级 |
|---|------|------|--------|
| 1 | 修改 PlayerType 定义 | `src/shared/types/player.ts` | P0 |
| 2 | 创建 CommandParser | `src/server/prompt/CommandParser.ts` | P0 |
| 3 | 创建指令集定义 | `src/server/prompt/commands.json` | P0 |

### Phase 2: 提示词引擎

| # | 任务 | 文件 | 优先级 |
|---|------|------|--------|
| 4 | 创建 PromptEngine | `src/server/prompt/PromptEngine.ts` | P0 |
| 5 | 创建中文语言包 | `src/server/prompt/locales/zh-CN.json` | P0 |

### Phase 3: Socket 处理

| # | 任务 | 文件 | 优先级 |
|---|------|------|--------|
| 6 | 添加 agent:command 处理 | `src/server/socket/handlers.ts` | P0 |
| 7 | 修改 broadcastGameState | `src/server/socket/handlers.ts` | P0 |
| 8 | 添加 Agent 断线检测 | `src/server/ai/AIManager.ts` | P1 |

### Phase 4: 测试

| # | 任务 | 说明 | 优先级 |
|---|------|------|--------|
| 9 | 单 Agent 连接测试 | 1 个 Agent 加入房间 | P0 |
| 10 | 4 Agent 打牌测试 | 4 个 Agent 实际打牌 | P0 |
| 11 | 断线降级测试 | Agent 断线后自动托管接管 | P1 |

---

## 7. 测试方法

### 7.1 启动 4 个 Agent 测试

```typescript
// 测试脚本
async function test4Agents() {
  // 1. 启动游戏服务器
  
  // 2. 创建 4 个 Agent 连接
  const agents = await Promise.all([
    createTestAgent('紫璃'),
    createTestAgent('白泽'),
    createTestAgent('李瞳'),
    createTestAgent('测试员'),
  ]);
  
  // 3. Agent 1 创建房间
  const roomId = await agents[0].createRoom();
  
  // 4. 其他 Agent 加入
  for (let i = 1; i < 4; i++) {
    await agents[i].joinRoom(roomId);
  }
  
  // 5. 开始游戏
  await agents[0].startGame();
  
  // 6. 监测游戏过程
  // 记录每个 Agent 收到的消息
  // 记录每个 Agent 发送的指令
  // 检测是否有无法识别的指令
  // 检测是否有打错牌的情况
}
```

### 7.2 迭代 Prompt

1. 收集测试日志
2. 分析问题：
   - Agent 发了无法识别的指令 → 完善指令集
   - Agent 打了不存在的牌 → 完善状态同步
   - Agent 忘记规则 → 完善规则说明
3. 修改 Prompt
4. 重新测试

---

## 8. 与现有代码的关系

### 8.1 现有 AIAdapter

现有的 `AIAdapter` 是内置的降级逻辑，改造后：
- 当 `player.aiControl.mode === 'auto'` 时使用
- Agent 连接时，创建 Agent 连接管理器替代

### 8.2 现有 PromptGenerator

现有的 `PromptGenerator` 需要重构为 `PromptEngine`：
- 支持多语言
- 支持指令集注入
- 支持错误恢复

---

*文档版本：v1.0*
*更新时间：2026-03-05*
