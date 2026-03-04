# AI Mahjong Party - 项目状态

> 更新时间：2026-03-04
> 负责人：OpenCode Agent (Project Manager)

---

## 1. 项目定位

**这不是传统游戏，而是 AI Agent 娱乐陪伴体验。**

- AI Agent 作为真正的玩家，有独立会话、独立性格
- 人类用户享受和 AI 一起玩的乐趣
- AI 会吵架、吐槽、情绪化

---

## 2. 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                     中间层 (消息分发 + AIAdapter)             │
│                                                             │
│   人类 → 发送图形界面数据                                     │
│   AI → 发送 Prompt 文本                                      │
└─────────────────────────────────────────────────────────────┘
                              ↑↓
┌─────────────────────────────────────────────────────────────┐
│                     GameEngine (纯规则层)                    │
│   不区分人/AI，只验证规则                                     │
└─────────────────────────────────────────────────────────────┘
                              ↑↓
         ┌────────────────────┴────────────────────┐
         ↓                                          ↓
    人类玩家                                      AI Agent
  (浏览器)                                       (独立会话)
```

---

## 3. 模块状态

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| GameEngine | `src/server/game/GameEngine.ts` | ✅ 完整 | 纯规则，无外部依赖 |
| RoomManager | `src/server/room/RoomManager.ts` | ✅ 完整 | 已添加 addAIPlayer |
| AIAdapter | `src/server/ai/AIAdapter.ts` | ✅ 完整 | 三层决策（LLM→规则→随机） |
| AIManager | `src/server/ai/AIManager.ts` | ✅ 完整 | 生命周期管理 |
| PromptGenerator | `src/server/prompt/PromptGenerator.ts` | ✅ 完整 | Prompt 生成 |
| RuleEngine | `src/server/ai/RuleEngine.ts` | ⚠️ 基础 | 规则决策过于简单 |
| Socket Handlers | `src/server/socket/handlers.ts` | ✅ 完整 | 已添加 AI 事件 |
| Socket Setup | `src/server/socket/index.ts` | ✅ 完整 | 已注册 AI 事件 |

---

## 4. API 清单

### 人类玩家事件

| 事件 | 说明 | 状态 |
|------|------|------|
| `room:create` | 创建房间 | ✅ |
| `room:join` | 加入房间 | ✅ |
| `room:leave` | 离开房间 | ✅ |
| `room:ready` | 准备 | ✅ |
| `game:start` | 开始游戏 | ✅ |
| `game:draw` | 摸牌 | ✅ |
| `game:discard` | 打牌 | ✅ |
| `game:action` | 吃碰杠胡 | ✅ |
| `game:pass` | 跳过 | ✅ |

### AI 玩家事件

| 事件 | 说明 | 状态 |
|------|------|------|
| `room:joinAI` | AI 加入房间 | ✅ 已实现 |
| `ai:decision` | AI 发送决策 | ✅ 已实现 |
| `game:prompt` | 发送 Prompt 给 AI | ⏳ 待实现 |

---

## 5. 数据流

### AI 加入房间流程

```
1. AI Agent 连接服务器 (WebSocket)
2. 发送 room:joinAI { roomId, agentId, agentName, personality }
3. 服务端创建 AI 玩家 (RoomManager.addAIPlayer)
4. 服务端创建 AIAdapter (AIManager.createAdapter)
5. 广播 room:updated 给房间所有人
6. AI 收到 room:joined 确认
```

### AI 决策流程

```
1. 服务端发送 game:prompt 给 AI (待实现)
2. AI 处理 Prompt，返回 ai:decision
3. 服务端执行决策 (GameEngine)
4. 广播游戏状态
```

---

## 6. 待完成任务

### Phase 1 - 核心（待完成）

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 发送 Prompt 给 AI | P0 | broadcastGameState 中对 AI 发送 game:prompt |
| 测试 AI 连接流程 | P0 | 验证 AI 可以加入房间并参与游戏 |

### Phase 2 - 增强

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 增强 RuleEngine | P1 | 更智能的规则决策 |
| AI 性格差异化 | P1 | 根据性格生成不同 Prompt |
| 自动填充 AI | P2 | 人数不足时自动补充 AI |

---

## 7. 文档清单

```
docs/
├── ai-player-architecture.md   # 核心架构设计 v3.0
├── ai-mahjong-tech-spec.md     # 技术规范 v3.0
├── ai-agent-prompt-design.md   # Prompt 设计
├── ai-mahjong-requirements.md  # 产品需求
├── PROJECT-STATUS.md           # 项目状态（本文件）
└── tasks/                      # 任务文档
```

---

## 8. 2026-03-04 工作记录

### 完成事项

1. **重新理解架构**：AI Agent 作为真正玩家，不是 NPC
2. **整理文档**：删除重复文件，更新核心架构文档
3. **架构分析**：Oracle + Explore 深度分析
4. **实现 AI 连接**：
   - RoomManager.addAIPlayer()
   - handleJoinAI 事件
   - handleAIDecision 事件
   - 注册 AI 事件

### 遗留问题

- broadcastGameState 需要对 AI 发送 Prompt
- RuleEngine 规则决策过于简单
- AI 性格系统未实现

---

*下次继续：实现 game:prompt 事件发送*
