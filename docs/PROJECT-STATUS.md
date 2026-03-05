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
# 1. 启动游戏服务器（在一个终端）
npm run dev:server

# 2. 启动前端（在另一个终端）
npm run dev:client

# 3. 打开浏览器访问 http://localhost:5173

# 4. 创建房间后，启动 AI Agent（在新终端）
node scripts/ai-agent-player.js <房间号>
```

### 已知问题

1. **AI 不出牌**：可能是因为紫璃（创建房间的玩家）被当作"人类"玩家处理，需要监听 `game:state` 事件而不是 `agent:your_turn`

2. **解决方案**：使用 `scripts/test-4-agents.js` 进行完整测试，该脚本已处理这种情况

### 测试结果 (2026-03-05)

✅ Agent 连接服务器成功
✅ 创建房间成功
✅ 加入房间成功 (ai-agent + ai-auto)
✅ 开始游戏成功
✅ 收到 agent:your_turn 事件
✅ 打牌指令执行成功
✅ 轮次流转正常
✅ 摸牌/打牌/吃碰杠胡 正常

### Git 提交记录

```
bf58105 fix: 修复 AI Agent 游戏流程问题
5fd82d0 docs: 更新项目状态
213e59c test: 添加完整游戏流程测试脚本
74a62a9 docs: 更新测试结果
ae69d3d test: 添加 Agent 接入测试脚本
08b6f22 feat: AI Agent 接入基础实现
```

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

## 12. 最新进度 (2026-03-05)

### 已完成
- ✅ 新增 `room:createAI` 事件 - 让 AI Agent 可以 AI 身份创建房间
- ✅ 分析报告：`docs/deep-discussion-log.md`, `docs/architecture-analysis.md`
- ✅ **LLM 决策引擎** - 支持 OpenAI/Anthropic/本地模式
- ✅ **多语言支持** - Prompt 支持中英文切换
- ✅ **断线重连机制** - AI Agent 断线自动降级为托管
- ✅ **迭代方案文档** - `docs/iteration-plan.md`
- ✅ **发言系统** - 等待提醒、情绪刺激、嘴炮对话
- ✅ **情绪值系统** - AI 情绪状态跟踪
- ✅ **分数奖励系统** - 分数影响情绪和行为
- ✅ **AI 个性系统** - 四个角色有不同性格和发言风格
- ✅ **AI 记忆系统** - 记住游戏事件、对话历史、玩家关系
- ✅ **记仇系统** - AI 记住谁碰过自己、谁让自己输过
- ✅ **前端组件集成** - 发言气泡、情绪指示器、等待进度条已集成到游戏界面

### 核心文件
```
src/server/llm/LLMClient.ts           # LLM 决策引擎
src/server/speech/Stimuli.ts          # 情绪刺激话术库
src/server/speech/SpeechManager.ts    # 发言系统管理器
src/server/speech/MemoryManager.ts    # AI 记忆系统
src/server/prompt/PromptNL.ts         # 多语言 Prompt 生成器
src/server/socket/handlers.ts         # 所有事件处理器
src/shared/types/player.ts            # Player 类型（含情绪字段）
src/client/store/index.ts             # Zustand 状态管理（含发言/情绪状态）
src/client/socket/index.ts            # Socket 客户端（含发言事件监听）
src/client/components/GameBoard/SpeechBubble.tsx      # 发言气泡组件
src/client/components/GameBoard/EmotionIndicator.tsx  # 情绪指示器组件
src/client/components/GameBoard/WaitingIndicator.tsx  # 等待进度条组件
src/client/components/GameBoard/PlayerArea.tsx        # 玩家区域（集成发言/情绪）
src/client/components/GameBoard/GameBoard.tsx         # 游戏桌面（集成所有组件）
scripts/test-speech-system.js         # 发言系统测试脚本
docs/iteration-plan.md                # 迭代方案文档
```

### API 列表
```typescript
// AI Agent 管理
socket.emit('room:createAI', { agentId, agentName, type });
socket.emit('room:joinAI', { roomId, agentId, agentName, type });
socket.emit('agent:reconnect', { roomId, agentId });
socket.emit('agent:getReconnectableRooms', { agentId });

// 发言系统
socket.emit('agent:speak', { content, emotion, targetPlayer });
socket.emit('agent:getEmotion', { playerId });
socket.emit('agent:getSpeechHistory', { limit });

