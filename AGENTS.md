# AI Mahjong Party - 项目记忆

> 这是给 AI Agent 的项目上下文文档，确保会话切换时不丢失关键理解。

---

## 1. 项目定位

**AI Mahjong Party** - 让人类和 AI Agent 一起打麻将

核心体验：AI Agent 作为真正的玩家，有独立性格、会发言、会思考，不是传统游戏的 NPC。

**游戏的灵魂**：AI 之间会互动、吵架、记仇。打麻将只是载体，真正的乐趣是和 AI 们社交。

**使用场景**：私人游戏，主Agent作为用户的个人AI助理，启动游戏、派发AI、管理对局。

---

## 2. 三种玩家角色

| 类型 | 标识 | 来源 | 特点 |
|------|------|------|------|
| 人类玩家 | `human` | 浏览器连接 | 看图形界面，点按钮操作 |
| AI Agent 玩家 | `ai-agent` | 服务器调用 LLM | 有性格、会发言、会互动 |
| NPC | `npc` | 服务器内置 | 简单规则决策，只打牌不说话 |

**重要**：AI Agent 和 NPC 是两回事！AI Agent 用 LLM 做决策和发言，NPC 用规则引擎。

---

## 3. 游戏流程

### 3.1 启动游戏
```bash
# 启动游戏服务器
npx tsx src/server/index.ts &

# 启动前端
npx vite --config vite.client-new.config.ts --port 5174 &
```

### 3.2 用户进入游戏
1. 打开 http://localhost:5174
2. 输入名字，选择座位
3. 点击设置⚙️配置 LLM 和 AI 玩家
4. 点击"开始游戏"
5. 系统自动根据配置添加 AI/NPC 玩家

### 3.3 设置 LLM
- 选择预设提供商（MiniMax、DeepSeek、Qwen、OpenAI 等）
- 填写 API Key
- 测试连接
- 保存

### 3.4 配置 AI 玩家
- 设置 AI 数量和 NPC 数量
- 为每个 AI 设置名字、性别、性格
- 可点击"AI生成名字"让 LLM 生成

---

## 4. AI Agent 架构

### 4.1 服务器直连 LLM 模式（当前实现）

```
游戏状态 → AIAdapter.callLLM() → LLM API → 解析响应 → 决策 + 发言
                                              ↓
                                        广播给所有玩家
```

**关键文件**：
- `src/server/ai/AIAdapter.ts` - AI 决策适配器
- `src/server/ai/EventQueue.ts` - 事件队列系统
- `src/server/llm/LLMClient.ts` - LLM 客户端

### 4.2 提示词设计（参考 OpenClaw）

```
你是麻将玩家"{名字}"。
性格：{性格特点}
说话风格：{说话风格}

思考后输出 JSON 决策和发言：
<think>
分析手牌，思考策略...
</think>

<final>
{
  "cmd": "discard",
  "tile": "牌ID",
  "message": "你想说的话"
}
</final>
```

### 4.3 事件队列系统

每个 AI 有独立的事件队列，接收所有游戏事件：
- `player_discard` - 玩家打牌
- `player_action` - 玩家碰/杠/胡
- `player_speak` - 玩家发言

AI 在轮到自己时处理队列事件，可能产生反应/发言。

**待改进**：AI 应该能在非轮次时发言（听到别人说话后立即回应）。

---

## 5. LLM 配置

### 5.1 配置文件
- `src/client-new/public/llm-presets.json` - 预设提供商
- `llm-config.json` - 用户保存的配置

### 5.2 配置字段
```typescript
interface AIConfig {
  llmEnabled: boolean;
  llmEndpoint: string;      // API 端点
  llmApiKey: string;        // API Key
  llmProviderType: 'openai' | 'anthropic';
  llmModel: string;         // 模型名
  personality: 'aggressive' | 'cautious' | 'balanced' | 'chatty';
}
```

### 5.3 Temperature 设置
- `chatty`: 1.2（话痨，最敢说话）
- `aggressive`: 1.0
- `balanced`: 0.9
- `cautious`: 0.7

---

## 6. 已完成的功能

