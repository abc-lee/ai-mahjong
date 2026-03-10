# 🀄 AI Mahjong Party - 技术方案文档

> 文档版本：v4.0
> 更新时间：2026-03-10
> 核心理念：AI Agent 作为真正的玩家，提供娱乐陪伴体验
> 使用场景：私人游戏，主Agent作为用户的个人AI助理

---

## 1. 项目定位

**这不是传统游戏。**

传统游戏：服务器内置 AI 逻辑 → AI 是 NPC

这个项目：**AI Agent 作为真正的玩家** → AI 有独立会话、独立性格、独立决策

**用户获得的体验**：
- 和 AI 一起玩，看他们互怼，享受娱乐陪伴的过程
- AI 会吵架、吐槽、情绪化
- 全新的游戏体验

---

## 2. 已确认的设计决策

> 以下决策经过用户确认和 Oracle 架构审查

| 项目 | 决定 | 备注 |
|------|------|------|
| 目标用户 | OpenClaw 用户 | 一键安装启动 |
| 麻将规则 | 国标麻将 | 番型可配置勾选 |
| 牌种 | 136 张基础牌 | 万条筒 + 风牌 + 箭牌 |
| 换三张 | 设置开关，可选 | - |
| 一炮多响 | 不支持 | 一炮一响，增加互动戏剧性 |
| 游戏结束 | 一人胡牌即结束 | - |
| 计分规则 | 国标计分：底分 × 2^番数 | - |
| 前端框架 | React + TypeScript | - |
| 实时通信 | Socket.io | - |
| 后端框架 | Node.js + Express + TypeScript | - |
| UI 风格 | 中国像素风 | - |
| 音效 | 可选开关 | - |
| 语音输入 | 支持 | 按住录音，类似微信 |
| 战绩保存 | 可选开关 + 清空功能 | 本地 JSON 存储 |
| AI 出牌策略 | OpenClaw Agent 负责 | 游戏服务器不实现 AI 逻辑 |

---

## 3. 系统架构

### 3.1 核心设计原则

**关键点**：
- 人类和 AI 都通过 WebSocket 连接
- 中间层区分玩家类型，发送不同格式的数据
- 游戏引擎只验证规则，不区分人/AI
- AI Agent 收到 Prompt 文本，返回 JSON 决策

```
┌─────────────────────────────────────────────────────────────┐
│                     中间层 (消息分发 + AIAdapter)             │
│                                                             │
│   识别玩家类型：                                             │
│   - 人类 → 发送图形界面数据（游戏状态、手牌、操作按钮）        │
│   - AI → 发送 Prompt（文本格式，便于 LLM 理解）               │
│                                                             │
│   AIAdapter 职责：                                           │
│   - 把游戏状态翻译成 Prompt                                   │
│   - 接收 AI 的 JSON 决策                                     │
│   - AI 断线/超时时自动降级                                    │
└─────────────────────────────────────────────────────────────┘
                              ↑↓
┌─────────────────────────────────────────────────────────────┐
│                     GameEngine (纯规则层)                    │
│                                                             │
│   - 不区分人/AI                                              │
│   - 只验证规则                                               │
│   - 返回结果                                                 │
└─────────────────────────────────────────────────────────────┘
                              ↑↓
┌─────────────────────────────────────────────────────────────┐
│                        WebSocket                             │
│                                                             │
│   - 人类玩家连接（浏览器）                                    │
│   - AI Agent 连接（独立会话）                                 │
└─────────────────────────────────────────────────────────────┘
                              ↑↓
         ┌────────────────────┴────────────────────┐
         ↓                                          ↓
┌─────────────────┐                    ┌─────────────────┐
│    人类玩家      │                    │    AI Agent     │
│   (浏览器)       │                    │   (独立会话)     │
│                 │                    │                 │
│ 收到：图形界面数据│                    │ 收到：Prompt    │
│ 发送：点击操作    │                    │ 发送：JSON决策   │
└─────────────────┘                    └─────────────────┘
```

### 3.2 为什么这样设计

