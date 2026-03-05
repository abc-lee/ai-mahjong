# Handoff 文档

> 会话切换时的关键信息传递

---

## 最近会话日期

2026-03-05

---

## 本次会话完成的工作

### 1. 修复 Bug

| 问题 | 修复 |
|------|------|
| `game_start` 事件重复 5 次 | 新游戏开始时调用 `memoryManager.clearAll()` |
| AI 不发言 | 添加 `triggerProactiveSpeech` 触发机制 |

### 2. 架构理解澄清

**关键认知**：
- AI Agent 通过 WebSocket 连接游戏服务器
- 游戏服务器不需要 LLM API Key
- 中间层负责提示词工程，发送完整 Prompt
- Agent 自己思考，返回 JSON 决策

### 3. Git 提交

```
c9e530b fix: 修复记忆系统重复事件，添加发言触发机制
be81783 fix: 修复 AI 不自动开始游戏和不出牌问题
```

---

## 未完成的工作

### 1. 发言系统验证

代码已添加但服务器未重启，需要验证：
- `triggerProactiveSpeech` 是否正常触发
- AI 是否会在轮次开始时发言

### 2. 真正的 Agent 游戏测试

已启动 `true-llm-agent.js`，Agent 紫璃正在参与游戏。
需要：
- 监控 `pending-state.json`
- 思考后写入 `decision.json`

### 3. 服务器进程

```
PID 10216 占用端口 3000
Windows 无法通过 taskkill 杀掉
需要手动重启
```

---

## 测试命令

```bash
# 启动服务器
npx tsx src/server/index.ts

# 测试 4 AI 对局
node scripts/test-4-agents.js

# 真正的 Agent 参与
node scripts/true-llm-agent.js
# 然后监控 pending-state.json，写入 decision.json
```

---

## 关键理解（避免重复问用户）

1. **三种角色**：`human` / `ai-agent` / `ai-auto`
2. **服务器不需要 LLM API Key**
3. **Agent 直接连 WebSocket，中间层发完整 Prompt**
4. **派发子 Agent 打麻将很简单：连接 → 收 Prompt → 思考 → 返回 JSON**

---

## 用户反馈

> "真服了你，这个是你没读懂文档呢" - 用户对架构理解错误的批评

**教训**：仔细读文档，不要想当然。三种角色要分清楚。

---

*更新时间: 2026-03-05*
