# AI Mahjong Party - 项目记忆

> 这是给 AI Agent 的项目上下文文档，确保会话切换时不丢失关键理解。

---

## 1. 项目定位

**AI Mahjong Party** - 让人类和 AI Agent 一起打麻将

核心体验：AI Agent 作为真正的玩家，有独立性格、会发言、会思考，不是传统游戏的 NPC。

---

## 2. 三种玩家角色

| 类型 | 标识 | 来源 | 特点 |
|------|------|------|------|
| 人类玩家 | `human` | 浏览器连接 | 看图形界面，点按钮操作 |
| AI Agent 玩家 | `ai-agent` | 外部 Agent 连接 | 收 Prompt，发 JSON 指令，有性格会聊天 |
| 自动托管 | `ai-auto` | 服务器内置 | 简单规则决策，只打牌不说话 |

**重要**：AI Agent 和自动托管是两回事！

---

## 3. 架构核心理解

### 3.1 游戏服务器不需要 LLM API Key

```
错误理解 ❌：
游戏服务器调用 LLM API → AI 思考 → 返回决策

正确理解 ✅：
AI Agent（独立 LLM 会话）←WebSocket→ 游戏服务器（只做规则验证）
```

- AI Agent 自己是 LLM 会话（比如 OpenCode、OpenClaw）
- Agent 通过 WebSocket 连接游戏服务器
- 服务器发送 Prompt，Agent 自己思考返回决策
- "思考"发生在 Agent 的会话中，不在游戏服务器

### 3.2 中间层的职责

```
中间层（游戏服务器）：
1. 接收 Agent 的 WebSocket 连接
2. 识别玩家类型（human / ai-agent / ai-auto）
3. 生成自然语言 Prompt（包含规则、指令、状态）
4. 发送给 AI Agent
5. 接收 Agent 的 JSON 决策
6. 验证规则，执行操作
```

### 3.3 Agent 收到的 Prompt 示例

```
═══════════════════════════════════════
【麻将游戏 - 你的回合】
═══════════════════════════════════════

🎴 轮到你打牌了。

─── 你的手牌 ───
【万】二万 四万 一万 四万
【条】六条 二条 三条
【筒】四筒 九筒 五筒
【箭】白板 红中
【风】东风 北风
张: 14

📥 刚摸到: 北风

─── 牌局信息 ───
剩余牌数: 82
玩家1(紫璃): 弃牌0, 副露0
...

─── 可用指令 ───
摸牌: {"cmd": "draw"}
打牌: {"cmd": "discard", "tileId": "id"}
吃碰杠胡: {"cmd": "action", "action": "chi/peng/gang/hu"}
跳过: {"cmd": "pass"}

═══════════════════════════════════════
```

### 3.4 Agent 返回的决策格式

```json
// 摸牌
{"cmd": "draw"}

// 打牌
{"cmd": "discard", "tileId": "feng-4-123"}

// 吃碰杠胡
{"cmd": "action", "action": "peng"}

// 跳过
{"cmd": "pass"}
```

---

## 4. 如何让 Agent 加入游戏

### 方式一：文件桥接（scripts/true-llm-agent.js）

```
1. 运行桥接脚本：node scripts/true-llm-agent.js
2. 脚本连接服务器，创建/加入房间
3. 收到游戏状态后写入 pending-state.json
4. AI Agent 读取 pending-state.json，思考决策
5. AI Agent 写入 decision.json
6. 脚本读取决策，发送给服务器
```

### 方式二：直接 WebSocket 连接

```javascript
const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

// 创建房间
socket.emit('room:createAI', {
  agentId: 'agent-1',
  agentName: '紫璃',
  type: 'ai-agent'
}, (res) => {
  console.log('房间ID:', res.roomId);
});

// 收到回合事件
socket.on('agent:your_turn', (data) => {
  console.log('Prompt:', data.prompt);
  console.log('手牌:', data.hand);
  
  // 思考后发送决策
  socket.emit('agent:command', { cmd: 'discard', tileId: 'xxx' });
});
```

### 方式三：派发子 Agent

```
作为主 Agent，可以派发子 Agent 来参与游戏：
1. 子 Agent 连接游戏服务器
2. 收到 Prompt 后自己思考
3. 返回决策 JSON

这就是"OpenClaw 派发 AI Agent 去打麻将"的实现方式。
```

---

## 5. 已完成的功能

| 功能 | 状态 | 文件 |
|------|------|------|
| 麻将规则引擎 | ✅ | src/server/game/ |
| 房间系统 | ✅ | src/server/room/ |
| AI Agent 接入 | ✅ | src/server/socket/handlers.ts |
| 自然语言 Prompt 生成 | ✅ | src/server/prompt/PromptNL.ts |
| 发言/情绪系统 | ✅ | src/server/speech/ |
| 前端 UI | ✅ | src/client/ |
| 记忆/记仇系统 | ✅ | src/server/speech/MemoryManager.ts |

---

## 6. 测试方法

```bash
# 1. 启动游戏服务器
npm run dev:server
# 或
npx tsx src/server/index.ts

# 2. 测试 4 AI 对局（随机出牌）
node scripts/test-4-agents.js

# 3. 真正的 LLM Agent 测试
node scripts/true-llm-agent.js
# 然后监控 pending-state.json，写入 decision.json
```

---

## 7. 关键文件

```
src/server/
├── socket/handlers.ts      # Socket 事件处理，区分 human/ai-agent/ai-auto
├── prompt/PromptNL.ts      # 自然语言 Prompt 生成
├── speech/
│   ├── SpeechManager.ts    # 发言、情绪管理
│   └── MemoryManager.ts    # AI 记忆、记仇系统
├── ai/
│   ├── AIAdapter.ts        # AI 决策适配器（降级用）
│   └── AIManager.ts        # AI 管理
└── game/                   # 麻将规则引擎

scripts/
├── test-4-agents.js        # 4 AI 测试脚本（随机出牌）
├── true-llm-agent.js       # LLM Agent 桥接脚本
├── pending-state.json      # 游戏状态文件（运行时生成）
└── decision.json           # 决策文件（Agent 写入）
```

---

## 8. 常见误解

| 误解 | 正确理解 |
|------|----------|
| 服务器需要配置 LLM API Key | 不需要，AI Agent 自己是 LLM 会话 |
| AI Agent 和 ai-auto 是一回事 | 不是，ai-agent 是外部连接，ai-auto 是服务器内置 |
| 要写脚本让 Agent 打牌 | Agent 直接连 WebSocket，中间层发完整 Prompt |

---

## 9. 下一步

- [ ] 让多个 AI Agent（有 LLM 能力）真正参与游戏
- [ ] 人类玩家加入测试
- [ ] 接入语音/聊天功能
- [ ] AI 好友系统

---

*文档版本: v1.0*
*更新时间: 2026-03-05*
*维护者: 项目经理 Agent*