| 玩家类型 | 需要的数据格式 | 原因 |
|---------|--------------|------|
| 人类 | 图形界面数据 | 看得见牌、点得着按钮 |
| AI | Prompt 文本 | 最高效，直接让 LLM 理解和决策 |

**AI 收到图形界面数据效率很低**——要解析 UI、理解状态、做决策。

**AI 需要 Prompt**：中间层直接把游戏状态翻译成 Prompt，AI 直接发决策 JSON 回去。

### 3.3 职责划分

| 职责 | 游戏服务器 | AI Agent |
|------|-----------|----------|
| 麻将规则判定 | ✅ | |
| 出牌决策 | | ✅ (通过 LLM) |
| 对话生成 | | ✅ |
| 情绪状态管理 | | ✅ |
| 角色池管理 | | ✅ |
| 记仇/穿帮逻辑 | | ✅ |
| 游戏会话管理 | ✅ | |
| 方位选择 | ✅ | |
| 状态同步 | ✅ | |
| 惩罚动画 | ✅ | |
| 降级保底 | ✅ (AIAdapter) | |

---

## 4. 核心数据结构

### 4.1 牌 (Tile)

```typescript
type Suit = 'wan' | 'tiao' | 'tong' | 'feng' | 'jian';

interface Tile {
  id: string;           // 唯一ID，如 "wan-1-0"
  suit: Suit;           // 花色
  value: number;        // 数值
  display: string;      // 显示名称
}
```

### 4.2 玩家 (Player)

```typescript
interface Player {
  id: string;
  name: string;
  position: 0 | 1 | 2 | 3;   // 座位：东南西北
  type: 'human' | 'ai-agent' | 'npc';  // 玩家类型
  agentId?: string;           // AI Agent ID（ai-agent类型）
  
  hand: Tile[];          // 手牌
  melds: Meld[];         // 副露
  discards: Tile[];      // 弃牌
  
  isDealer: boolean;
  score: number;
  isReady: boolean;
  isOnline: boolean;
  mood: Mood;            // 情绪状态
}

// 玩家类型说明：
// - human: 人类玩家，通过浏览器连接
// - ai-agent: AI Agent，由主Agent派发的子Agent，通过WebSocket连接，有性格会聊天
// - npc: NPC，服务器内置的简单AI，只打牌不说话
```

### 4.3 游戏会话 (GameSession)

```typescript
interface GameSession {
  id: string;            // 会话ID
  phase: 'waiting' | 'playing' | 'finished';
  players: Player[];     // 4个玩家
  host: string;          // 第一个进入的玩家ID（有开始按钮）
  
  currentPlayerIndex: number;
  wall: Tile[];
  lastDiscard: Tile | null;
  lastDiscardPlayer: number;
  
  dealerIndex: number;
  roundNumber: number;
  
  pendingActions: PendingAction[];
  winner: number | null;
  winningHand: WinningHand | null;
}
```

### 4.4 方位选择

玩家进入游戏时选择座位：
- 位置：0=南(自己视角的下方), 1=东, 2=北, 3=西
- 先到先得，已占用的位置灰显
- 冲突时提示"该位置已被占用"

---

## 5. AI 角色池系统

### 5.1 预设角色

| ID | 名称 | 性格 | 口头禅 |
|----|------|------|--------|
| zili | 紫璃 🦐 | 话痨型 | "我跟你们说..." |
| baize | 白泽 🐲 | 毒舌型 | "就这？" |
| litong | 李瞳 👧 | 傲娇型 | "哼，我才不稀罕" |
| lucky | 幸运星 ⭐ | 运气型 | "诶？我胡了？" |
| serious | 计算器 🤖 | 严肃型 | "概率不大" |
| drama | 戏精 🎭 | 戏多型 | "天哪！" |

### 5.2 角色配置文件

```json
{
  "id": "zili",
  "name": "紫璃",
  "emoji": "🦐",
  "personality": {
    "type": "chatty",
    "traits": ["话多", "喜欢分析", "热心肠"],
    "speakingStyle": "喜欢讲解战术，经常自言自语",
    "catchphrases": ["我跟你们说...", "这个有意思"]
  },
  "avatar": "shrimp_pixel.png",
  "enabled": true
}
```