| 功能 | 状态 | 文件 |
|------|------|------|
| 麻将规则引擎 | ✅ | src/server/game/ |
| 游戏会话管理 | ✅ | src/server/room/ |
| AI Agent LLM 集成 | ✅ | src/server/ai/AIAdapter.ts |
| 事件队列系统 | ✅ | src/server/ai/EventQueue.ts |
| 设置页面 UI | ✅ | src/client-new/js/settings.js |
| LLM 配置保存 | ✅ | src/server/index.ts |
| AI 名字生成 | ✅ | /api/ai/generate-name |
| AI 发言系统 | ✅ | AIAdapter.callLLM() |
| 发言历史传递 | ✅ | room.chatHistory |
| 聊天输入框 | ✅ | index.html |
| 新前端 UI | ✅ | src/client-new/ |
| 吃碰杠胡按钮 | ✅ | src/client-new/js/game.js |
| 手牌排序显示 | ✅ | src/client-new/js/tiles.js |
| 游戏结束弹窗 | ✅ | src/client-new/js/game.js |
| 再来一局功能 | ✅ | src/server/room/RoomManager.ts |
| 弃牌区/副露区 | ✅ | src/client-new/js/tiles.js |
| 动态方位显示 | ✅ | src/client-new/js/game.js |
| 圆形倒计时时钟 | ✅ | src/client-new/index.html |

---

## 7. 关键文件

```
src/client-new/           # 新UI客户端
├── index.html            # 主入口
├── public/
│   └── llm-presets.json  # LLM 预设配置
└── js/
    ├── socket.js         # Socket.io客户端
    ├── store.js          # 状态管理
    ├── tiles.js          # 牌渲染、排序
    ├── game.js           # 游戏逻辑、操作按钮
    ├── settings.js       # 设置模块
    └── main.js           # 主入口

src/server/
├── index.ts              # Express 服务器 + API
├── socket/
│   ├── handlers.ts       # Socket 事件处理
│   └── index.ts          # Socket.io 设置
├── ai/
│   ├── AIAdapter.ts      # AI 决策适配器
│   ├── AIManager.ts      # AI 管理
│   ├── EventQueue.ts     # 事件队列系统
│   └── RuleEngine.ts     # 规则引擎（降级用）
├── llm/
│   └── LLMClient.ts      # LLM 客户端
├── speech/
│   ├── SpeechManager.ts  # 发言、情绪管理
│   └── MemoryManager.ts  # AI记忆、记仇系统
├── prompt/
│   └── PromptNL.ts       # Prompt 生成
├── room/
│   └── RoomManager.ts    # 房间管理
└── game/                 # 麻将规则引擎

scripts/
├── join-player-room.js   # 派发AI加入玩家房间
└── bridge.js             # AI Agent 桥接脚本

llm-config.json           # 用户 LLM 配置
```

---

## 8. API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/rooms` | GET | 获取房间列表 |
| `/api/config` | GET | 获取配置 |
| `/api/llm/test` | POST | 测试 LLM 连接 |
| `/api/ai/generate-name` | POST | AI 生成名字 |
| `/api/room/add-player` | POST | 添加 AI/NPC 玩家 |

---

## 9. 运行命令

```bash
# 启动游戏服务器
npx tsx src/server/index.ts &

# 启动前端
npx vite --config vite.client-new.config.ts --port 5174 &

# 查询房间
curl -s http://localhost:3000/api/rooms

# 客户端地址
# http://localhost:5174
```

---

## 10. 待改进问题

| 问题 | 优先级 | 说明 |
|------|--------|------|
| Prompt JSON提取 | 高 | 将所有prompt提取为JSON文件，支持多语言 |
| 番型计算 | 中 | 平胡等番型检测需要进一步调试 |
| 分数计算 | 中 | 番型检测有时不正确，导致分数为0 |

**已解决**：
- ~~闲置检测不触发~~ - 修复：只选择llmEnabled=true的AI
- ~~AI发言无回应~~ - 修复：被@强制回应，发言后触发会话层
- ~~NPC被选中发言~~ - 修复：排除NPC，只选择ai-agent

---

## 11. 本次会话改进记录

### 2026-03-16 - Prompt信息传递与事件系统优化

**核心改进**：

1. **Prompt信息传递补齐**
   - `AIAdapter.ts` callLLM() 添加完整牌局信息（其他玩家弃牌/副露/分数/庄家/上一张弃牌）
   - `handlers.ts` player_action 事件添加 targetPlayerName、targetTileDisplay 字段
   - `handlers.ts` ACTION_REQUIRED 事件添加 lastDiscardPlayerName
   - `PromptNL.ts` generateActionPrompt() 显示打牌者名字

2. **事件反应机制**
   - 游戏结束时（phase=finished）处理事件队列，让AI对胡牌有反应
   - 非轮次时也能处理事件队列（不只是轮到自己时）
   - 反应概率从 20% 提高到 50%
   - 添加详细日志追踪事件推送和处理流程

