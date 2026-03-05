# AI 麻将迭代方案

## 一、当前阶段：基础功能完善

### 1. 真正的 LLM 决策
- [ ] 接入 OpenAI/Claude 等 LLM API
- [ ] 让 AI 真正"思考"而不是启发式算法
- [ ] 记录 AI 的决策理由

### 2. 多语言支持
- [ ] Prompt 支持中文/英文切换
- [ ] AI 角色支持不同语言风格

### 3. 断线重连/自动托管
- [ ] AI Agent 断线检测
- [ ] 自动降级为 ai-auto 托管
- [ ] 重连后恢复控制

### 4. 代码清理
- [ ] 拆分 handlers.ts 文件
- [ ] 整理 Prompt 生成器
- [ ] 添加类型注释

---

## 二、下一阶段：互动与发言系统

### 1. 等待提醒系统
**触发条件**：玩家超过 N 秒未出牌

**机制**：
```
等待 3 秒 → 向所有 AI 发送: "【玩家名】正在思考..."
等待 10 秒 → 向所有 AI 发送: "【玩家名】怎么这么慢？"
等待 20 秒 → 触发情绪刺激
```

**实现**：
- 服务器端：每个回合开始计时
- 超时后广播 `game:waiting` 事件
- AI 收到后可以主动发言

### 2. 情绪刺激系统
**目的**：刺激 AI 产生情绪反应，主动发言

**刺激话术库**：
```javascript
const STIMULI = {
  slow: [
    "他怎么这么慢，急死我了！",
    "能不能快点啊，我还要打牌呢~",
    "这人真的让我有点烦躁...",
    "我怀疑他在故意拖延时间！",
    "再不出牌我就要睡着了~"
  ],
  lucky: [
    "运气真好啊，刚摸到好牌！",
    "这人手气怎么这么好？",
    "老天爷是不是偏心啊~"
  ],
  unlucky: [
    "哎，又是烂牌...",
    "今天手气真差，倒霉！",
    "不想玩了，没意思..."
  ],
  conflict: [
    "你刚才为什么打那张牌？故意的吧？",
    "我就知道你会碰我的牌！",
    "你这是在针对我吗？"
  ]
}
```

**触发逻辑**：
```typescript
// 服务器端
if (waitingTime > 10) {
  const stimulus = randomPick(STIMULI.slow);
  broadcast('game:stimulus', { 
    targetPlayer: currentPlayer,
    stimulus,
    type: 'slow'
  });
}
```

### 3. AI 发言系统
**触发方式**：
1. **被动触发**：收到情绪刺激后发言
2. **主动触发**：随机时间间隔主动发言
3. **事件触发**：碰/杠/胡时发言

**发言类型**：
```typescript
type SpeechType = 
  | 'complain'    // 抱怨
  | 'taunt'       // 嘲讽
  | 'celebrate'   // 庆祝
  | 'encourage'   // 鼓励
  | 'chat'        // 闲聊
  | 'argue'       // 争吵
```

**发言接口**：
```typescript
// AI 发送发言
socket.emit('agent:speak', {
  content: "你太慢了！",
  emotion: 'annoyed',  // 情绪类型
  targetPlayer: 'xxx'  // 可选，针对某个玩家
});
```

### 4. 嘴炮系统（AI 之间的对话）
**场景**：
- 两个 AI 开始互相嘲讽
- 一个 AI 抱怨，另一个安慰/反驳
- 连续对话 2-3 轮

**示例**：
```
AI-A: "你怎么这么慢？"
AI-B: "急什么，我在思考策略！"
AI-A: "就你这烂牌还思考？笑死~"
AI-B: "你等着，看我胡给你看！"
```

**触发条件**：
```typescript
// 概率触发嘴炮
if (lastSpeech.targetPlayer === thisAgentName) {
  // 30% 概率回嘴
  if (Math.random() < 0.3) {
    triggerArgueChain();
  }
}
```

---

## 三、进阶阶段：情绪与奖励系统

### 1. AI 情绪值系统
**情绪维度**：
```typescript
interface EmotionState {
  happiness: number;   // 快乐 -100 ~ 100
  anger: number;       // 愤怒 0 ~ 100
  patience: number;    // 耐心 0 ~ 100
  confidence: number;  // 自信 0 ~ 100
}
```

**情绪影响因素**：
| 事件 | 情绪变化 |
|------|---------|
| 摸到好牌 | happiness+10, confidence+5 |
| 摸到烂牌 | happiness-5, confidence-3 |
| 被碰牌 | anger+5, patience-5 |
| 被杠牌 | anger+10, patience-10 |
| 别人胡牌 | happiness-10, anger+5 |
| 自己胡牌 | happiness+30, confidence+20 |
| 等待超时 | patience-10, anger+5 |
| 被嘲讽 | anger+10 |