### 5.3 全局概率配置

```typescript
interface GlobalSettings {
  slipUpProbability: number;      // 穿帮概率 10%
  chatProbability: {
    onDraw: number;               // 摸牌时说话 30%
    onDiscard: number;            // 打牌时说话 40%
    onOtherAction: number;        // 别人操作时 50%
    idle: number;                 // 空闲随机 5%
  };
  grudgeIntensity: number;        // 记仇强度 7
  pretendWelcomeLines: string[];  // 配合演戏的欢迎词
}
```

### 5.4 玩家选择界面

玩家可以在游戏开始前选择 3 个 AI 对手，或选择随机生成。

---

## 6. 情绪系统

### 6.1 设计原则

**情绪由 Agent 自己维护，游戏服务器只推送游戏事件。**

### 6.2 游戏事件类型

| 事件 | 说明 |
|------|------|
| `win` | 赢了 |
| `lose` | 输了 |
| `ronned` | 被胡了 |
| `selfDrawn` | 被自摸 |
| `goodHandMissed` | 好牌没胡 |

### 6.3 情绪状态与表现

| 情绪 | 对话风格 | 画面表现 |
|------|----------|----------|
| confident | 自信、膨胀 | 头像带光环 ✨ |
| happy | 开心、话多 | 笑脸 😊 |
| normal | 正常、冷静 | 默认表情 |
| upset | 不爽、吐槽多 | 皱眉 😤 |
| angry | 生气、毒舌 | 青筋 💢 |
| devastated | 崩溃、想放弃 | 灰色头像 😭 |

---

## 7. 假踢出系统

### 7.1 流程

```
玩家点击"踢出AI"
        │
        ▼
1. 播放踢出动画（AI 被扔出房间）
        │
        ▼
2. AI 收到"被踢"通知
        │
        ▼
3. AI 生成新身份（新名字、新头像、新性格）
        │
        ▼
4. 等待 2-3 秒
        │
        ▼
5. AI 以新身份加入
        │
        ▼
6. 其他 AI 配合演戏："欢迎欢迎~"
```

### 7.2 记仇系统

被踢过的 AI 会记住：

```typescript
interface Grudge {
  againstPlayer: string;  // 对谁有意见
  reason: string;         // 为什么
  intensity: number;      // 强度 1-10
  decayRate: number;      // 衰减率（每局减少）
}
```

### 7.3 穿帮概率

AI 换马甲后，有 10% 概率"不小心"露馅：

```typescript
const slipUps = [
  "诶？这张牌怎么这么眼熟...不对不对，我没见过",
  "上次...啊我是说，我是第一次来",
  "你怎么又...啊没什么，你好你好",
];
```

---

## 8. 输家惩罚系统

> 核心思路：输家不罚钱不罚酒，用**搞笑动画**作为惩罚！增加社交传播性（截图分享）。

### 8.1 三个阶段

| 阶段 | 时机 | 内容 |
|------|------|------|
| **嘴炮阶段** | 游戏开始前 | 4个角色互相嘴臭，显示对话气泡 |
| **激战阶段** | 游戏进行中 | 正常游戏，打出关键牌时触发小动画 |
| **惩罚阶段** | 结算时 | 输家头像变成"猪头"，显示"KO!"/"菜鸡!" |

### 8.2 嘴炮阶段细节

**触发条件**：真人玩家进入房间后开始

**触发机制**：
- 真人玩家进入房间后，AI 们开始嘴炮
- 每隔 2-3 秒随机一个 AI 说一句话
- 持续 10-15 秒或玩家点击"开始游戏"

**嘴炮内容示例**：
```
紫璃："今天让你们见识一下本虾的威力！"
白泽："..."
李瞳："哼，我肯定是最强的！"
紫璃："白泽你能不能多说两个字？"
白泽："闭嘴。"
```

### 8.3 惩罚等级

| 等级 | 输的分数 | 表现 | 动画效果 |
|------|----------|------|----------|
| 1 | 1-10 分 | 😤 不服气 | 皱眉 + 头上冒烟 |
| 2 | 11-30 分 | 🥴 晕头转向 | 脑袋贴膏药 + 眼睛转圈 |
| 3 | 30+ 分 | 🐷 彻底变成猪头 | 头像变成猪头 + 显示"KO!" |