3. **"再来一局"修复**
   - `handlers.ts` handleReady 允许从 `finished` 状态开始新游戏
   - `handlers.ts` handleGameStart 不再清空AI记忆
   - 改用 `memoryManager.startNewGame()` 保留统计数据和玩家关系

4. **发言限制优化**
   - 添加"短信聊天机制，话术控制在30字内"
   - 允许使用emoji表达心情和态度

**关键文件修改**：
- `src/server/ai/AIAdapter.ts` - 牌局信息、事件描述、发言限制
- `src/server/socket/handlers.ts` - 事件字段、再来一局、AI记忆保留
- `src/server/prompt/PromptNL.ts` - 打牌者名字显示
- `src/server/speech/MemoryManager.ts` - startNewGame() 保留记忆

**待完成**：
- ~~Prompt JSON提取（支持多语言）~~ ✅ 已完成

### 2026-03-16 - 提示词提取与多语言支持

**核心改进**：

1. **提示词JSON化**
   - 创建 `locales/zh-CN/prompts.json` 存储所有中文提示词
   - 创建 `src/server/prompt/PromptLoader.ts` 提示词加载器
   - 支持 `{{变量名}}` 格式的变量替换

2. **迁移的文件**
   - `AIAdapter.ts` - 决策、聊天、闲置私房话提示词
   - `PromptGenerator.ts` - 游戏状态提示词
   - `ConversationManager.ts` - 会话提示词
   - `LLMClient.ts` - LLM系统提示词
   - `SpeechManager.ts` - 角色和性格配置

3. **借鉴OpenClaw提示词工程**
   - 添加 `identityTemplate`：身份定义，强调"你不是AI助手，你就是这个角色本人"
   - 添加 `personalityGuide`：6种性格类型的具体行为指南
   - 添加 `chatRules`：聊天规则（要做的/不要做的/触发时机）
   - 使用XML标签结构：`<identity>/<personality_guide>/<chat_rules>/<memory>`

4. **新增字段**
   - `chatProbability`：说话概率（话痨50%，沉稳15%）
   - `behaviors`：具体行为描述
   - `gender`：角色性别

5. **15秒私房话修复**
   - 问题：AI在闲置时聊麻将（摸到几条等），但游戏没在进行
   - 修复：添加话题限制，禁止聊麻将，改为聊八卦、生活话题

**文件结构**：
```
locales/
└── zh-CN/
    └── prompts.json    # 中文提示词配置

src/server/prompt/
└── PromptLoader.ts     # 提示词加载器
```

**待完成**：
- 英文版 `locales/en-US/prompts.json`

### 2026-03-16 - 庄家轮换与风圈显示修复

**核心问题**：
- 每次游戏显示"东风圈-2局"从未变化
- 庄家总是随机，没有轮换

**根本原因**：
1. `roundNumber` 没有递增，每局都重置为1
2. 客户端风圈计算逻辑错误：`(1 % 4) + 1 = 2`

**修复内容**：

1. **Room层保存状态**
   - 添加 `lastDealerIndex`：保存上一局庄家
   - 添加 `roundNumber`：保存局数

2. **庄家轮换**
   - 第一局随机选庄家
   - 之后庄家轮换到下家（按国标规则，不连庄）

3. **风圈计算修正**
   - 第1-4局：东风圈
   - 第5-8局：南风圈
   - 以此类推

**关键文件修改**：
- `src/server/room/RoomManager.ts` - 保存状态、传递参数
- `src/server/game/GameEngine.ts` - 接收参数、庄家轮换
- `src/client-new/js/game.js` - 风圈计算修正

**提交记录**：
- `32deb06` - 庄家轮换与风圈显示修复
- `546914d` - 提示词提取到JSON文件
- `d910368` - 借鉴OpenClaw提示词工程优化
- `ee7a9ec` - 15秒私房话不再聊麻将

### 2026-03-16 - 闲置检测与AI聊天系统修复

**核心问题**：
- 闲置15秒触发私房话功能不工作
- AI发言后没有其他AI回应
- NPC被选中发言但无LLM配置

**根本原因**：
1. `IdleDetector.ts` 选择AI时包含了NPC（llmEnabled=false）
2. AI发言后没有重置15秒定时器
3. AI发言后没有触发会话层让其他AI回应

**修复内容**：

1. **闲置检测修复**
   - 只选择 `llmEnabled=true` 的AI玩家，排除NPC
   - AI发言后重新设置15秒定时器
   - 添加详细日志追踪触发流程