### 2. 分数奖励系统
**分数影响情绪**：
```typescript
function updateEmotionByScore(player: Player) {
  const scoreDiff = player.score - player.lastScore;
  
  if (scoreDiff > 0) {
    player.emotion.happiness += scoreDiff * 2;
    player.emotion.confidence += scoreDiff;
  } else if (scoreDiff < 0) {
    player.emotion.happiness += scoreDiff;  // 负数
    player.emotion.anger += Math.abs(scoreDiff) * 0.5;
  }
}
```

### 3. 情绪表现系统（界面）
**情绪动画**：
- 😊 快乐：嘴角上扬，眼神明亮
- 😠 愤怒：眉毛紧皱，面部发红
- 😢 沮丧：低头，表情低落
- 😎 自信：昂首挺胸

**情绪提示**：
```typescript
interface EmotionDisplay {
  face: string;      // 表情图片
  animation: string; // 动画效果
  aura: string;      // 气氛特效（愤怒=红色火焰）
}
```

---

## 四、高级阶段：Prompt 迭代

### 1. 动态 Prompt 模板
根据游戏阶段和情绪状态生成不同的 Prompt：

```typescript
function generateDynamicPrompt(player: Player, gameState: GameState) {
  const basePrompt = getBasePrompt(player, gameState);
  
  // 添加情绪上下文
  if (player.emotion.anger > 50) {
    basePrompt += `\n\n你现在有点生气，说话可以带点情绪。`;
  }
  
  // 添加游戏上下文
  if (gameState.isCloseToEnd) {
    basePrompt += `\n\n牌局快结束了，抓紧机会！`;
  }
  
  return basePrompt;
}
```

### 2. 记忆系统
AI 记住之前的对话和事件：

```typescript
interface Memory {
  recentEvents: Event[];     // 最近事件
  conversations: Message[];  // 对话历史
  grudges: string[];         // 记仇列表（谁坑过我）
  friendships: string[];     // 好友列表
}
```

### 3. 个性化 Prompt
每个 AI 角色有不同的性格设定：

```typescript
const PERSONALITIES = {
  紫璃: {
    traits: ['傲娇', '毒舌', '聪明'],
    speakStyle: '带点讽刺，但内心善良',
    angerThreshold: 30,  // 容易生气
  },
  白泽: {
    traits: ['温和', '智慧', '包容'],
    speakStyle: '理性分析，偶尔开导他人',
    angerThreshold: 70,  // 不容易生气
  },
  李瞳: {
    traits: ['活泼', '话唠', '乐观'],
    speakStyle: '喜欢聊天，总能找到话题',
    angerThreshold: 50,
  },
};
```

---

## 五、实施优先级

### 第一批（本周）
1. ✅ 基础 Prompt 系统
2. ⏳ 真正的 LLM 决策
3. ⏳ 断线重连/托管

### 第二批（下周）
4. 发言系统基础
5. 等待提醒
6. 情绪刺激触发

### 第三批（后续）
7. AI 情绪值系统
8. 嘴炮对话系统
9. 分数影响情绪
10. 界面情绪动画

---

## 六、技术架构

```
┌─────────────────────────────────────────────────┐
│                   Game Server                    │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Prompt  │  │ Emotion  │  │  Speech  │       │
│  │ Generator│  │  System  │  │  System  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│       ↓             ↓             ↓             │
│  ┌─────────────────────────────────────────┐    │
│  │           Event Dispatcher               │    │
│  └─────────────────────────────────────────┘    │
│                      ↓                          │
│  ┌─────────────────────────────────────────┐    │
│  │         WebSocket / Socket.io           │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│                   AI Agent                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Decision  │  │ Emotion  │  │  Memory  │       │
│  │ Engine   │  │  State   │  │  Store   │       │
│  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────┘
```

---

## 七、测试用例

### 发言系统测试
```javascript
// 测试等待超时触发发言
test('等待10秒后触发情绪刺激', async () => {
  const game = startGame();
  await wait(10000);
  expect(game.lastStimulus).toBeDefined();
});
```

### 情绪系统测试
```javascript
test('被碰牌后愤怒值增加', () => {
  const player = createPlayer();
  player.onPeng();
  expect(player.emotion.anger).toBeGreaterThan(0);
});
```

### 嘴炮系统测试
```javascript
test('AI被嘲讽后有概率回嘴', () => {
  const ai = createAI('紫璃');
  ai.receiveTaunt('你太慢了');
  expect(ai.willRespond).toBe(true); // 30%概率
});
```