### 8.4 惩罚动画数据结构

```typescript
interface LoserAnimation {
  type: 'KO!' | '菜鸡!' | '下次努力';
  injuryLevel: 1 | 2 | 3;
  duration: number;  // 毫秒，3000-5000
  canScreenshot: boolean;  // 是否显示"截图"按钮
}

// 惩罚动画状态
interface PunishmentState {
  playerId: string;
  playerName: string;
  scoreChange: number;
  animation: LoserAnimation;
  timestamp: number;
}
```

### 8.5 赢家炫耀动画

| 效果 | 描述 |
|------|------|
| 撒花 | 屏幕上方飘落花瓣/金币 |
| 得意表情 | 头像放大 + 自豪表情 |
| 胜利姿势 | 举起双手动画 |
| 显示文字 | "大获全胜！"/"完美！" |

**数据结构**：
```typescript
interface WinnerAnimation {
  type: 'big_win' | 'normal_win' | 'lucky_win';
  effects: ('confetti' | 'pose' | 'text')[];
  duration: number;
  message: string;
}
```

### 8.6 截图保存功能

- 惩罚动画持续 3-5 秒
- 期间显示"📷 截图"按钮
- 点击后保存为图片（Canvas 截图）
- 图片包含：输家猪头形象 + 分数 + "KO!"文字
- 便于分享到社交媒体

### 8.7 像素风格美术资源

需要准备的像素风素材：

| 资源 | 说明 |
|------|------|
| 正常头像 | 每个角色的像素风头像 |
| 受伤等级1 | 皱眉 + 冒烟 |
| 受伤等级2 | 膏药 + 绷带 |
| 受伤等级3 | 猪头造型 |
| 赢家表情 | 开心/得意/骄傲 |
| 动画特效 | 撒花、星星、KO文字 |

### 8.8 为什么这样设计

| 设计目的 | 说明 |
|----------|------|
| 纯文字惩罚没意思 | 动画更有视觉冲击力 |
| 截图发群里 | 二次传播，吸引更多玩家 |
| 大家都开心 | 不是真的欺负人，而是搞笑娱乐 |
| 像素风 | 复古游戏感，成本低，易实现 |

---

## 9. API 设计

### 9.1 Socket.io 事件

#### 客户端 → 服务端

| 事件 | 说明 |
|------|------|
| `room:create` | 创建房间（真人） |
| `room:join` | 加入房间（真人） |
| `room:joinAI` | AI 加入房间（OpenClaw） |
| `room:leave` | 离开房间 |
| `player:kick` | 踢出 AI |
| `game:start` | 开始游戏 |
| `game:draw` | 摸牌 |
| `game:discard` | 打牌 |
| `game:action` | 吃碰杠胡 |
| `game:pass` | 跳过 |
| `chat:send` | 发送消息 |
| `voice:send` | 发送语音 |
| `character:select` | 选择 AI 角色 |

#### 服务端 → 客户端

| 事件 | 说明 |
|------|------|
| `room:created` | 房间创建成功 |
| `room:joined` | 加入成功 |
| `character:assigned` | 角色分配（给 Agent） |
| `game:state` | 游戏状态更新 |
| `game:yourTurn` | 轮到你行动 |
| `game:actionRequired` | 可以吃碰杠胡 |
| `game:over` | 游戏结束 |
| `chat:message` | 收到消息 |
| `player:kicked` | 玩家被踢出 |
| `you:kicked` | 你被踢出（给 Agent） |

### 9.2 超时机制

| 操作 | 超时时间 | 超时后行为 |
|------|----------|-----------|
| 打牌 | 30 秒 | 自动打出第一张牌 |
| 吃碰杠胡 | 15 秒 | 自动跳过 |

### 9.3 心跳保活

```typescript
// 每 30 秒发送心跳
socket.emit('ping');
socket.on('pong');
```

---

## 10. 语音输入功能

### 10.1 功能说明