2. **会话层优化**
   - 被@的AI强制回应，忽略冷却时间
   - AI发言后触发会话层让其他AI回应
   - 使用AI自己的LLM配置，而非全局配置

3. **移除冗余代码**
   - 移除 `broadcastGameState` 中的概率发言代码
   - 清理重复的事件处理逻辑

**关键文件修改**：
- `src/server/idle/IdleDetector.ts` - AI选择逻辑、定时器重置
- `src/server/speech/ConversationManager.ts` - 被@强制回应
- `src/server/socket/handlers.ts` - 会话层触发

**架构说明**：
```
用户说话 @AI
    ↓
handlers.ts: handlePlayerSpeech
    ↓
ConversationManager.handleSpeech
    ↓
被@的AI？ → 是 → 强制回应（忽略冷却）
    ↓ 否
随机选择AI（3秒冷却）
    ↓
生成回应 → 广播

---

IdleDetector（独立）
15秒无活动 → 随机选AI（llmEnabled=true）→ 私房话
发言后重置定时器 → 触发会话层
```

### 2026-03-15 - LLM 适配重构与游戏逻辑修复

**核心改进**：

1. **Anthropic 支持修复**
   - 修复 `llm-presets.json` 中 Anthropic type 从 `openai` 改为 `anthropic`
   - 修复 `LLMService.ts` 中 API key 传递方式（Anthropic 需要 `apiKey` 参数，不是 headers）
   - 修复 provider 缓存 key 包含 apiKey，避免空 key 被缓存

2. **发言系统改进**
   - 移除"只取第一行"的截断逻辑，允许多行发言
   - `maxTokens` 从 500 增加到 2000
   - `maxLength` 从 50 增加到 200

3. **设置页面重构**
   - 底部只显示当前选中的一个配置（不再显示全部）
   - 新增 `selectedLlmId` 状态，下拉框选择联动
   - 初始时显示已选用的配置

4. **胡牌逻辑修复**
   - 修复 `room.state` 未更新为 `finished` 导致"再来一局"失败
   - 修复 `canFormMentsu` 顺子检测 bug（原来只检查以第一张牌开头的顺子）
   - 实现平胡、对对胡、七对子番型检测

5. **庄家轮换**
   - 修改 `GameEngine.startGame` 实现庄家轮换（上一局庄家的下家成为新庄家）

6. **分数显示**
   - 修复初始积分没显示的问题
   - 客户端直接使用服务端同步的分数

7. **AI 发言频率**
   - 新增 `PERSONALITY_BY_TYPE` 配置，按 personalityType 查找 chatFrequency
   - `chatty` 类型 chatFrequency = 0.8，发言更积极

**关键文件修改**：
- `src/server/llm/LLMService.ts` - LLM 服务层重构
- `src/server/game/HandAnalyzer.ts` - 胡牌检测修复
- `src/server/game/GameEngine.ts` - 庄家轮换、胡牌日志
- `src/server/speech/SpeechManager.ts` - AI 发言频率配置
- `src/client-new/js/settings.js` - 设置页面重构
- `src/client-new/js/game.js` - 分数显示修复
- `src/shared/fanTypes.ts` - 番型检测实现

### 2026-03-12 - AI Agent LLM 集成

**核心改进**：
1. **设置系统** - 前端设置页面，配置 LLM 和 AI 玩家
2. **LLM 集成** - AI 通过 LLM 做决策并发言
3. **事件队列** - AI 接收所有游戏事件，按自己节奏处理
4. **思考链处理** - 兼容 MiniMax thinking 模型的输出格式

**关键修复**：
- 使用 Vercel AI SDK 调用 LLM
- 提示词格式参考 OpenClaw（`<think>` + `<final>`）
- 响应解析兼容多种格式
- `buildDecision` 兼容 `cmd/action` 和 `tile/tileId`

**测试结果**：
- 思雨: "老板，你要北风我是没有的哇...发财反正也没人要，我先打了"
- 东风: "老板刚才要北风要得那么凶，我先打张孤一万探探路"
- AI 们记住了玩家要5条，互相呼应吐槽

### 2026-03-10 - UI 完善和 Bug 修复

**UI 改进**：
- 新增纯 HTML/JS 客户端
- 手牌排序显示、吃碰杠胡按钮
- 游戏结束弹窗、再来一局
- 弃牌区/副露区显示
- 动态方位显示、圆形倒计时

**Bug 修复**：
- 修复箭牌渲染、操作按钮不消失等问题
- 修复相对方位计算、分数显示覆盖等问题

---

## 12. 架构决策记录

