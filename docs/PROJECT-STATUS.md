# AI Mahjong Party - 项目状态

> 更新时间：2026-03-05
> 负责人：OpenCode Agent (Project Manager)

---

## 1. 项目定位

**AI Agent 娱乐陪伴体验，灵活的玩家组合。**

### 玩家组合规则
- **最少**：1 人 + 1 AI
- **最多**：4 人
- **支持**：任意组合（1人+3AI、2人+2AI、3人+1AI、4人全真人等）

### 三种角色

| 角色 | 说明 | 控制者 |
|------|------|--------|
| **AI 助理 (OpenClaw)** | 用户的 24 小时管家，启动游戏、管理 AI Agent | 用户安装 |
| **AI Agent 玩家** | 独立会话，有性格，会聊天，参与游戏 | AI 助理创建 |
| **自动托管** | 服务器内置，只打牌不说话，简单规则 | 中间层执行 |

---

## 2. 游戏启动流程

```
用户: "我想打麻将"
AI 助理: 启动服务器 → 加入房间 → 发送地址给用户

用户进入房间后:

场景1: "你叫三个 AI 陪我打，你去忙别的"
AI 助理: 创建 3 个 AI Agent → 自己离开 → 结果: 1人+3AI

场景2: "你拉两个 AI，再加一个自动托管"
AI 助理: 创建 2 个 AI Agent → 指令中间层加自动托管 → 结果: 1人+1助理+1AI+1自动

场景3: 用户分享链接给朋友
朋友加入 → "你拉一个 AI" → 结果: 2人+1AI
```

---

## 3. 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    中间层（提示词工程系统）                    │
│                                                             │
│  功能：                                                      │
│  1. 多语言支持 - 外置 JSON，根据用户语言切换                   │
│  2. 规则注入 - AI 连接时发送游戏规则、指令集                   │
│  3. 指令解析 - 识别 AI 发来的 JSON 指令，执行操作              │
│  4. 错误恢复 - 无法识别时重发规则                             │
│  5. 状态同步 - 每次轮到 AI 都发送手牌状态                      │
└─────────────────────────────────────────────────────────────┘
                               ↑↓
┌─────────────────────────────────────────────────────────────┐
│                     GameEngine (纯规则层)                    │
│   不区分人/AI，只验证规则                                     │
└─────────────────────────────────────────────────────────────┘
                               ↑↓
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │   人类玩家   │    │  AI Agent   │    │  自动托管    │
     │  (浏览器)    │    │ (独立会话)   │    │ (服务器内置) │
     │             │    │ 有性格/会聊天 │    │ 只打牌不说话 │
     └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 4. AI Agent 接入流程

```
AI 助理创建 AI Agent:
1. AI 助理给自己下达任务（分身）
2. 新会话 = 新 Agent
3. Agent 连接游戏服务器 WebSocket
4. 发送 room:joinAI { roomId, agentId, agentName }
5. 服务端创建 AI 玩家
6. 服务端发送规则 + 指令集给 Agent
7. Agent 参与游戏

AI Agent 断线时:
1. 检测到超时/断线
2. 自动托管接管（名字不变，状态变化）
3. Agent 重连后恢复控制
```

---

## 5. 指令系统（待设计）

### AI Agent 发送格式：JSON

```json
// 聊天
{"cmd": "chat", "message": "哈哈，这把我要赢了！"}

// 打牌
{"cmd": "discard", "tileId": "wan-1-0"}

// 吃碰杠胡
{"cmd": "action", "action": "chi", "tiles": ["tiao-6-0", "tiao-8-0"]}

// 跳过
{"cmd": "pass"}

// 让中间层添加自动托管
{"cmd": "add_auto_player"}
```

### 多语言文件结构

```
src/server/prompt/
├── PromptEngine.ts       # 提示词引擎
├── CommandParser.ts      # 指令解析器
├── locales/              # 多语言包
│   ├── zh-CN.json
│   ├── en-US.json
│   └── ja-JP.json
├── templates/            # 状态模板
│   ├── welcome.md
│   ├── your-turn.md
│   └── error.md
└── commands.json         # 指令集定义
```

---