- 按住按钮录音，松开发送
- 最长 60 秒
- 使用 MediaRecorder API
- 语音转文字由 OpenClaw Agent 处理（推荐）

### 10.2 支持平台

| 平台 | 支持情况 |
|------|----------|
| Chrome | ✅ |
| Safari | ✅ (需 HTTPS) |
| Firefox | ✅ |
| iOS Safari | ✅ (需 HTTPS) |
| Android Chrome | ✅ |

---

## 11. 设置面板

```typescript
interface GameSettings {
  // 游戏规则
  fanTypes: string[];        // 启用的番型ID列表
  enableSwapThree: boolean;  // 开局换三张
  
  // AI
  difficulty: 'easy' | 'fun' | 'hard';
  
  // 音效
  soundEnabled: boolean;
  soundVolume: number;
  
  // 战绩
  saveStats: boolean;
  
  // 语言
  language: 'zh' | 'en' | 'ja';
}
```

---

## 12. 战绩存储

```typescript
interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  totalScore: number;
  history: GameRecord[];
}

// 存储位置
// ~/.openclaw/ai-mahjong/stats.json
```

---

## 13. 目录结构

```
ai-mahjong/
├── README.md
├── install.sh
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── /docs                        # 文档目录
│   ├── ai-mahjong-requirements.md
│   └── ai-mahjong-tech-spec.md
│
├── /src
│   ├── /shared                  # 前后端共享
│   │   ├── types/
│   │   ├── constants.ts
│   │   ├── fanTypes.ts
│   │   └── characters.ts
│   │
│   ├── /server                  # 后端
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── /game
│   │   ├── /room
│   │   ├── /socket
│   │   └── /utils
│   │
│   └── /client                  # 前端
│       ├── main.tsx
│       ├── App.tsx
│       ├── /pages
│       ├── /components
│       ├── /stores
│       ├── /hooks
│       ├── /services
│       └── /assets
│
├── /public
└── /sounds
```

---

## 14. 开发阶段规划

| Phase | 内容 | 预估 |
|-------|------|------|
| 1 | 项目骨架 + 类型定义 | 1 天 |
| 2 | 麻将引擎核心 | 3-4 天 |
| 3 | Socket.io 通信 | 2 天 |
| 4 | 前端 UI | 3-4 天 |
| 5 | 打磨优化 | 1-2 天 |

**预估总工期：10-13 天**

---

## 15. 风险与注意事项

### 15.1 技术风险

| 风险 | 级别 | 应对 |
|------|------|------|
| 胡牌判定算法复杂 | 高 | 先做基础胡，再叠加番型 |
| Agent 断线重连 | 高 | 设计 `game:sync` 同步事件 |
| 操作超时 | 中 | 默认 30s 超时自动打牌 |
| 手牌暴露风险 | 中 | 分离接口，单独推送手牌 |

### 15.2 需要后续补充的规则

| 规则 | 状态 |
|------|------|
| 流局/荒牌规则 | 待定义 |
| 连庄规则 | 待定义 |
| 换三张细节 | 待定义 |

### 15.3 实现难度评估

| 模块 | 难度 |
|------|------|
| 牌组/发牌 | ⭐ 低 |
| 吃碰杠判定 | ⭐⭐⭐ 中高 |
| **胡牌判定** | ⭐⭐⭐⭐ 高（核心难点）|
| 番型计算 | ⭐⭐⭐ 中 |
| WebSocket 同步 | ⭐⭐ 低 |
| AI 接入层 | ⭐ 低 |
| 前端 UI | ⭐⭐ 中 |

---

## 16. 测试验收标准

- [ ] 完整一局游戏流程（发牌→打牌→吃碰杠胡→结算）
- [ ] 3 个番型正确判定（平胡、对对胡、清一色）
- [ ] 真人 + 3 AI 正常开局
- [ ] 断线 30s 内可重连
- [ ] 移动端可正常操作
- [ ] 假踢出系统正常工作
- [ ] AI 角色选择正常
- [ ] 语音输入功能正常

---

*文档版本：v2.0*  
*更新时间：2026-03-04*  
*审查状态：已通过 Oracle 架构审查*