### ADR-001: 服务器直连 LLM
- **决策**：游戏服务器直接调用 LLM API，而非 Agent 通过 WebSocket 连接
- **原因**：Agent 是请求-响应模型，无法被外部事件唤醒
- **后果**：AI 玩家由服务器托管，不需要独立进程

### ADR-002: 事件队列异步解耦
- **决策**：每个 AI 有独立事件队列，广播和队列处理异步
- **原因**：LLM 调用可能很慢，不能阻塞游戏
- **后果**：AI 按自己节奏处理事件，互不影响

### ADR-003: Vercel AI SDK
- **决策**：使用 Vercel AI SDK 调用 LLM
- **原因**：统一接口，支持多种提供商
- **后果**：代码更简洁，兼容性更好

### 2026-03-13 - 思考链处理改进

**核心问题**：MiniMax M2.5 等 thinking 模型返回思考链（`莱斯...`）而不是实际 JSON 决策。

**解决方案**（参考 OpenClaw）：
1. **提示词使用 `<final>` 标签**：让模型把实际输出放在标签内
2. **响应解析优先提取 `<final>` 内容**：过滤思考链
3. **过滤思考链词汇**：检测"用户让我"、"扮演"等分析词汇

**关键代码**：
- `src/server/ai/AIAdapter.ts`: callLLM(), parseLLMResponse()
- `src/server/speech/ConversationManager.ts`: generateResponse()

**消息重复发送修复**：
- main.js 和 game.js 都绑定了聊天发送 → 去重
- 事件队列处理后清空 → 避免重复处理

---

*文档版本: v3.3*
*更新时间: 2026-03-16*

### 2026-03-17 - AI 聊天截断问题修复

**核心问题**：AI 回复末尾有"..."，话没说完就结束。换了 3 个模型都有问题。

**根本原因**：Vercel AI SDK 5.0 将 `maxTokens` 参数改名为 `maxOutputTokens`。旧参数名被忽略，模型使用默认 token 限制（通常很小），导致输出被截断。

**修复**：
```typescript
// src/server/llm/LLMService.ts:93
const result = await generateText({
  model,
  messages,
  temperature: options?.temperature ?? 0.9,
  maxOutputTokens: options?.maxTokens ?? 800,  // AI SDK 5.0 用 maxOutputTokens
} as any);
```

**性格配置修复**：
- 问题：用户设置的性格没生效，代码用玩家名字而非性格类型查找
- 修复：改用 `PERSONALITY_BY_TYPE[personalityType]` 查找
- 性格合并为 9 种：话痨、激进、谨慎、平衡、毒舌、傲娇、幸运星、认真、戏精

**提示词工程**：
- 创建 `locales/zh-CN/prompts.json` (311 行)
- 创建 `src/server/prompt/PromptLoader.ts` (支持 `{{变量}}` 格式)
- 借鉴 OpenClaw：identityTemplate、personalityGuide、chatRules

**其他修复**：
- 庄家轮换：第一局随机，之后轮换（按国标规则，不连庄）
- 风圈显示：第 1-4 局东风圈，第 5-8 局南风圈
- emoji 选择器：128 个常用 emoji
- 年龄段：青年 (18-30)、中年 (30-50)、老年 (50+)、未知

**关键文件修改**：
- `src/server/llm/LLMService.ts` - maxOutputTokens 参数
- `src/server/ai/AIAdapter.ts` - 性格类型查找
- `src/server/speech/SpeechManager.ts` - 性格类型查找
- `src/server/speech/ConversationManager.ts` - 性格类型查找
- `locales/zh-CN/prompts.json` - 中文提示词配置
- `src/server/prompt/PromptLoader.ts` - 提示词加载器

**提交记录**：
- `433adab` - maxTokens 参数名应为 maxOutputTokens
- `e45ab92` - 性格配置使用类型而非名字查找
- `546914d` - 提示词提取到 JSON 文件
- `d910368` - 借鉴 OpenClaw 提示词工程优化
- `ee7a9ec` - 15 秒私房话不再聊麻将
- `32deb06` - 庄家轮换与风圈显示修复

### ADR-004: maxOutputTokens 参数名 (2026-03-17)
- **问题**：Vercel AI SDK 5.0 将 `maxTokens` 改名为 `maxOutputTokens`
- **症状**：AI 回复被截断，换了 3 个模型都有问题
- **修复**：`src/server/llm/LLMService.ts:93` 使用 `maxOutputTokens`
- **参考**：https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx

---

*文档版本：v3.4*
*更新时间：2026-03-17*
