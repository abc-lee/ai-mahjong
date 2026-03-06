# Handoff 文档

> 会话切换时的关键信息传递

---

## 最近会话日期

2026-03-06

---

## 本次会话完成的工作

### 1. 修复 Bug

| 问题 | 修复 |
|------|------|
| Room 页面卡在加载中 | 添加 useEffect，根据 URL roomId 重新加入 |

### 2. 新增 Agent 性格

新增 3 个性格（共 7 个）：

| 性格 | 特点 | 发言频率 |
|------|------|---------|
| 小狐狸 | 狡猾调皮，爱开玩笑 | 35% |
| 老师傅 | 沉稳话少，经验丰富 | 10% |
| 小可爱 | 软萌乐观，喜欢颜文字 | 45% |

### 3. AI 好友系统

```
好友管理器：src/server/friend/FriendManager.ts
Socket 事件：friend:add, friend:remove, friend:list
关系等级：陌生人→熟人→朋友→好友→挚友
亲密度：0-100，一起玩牌增加
```

### 4. Git 提交

```
f5ccab7 feat: 实现 AI 好友系统
4f4b394 feat: 添加更多 Agent 性格和发言场景
e9fd7f4 fix: 修复 Room 页面 currentRoom 为空时卡在加载中的问题
485d86a feat: 完善 Agent 提示词工程
c9e530b fix: 修复记忆系统重复事件
be81783 fix: 修复 AI 不自动开始游戏
```

---

## 架构核心理解

**三种玩家角色**：
| 类型 | 标识 | 说明 |
|------|------|------|
| 人类玩家 | `human` | 浏览器连接，点按钮 |
| AI Agent 玩家 | `ai-agent` | 外部 Agent 连接，收 Prompt 发 JSON |
| 自动托管 | `ai-auto` | 服务器内置，规则决策 |

**服务器不需要 LLM API Key** - Agent 自己是 LLM 会话

**中间层职责**：
1. 识别玩家类型
2. 生成完整 Prompt（规则 + 状态 + 指令）
3. 发送给 Agent，接收 JSON 决策
4. 验证规则，执行操作

---

## 测试命令

```bash
# 启动服务器
npx tsx src/server/index.ts

# 启动前端
npm run dev:client

# 测试 4 AI 对局
node scripts/test-4-agents.js

# Agent 文件桥接
node scripts/true-llm-agent.js
```

---

## 关键文件

```
src/server/
├── friend/FriendManager.ts    # 好友系统（新增）
├── speech/SpeechManager.ts    # 发言/性格系统
├── prompt/PromptNL.ts         # 提示词工程
└── socket/handlers.ts         # 事件处理

src/client/
├── components/Room/Room.tsx   # 房间页面（已修复）
└── components/Lobby/          # 大厅
```

---

## 待完成

- [ ] 前端好友列表 UI
- [ ] 邀请好友加入游戏
- [ ] 好友亲密度显示

---

*更新时间: 2026-03-06*