## 6. 模块状态

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| GameEngine | `src/server/game/GameEngine.ts` | ✅ 完整 | 麻将规则可玩 |
| RoomManager | `src/server/room/RoomManager.ts` | ✅ 完整 | 多房间支持 |
| AIAdapter | `src/server/ai/AIAdapter.ts` | ⚠️ 需改造 | 要支持真正的 Agent 连接 |
| AIManager | `src/server/ai/AIManager.ts` | ⚠️ 需改造 | Agent 生命周期管理 |
| PromptGenerator | `src/server/prompt/PromptGenerator.ts` | ⚠️ 需重构 | 改为提示词工程系统 |
| Socket Handlers | `src/server/socket/handlers.ts` | ⚠️ 需补充 | Agent 指令处理 |
| 前端 UI | `src/client/` | ✅ 基础完成 | 小 Bug 和优化 |

---

## 7. 当前任务

### Phase 1 - AI Agent 接入

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 1 | 完善 Player 类型定义 | ✅ 完成 | 区分 human / ai-agent / ai-auto |
| 2 | 实现指令解析器 CommandParser | ✅ 完成 | 解析 JSON 指令 |
| 3 | 补充 Socket Handler | ✅ 完成 | handleAgentCommand |
| 4 | 修改 broadcastGameState | ✅ 完成 | 区分 ai-agent/ai-auto |
| 5 | 创建测试脚本 | ✅ 完成 | scripts/test-agent-connect.ts |
| 6 | 运行测试 | ⏳ 待执行 | |

### 测试方法

```bash
# 1. 启动游戏服务器
npm run dev:server

# 2. 在另一个终端运行测试
npx ts-node scripts/test-agent-connect.ts
```

### 测试结果 (2026-03-05)

✅ Agent 连接服务器成功
✅ 创建房间成功
✅ 加入房间成功 (ai-agent + ai-auto)
✅ 开始游戏成功
✅ 收到 agent:your_turn 事件
✅ 打牌指令执行成功

待优化：
- 需要测试完整一局游戏流程
- 需要测试吃碰杠胡操作
- 需要测试 Agent 断线降级

### Phase 2 - Prompt 迭代

| 任务 | 说明 |
|------|------|
| 启动 4 Agent 测试 | 实际打牌，监测行为 |
| 收集问题 | 无法识别的指令、打错牌等 |
| 迭代 Prompt | 完善规则、指令集 |

### Phase 3 - 完善

| 任务 | 说明 |
|------|------|
| Bug 修复 | 游戏逻辑 Bug |
| 界面优化 | UI/UX 改进 |

---

## 8. 工作记录

### 2026-03-05

**讨论内容**：
1. 澄清项目定位：灵活的玩家组合，不是固定的 1人+3AI
2. 明确三种角色：AI 助理 / AI Agent 玩家 / 自动托管
3. 理解游戏启动流程：AI 助理启动、创建 Agent、管理游戏
4. 认识中间层本质：复杂的提示词工程系统
5. 确定指令格式：JSON
6. 确定开发顺序：先接入 Agent → 再迭代 Prompt → 最后修 Bug

**下一步**：
1. 完善设计文档
2. 分解模块任务
3. 开始编码实现 Agent 接入

---

## 9. 文档清单

```
docs/
├── PROJECT-STATUS.md           # 项目状态（本文件）
├── ai-player-architecture.md   # 核心架构设计
├── ai-mahjong-tech-spec.md     # 技术规范
├── ai-agent-prompt-design.md   # Prompt 设计
├── ai-mahjong-requirements.md  # 产品需求
└── tasks/                      # 任务文档
```

---

## 10. 相关文档

- `docs/ai-agent-integration-design.md` - AI Agent 接入设计方案
- `docs/ai-agent-integration-tasks.md` - AI Agent 接入任务清单
- `docs/CHANGELOG.md` - 更新日志

---

## 11. Git 提交记录

```
213e59c test: 添加完整游戏流程测试脚本
74a62a9 docs: 更新测试结果
ae69d3d test: 添加 Agent 接入测试脚本
08b6f22 feat: AI Agent 接入基础实现
```

---

*更新时间：2026-03-05*
