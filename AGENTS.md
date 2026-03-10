# AI Mahjong Party - 项目记忆

> 这是给 AI Agent 的项目上下文文档，确保会话切换时不丢失关键理解。

---

## 1. 项目定位

**AI Mahjong Party** - 让人类和 AI Agent 一起打麻将

核心体验：AI Agent 作为真正的玩家，有独立性格、会发言、会思考，不是传统游戏的 NPC。

**使用场景**：私人游戏，主Agent作为用户的个人AI助理，启动游戏、派发AI、管理对局。

---

## 2. 三种玩家角色

| 类型 | 标识 | 来源 | 特点 |
|------|------|------|------|
| 人类玩家 | `human` | 浏览器连接 | 看图形界面，点按钮操作 |
| AI Agent 玩家 | `ai-agent` | 主Agent派发的子Agent | 收 Prompt，发 JSON 指令，有性格会聊天 |
| NPC | `npc` | 服务器内置 | 简单规则决策，只打牌不说话 |

**重要**：AI Agent 和 NPC 是两回事！

---

## 3. 游戏流程

### 3.1 用户打开页面
1. 用户说"准备打游戏"
2. 主Agent启动游戏服务器
3. 主Agent返回链接给用户
4. 用户点击链接进入游戏界面

### 3.2 选择方位
1. 游戏界面弹出方位选择弹窗
2. 显示四个方位（东南西北）的座位图
3. 已占用的位置灰显
4. 点击选择自己的位置（先到先得）
5. 冲突时提示"该位置已被占用，请选择其他位置"

### 3.3 等待玩家
1. 第一个进入的人有"开始"按钮
2. 游戏开始前可以聊天
3. 用户可通过独立通话渠道让主Agent派发AI

### 3.4 开始游戏
1. 用户点击"开始"或说"开始"
2. 或4个位置都满了自动开始

---

## 4. 主Agent派发AI

主Agent通过派发子Agent连接游戏服务器，不是调用服务器接口。

### 4.1 派发方式
```javascript
// 子Agent连接游戏服务器
const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

// 加入游戏
socket.emit('room:joinAI', {
  roomId: '当前游戏ID',
  agentId: 'agent-xxx',
  agentName: '紫璃',
  type: 'ai-agent'  // 或 'npc'
});

// 收到轮次事件
socket.on('agent:your_turn', (data) => {
  // data.prompt 包含完整游戏状态
  // 思考后发送决策
  socket.emit('agent:command', {
    cmd: 'discard',
    tileId: 'wan-1-xxx'
  });
});
```

### 4.2 踢AI
主Agent断开子Agent的WebSocket连接即可，不需要服务器接口。

---

## 5. 架构核心理解

### 5.1 游戏服务器不需要 LLM API Key

```
错误理解 ❌：
游戏服务器调用 LLM API → AI 思考 → 返回决策

正确理解 ✅：
AI Agent（独立 LLM 会话）←WebSocket→ 游戏服务器（只做规则验证）
```

- AI Agent 自己是 LLM 会话（比如 OpenCode、OpenClaw）
- Agent 通过 WebSocket 连接游戏服务器
- 服务器发送 Prompt，Agent 自己思考返回决策

### 5.2 中间层的职责

```
中间层（游戏服务器）：
1. 接收 Agent 的 WebSocket 连接
2. 识别玩家类型（human / ai-agent / npc）
3. 生成自然语言 Prompt（包含规则、指令、状态）
4. 发送给 AI Agent
5. 接收 Agent 的 JSON 决策
6. 验证规则，执行操作
```

### 5.3 Agent 收到的 Prompt 示例

```
═══════════════════════════════════════
【麻将游戏 - 你的回合】
═══════════════════════════════════════

🎴 轮到你打牌了。

─── 你的手牌 ───
【万】二万 四万 一万 四万
【条】六条 二条 三条
...

─── 可用指令 ───
摸牌: {"cmd": "draw"}
打牌: {"cmd": "discard", "tileId": "id"}
吃碰杠胡: {"cmd": "action", "action": "chi/peng/gang/hu"}
跳过: {"cmd": "pass"}

═══════════════════════════════════════
```

---

## 6. Agent 行为约束规则

### 6.1 MUST DO（必须遵守）

| 规则 | 说明 |
|------|------|
| 使用轻量会话模式 | 麻将 Agent 只在对话中思考，不创建持久编程环境 |
| 直连 WebSocket | Agent 通过 socket.io-client 直接连接游戏服务器 |
| 使用预定义指令集 | 只发送服务器允许的 JSON 指令格式 |

### 6.2 MUST NOT DO（禁止事项）

| 规则 | 说明 |
|------|------|
| 禁止派发编程型 Agent | 麻将 Agent 不应再派发子 Agent |
| 禁止文件系统访问 | 不要读取/写入游戏服务器的文件 |
| 禁止 bash/process 执行 | 不要在游戏中执行系统命令 |

---

## 7. 已完成的功能