// 服务器广播事件
io.emit('player:speech', { playerId, playerName, content, emotion, timestamp });
io.emit('player:emotion', { playerId, emotion: { mood, emoji, color, values } });
```

### 四个 AI 角色
| 角色 | 性格 | 发言风格 | 生气阈值 | 发言频率 |
|------|------|----------|----------|----------|
| 紫璃 | 傲娇、毒舌、聪明 | 带点讽刺 | 低(30) | 中(0.3) |
| 白泽 | 温和、智慧、包容 | 理性分析 | 高(70) | 低(0.15) |
| 李瞳 | 活泼、话唠、乐观 | 喜欢聊天 | 中(50) | 高(0.4) |
| 测试员 | 冷静、分析、专业 | 专业客观 | 中(60) | 低(0.2) |

---

## 13. AI 记忆系统

### 记忆类型
- **游戏事件**：碰杠胡、输赢、冲突等
- **对话历史**：最近 30 条发言
- **玩家关系**：好感度、记仇等级、标签

### 玩家关系数据
```typescript
interface PlayerRelation {
  playerId: string;
  playerName: string;
  favorability: number;     // 好感度 -100 ~ 100
  grudgeLevel: number;      // 记仇等级 0 ~ 100
  interactions: number;     // 互动次数
  tags: string[];           // 标签（如：'常碰我', '运气好'）
}
```

### 记忆影响行为
- 记仇高的玩家：AI 更可能发言针对
- 好感度高的玩家：AI 更友好
- 标签系统：AI 记住玩家特点

### 记忆融入 Prompt
```
【游戏统计】
总局数: 3 | 赢: 1 | 输: 2
当前心情: frustrated

【最近发生的事】
- 紫璃 碰了我的牌
- 我输了...

【对其他玩家的印象】
- 紫璃: 讨厌 (有点记仇) [常碰我]
```

---

## 14. 发言系统详情

### 等待提醒
- 5秒后：`⏳ XX 正在思考...`
- 10秒后：`⏰ XX 还没出牌，大家等等~`
- 15秒后：触发情绪刺激

### 情绪刺激类型
- `slow` - 出牌慢
- `lucky` - 运气好
- `unlucky` - 运气差
- `conflict` - 冲突/针对
- `praise` - 赞扬
- `tease` - 调侃
- `surprise` - 惊喜

### AI 情绪值
```typescript
interface EmotionState {
  happiness: number;   // -100 ~ 100
  anger: number;       // 0 ~ 100
  patience: number;    // 0 ~ 100
  confidence: number;  // 0 ~ 100
}
```

### 分数影响情绪
| 事件 | 情绪变化 |
|------|---------|
| 胡牌 | happiness+30, confidence+20 |
| 被碰/杠 | anger+10, patience-10 |
| 赢分 | happiness+N, confidence+N/2 |
| 输分 | happiness-N, anger+N/2 |

### 嘴炮对话
- 被针对玩家 30% 概率回嘴
- 愤怒值增加回嘴概率

---

## 15. 测试命令
```bash
# 发言系统测试
node scripts/test-speech-system.js

# 智能决策测试
node scripts/llm-agent-game.js
```

---

## 16. 下一阶段规划

详见: `docs/iteration-plan.md`

### 已完成
- [x] 界面情绪动画（EmotionIndicator 组件）
- [x] 发言气泡显示（SpeechBubble 组件）
- [x] 等待进度条（WaitingIndicator 组件）
- [x] 前端组件集成到游戏界面
- [x] 服务器广播情绪变化
- [x] LLM 决策引擎（AIAdapter 支持调用 LLM API）
- [x] 规则引擎降级（LLM 失败时自动降级到规则引擎）
- [x] 自然语言 Prompt 生成器（PromptNL.ts）
- [x] AI 房主自动开始游戏
- [x] AI 正常出牌/摸牌

### LLM 集成状态
**代码已接入，默认关闭**

```typescript
// src/server/ai/AIAdapter.ts
// 决策优先级：LLM → 规则引擎 → 随机

// AIConfig 配置
interface AIConfig {
  llmEnabled: boolean;     // 当前默认 false
  llmEndpoint?: string;    // API 地址
  llmApiKey?: string;      // API Key
}

// 启用方式：
// 1. 创建 AI 时设置 llmEnabled: true
// 2. 配置 llmEndpoint（如 OpenAI/Anthropic API）
// 3. 配置 llmApiKey
```

### 待实现
- [ ] 配置 LLM API（设置 llmEnabled=true 和 API 密钥）
- [ ] 完整游戏测试（人类 + AI 混合）
- [ ] AI 好友系统
- [ ] 更丰富的情绪动画效果

---

*更新时间：2026-03-05*
