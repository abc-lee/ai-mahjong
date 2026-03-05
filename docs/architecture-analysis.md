# AI Mahjong 架构深度分析报告

> 生成时间：2026-03-05
> 来源：Oracle Agent 深度分析

---

## 一、AI Agent 接入问题分析

### 1.1 紫璃被当作"人类"玩家的根因

**问题现象**：紫璃（创建房间的玩家）轮到她时不出牌

**根因分析**：
- 测试脚本中紫璃调用的是 `room:create`（创建房间），而不是 `room:joinAI`
- `handleCreateRoom` 创建的是普通玩家，**不设置 `clientType`**
- 紫璃的 `player.type` 是 `'human'`（默认值）
- 服务器发送 `game:state` 而非 `agent:your_turn`

### 1.2 解决方案

**方案 A**：新增 `room:createAI` 事件，让 AI Agent 可以创建房间

```typescript
export async function handleCreateRoomAI(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  payload: { agentId: string; agentName: string; type?: 'ai-agent' | 'ai-auto' },
  callback: (response: { roomId: string; room: Room } | ErrorResponse) => void
) {
  const playerType = payload.type || 'ai-agent';
  socket.data.clientType = playerType;
  socket.data.agentId = payload.agentId;
  socket.data.playerId = payload.agentId;
  socket.data.playerName = payload.agentName;
  // ...
}
```

**方案 B**：让 Agent 以"人类创建房间 + AI 加入"的流程运行

### 1.3 真正的 AI Agent 如何参与

```
AI Agent（LLM 会话）
    │
    │ 1. WebSocket 连接
    │ 2. 发送 room:joinAI / room:createAI
    │
    ▼
游戏服务器
    │
    │ 3. 发送 Prompt（自然语言）
    │    - 游戏规则
    │    - 当前状态（手牌、轮次）
    │    - 可用指令
    │
    ▼
AI Agent（LLM 会话）
    │
    │ 4. 理解 Prompt，生成自然语言决策
    │    如: {"cmd": "discard", "tileId": "wan-1-0"}
    │
    ▼
游戏服务器
    │
    │ 5. 解析决策，验证执行
    │
    ▼
游戏状态更新
```

**关键差异**：
- **脚本模拟**：直接调用 Socket API，逻辑硬编码
- **真正 Agent**：接收自然语言 Prompt，返回自然语言决策，由中间层解析

---

## 二、Prompt 系统设计

### 2.1 当前状态

```
src/server/prompt/
├── PromptGenerator.ts  (306行)
├── CommandParser.ts    (92行)
├── commands.json
├── types.ts
└── index.ts
```

**已实现**：
- ✅ 7 种场景 Prompt（游戏开始、摸牌、打牌、操作选择等）
- ✅ 手牌/副露/操作格式化函数

**缺失**：
- ❌ 多语言支持（硬编码中文）
- ❌ 规则注入机制
- ❌ 错误恢复逻辑
- ❌ 模板文件系统

### 2.2 改进方案

1. **创建 `locales/` 目录**：添加 `zh-CN.json`、`en-US.json`
2. **创建 `templates/` 目录**：添加 `welcome.md`、`rules.md`、`error.md`
3. **扩展 PromptGenerator**：接受 `locale` 和 `ruleSet` 参数
4. **实现错误恢复**：`parseWithFallback()` 失败时返回包含规则的重新提示
5. **添加 `PromptEngine.ts`**：协调 PromptGenerator + CommandParser + 多语言加载

---

## 三、架构问题

### 3.1 handlers.ts 过大（852 行）

**建议拆分**：
```
socket/
├── handlers/
│   ├── room.ts      # 房间事件
│   ├── game.ts      # 游戏事件
│   ├── agent.ts     # AI Agent 事件
│   └── broadcast.ts # 状态广播
└── index.ts
```

### 3.2 三种玩家类型处理分散

| 类型 | 连接方式 | 事件 | 决策来源 |
|------|----------|------|----------|
| `human` | Socket.io | `game:state` | 人类决策 |
| `ai-agent` | Socket.io（独立会话） | `agent:your_turn` | 外部 LLM 决策 |
| `ai-auto` | 无连接 | 内部调用 | AIAdapter 规则引擎 |

**问题**：`broadcastGameState` 函数同时处理三种类型，逻辑耦合严重。

### 3.3 AI Agent 断线降级未完成

当前逻辑只是检查 `aiControl.mode`，但：
- Agent 断线时没有更新 `disconnectedAt`
- 没有超时检测机制
- 重连恢复逻辑缺失

---

## 四、建议的架构改进

```
src/server/
├── game/              # 不变
├── room/              # 不变
├── agent/             # 新增：AI Agent 会话管理
│   ├── AgentSession.ts    # Agent 连接会话
│   ├── AgentRegistry.ts   # Agent 注册表
│   └── FallbackManager.ts # 断线降级管理
├── middleware/        # 重命名 prompt/ → middleware/
│   ├── PromptEngine.ts    # 合并 Generator + Parser
│   ├── CommandExecutor.ts # 指令执行器
│   └── locales/           # 多语言包
├── socket/
│   └── handlers/      # 拆分
└── index.ts
```

---

## 五、优先级

| 优先级 | 任务 | 工作量 |
|--------|------|--------|
| P0 | 新增 `room:createAI` 事件 | 2-4h |
| P0 | 完善多语言支持 | 1-2d |
| P1 | 拆分 handlers.ts | 2-4h |
| P1 | 实现 AI Agent 断线降级 | 1-4h |
| P2 | 重构架构（新增 agent/、middleware/） | 1-2d |

---

*本报告基于 Oracle Agent 分析生成*