| 功能 | 状态 | 文件 |
|------|------|------|
| 麻将规则引擎 | ✅ | src/server/game/ |
| 游戏会话管理 | ✅ | src/server/room/ |
| AI Agent 接入 | ✅ | src/server/socket/handlers.ts |
| 自然语言 Prompt 生成 | ✅ | src/server/prompt/PromptNL.ts |
| 发言/情绪系统 | ✅ | src/server/speech/ |
| 新前端 UI | ✅ | src/client-new/ |
| 记忆/记仇系统 | ✅ | src/server/speech/MemoryManager.ts |
| 吃碰杠胡按钮交互 | ✅ | src/client-new/js/game.js |
| 手牌排序显示 | ✅ | src/client-new/js/tiles.js |
| 游戏结束弹窗 | ✅ | src/client-new/js/game.js |
| 再来一局功能 | ✅ | src/server/room/RoomManager.ts |
| 弃牌区/副露区显示 | ✅ | src/client-new/js/tiles.js, game.js |

---

## 8. 关键文件

```
src/client-new/           # 新UI客户端
├── index.html            # 主入口
└── js/
    ├── socket.js         # Socket.io客户端
    ├── store.js          # 状态管理
    ├── tiles.js          # 牌渲染、排序
    ├── game.js           # 游戏逻辑、操作按钮
    └── main.js           # 主入口

src/server/
├── socket/handlers.ts    # Socket事件处理
├── prompt/PromptNL.ts    # Prompt生成
├── speech/
│   ├── SpeechManager.ts  # 发言、情绪管理
│   └── MemoryManager.ts  # AI记忆、记仇系统
├── ai/
│   ├── AIAdapter.ts      # AI决策适配器（降级用）
│   └── AIManager.ts      # AI管理
└── game/                 # 麻将规则引擎

scripts/
├── join-player-room.js   # 派发AI加入玩家房间
├── test-4-agents.js      # 4 AI测试脚本
└── true-llm-agent.js     # LLM Agent桥接脚本
```

---

## 9. 运行命令

### 9.1 完整启动流程

```bash
# 第一步：启动游戏服务器（后台运行）
cd E:/game/ai-mahjong
npx tsx src/server/index.ts &

# 第二步：启动客户端（后台运行）
npx vite --config vite.client-new.config.ts --port 5174 &

# 第三步：告诉用户打开 http://localhost:5174

# 第四步：用户进入后，查询房间ID
curl -s http://localhost:3000/api/rooms

# 第五步：派发AI加入（执行3次加入3个AI）
node scripts/join-player-room.js <roomId> &
node scripts/join-player-room.js <roomId> &
node scripts/join-player-room.js <roomId> &
```

### 9.2 快速命令参考

```bash
# 启动服务器
npx tsx src/server/index.ts &

# 启动客户端
npx vite --config vite.client-new.config.ts --port 5174 &

# 查询房间
curl -s http://localhost:3000/api/rooms

# 派发AI（需要替换roomId）
node scripts/join-player-room.js <roomId> &
```

### 9.3 客户端地址

- **新UI客户端**：http://localhost:5174
- **服务器API**：http://localhost:3000
- **房间列表**：http://localhost:3000/api/rooms

---

## 10. 待修复问题

| 问题 | 状态 | 说明 |
|------|------|------|
| 番型计算 | ⚠️ | 胡牌时番型为空，导致分数为0 |
| 分数显示 | ⚠️ | 需要检查 ScoreCalculator |

---

## 11. 本次会话改进记录

### UI 改进
- 新增纯 HTML/JS 客户端 (`src/client-new/`)
- 手牌排序显示（万>条>筒>风>箭）
- 操作按钮：摸、吃、碰、杠、胡、过
- 吃牌交互：悬停时相关牌立起，点击执行吃牌
- 游戏结束弹窗：显示赢家、番型、分数变化
- 再来一局按钮
- **弃牌区和副露区显示**：四个玩家位置都添加了弃牌区和副露区
- **小牌尺寸调整**：按原UI设计稿，弃牌/副露牌尺寸为 24×36px（手机）/ 32×48px（桌面）
- **小牌图形化渲染**：万、条、筒、风、箭牌在小尺寸下都能正确显示图形化内容
- **一条小鸟图标**：小牌的一条显示小鸟图标

### 服务器改进
- 新增 `/api/rooms` 接口查询等待中的房间
- 修复 AI 在 action 阶段（吃碰杠胡）没收到通知的问题
- 修复 `game:state` 事件发送 `availableActions`
- 允许从 `finished` 状态开始新游戏
- 改进 AI 脚本保持连接、重连机制

### Bug 修复
- 修复 `prevState` 拼写错误
- 修复 `room.players` undefined 问题
- 修复箭牌（中发白）渲染（`jian` vs `dragon`）
- 修复操作按钮不消失的问题
- 修复流局显示"玩家胡牌"的问题
- 修复南边容器缺失 `id="player-south"` 导致弃牌区不显示的问题

---

*文档版本: v2.2*
*更新时间: 2026-03-10*
