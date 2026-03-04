# 🀄 AI 四人麻将游戏 - 产品需求文档

## 1. 项目概述

**项目名称**：AI Mahjong Party  
**项目类型**：网页多人在线麻将游戏  
**核心玩法**：3个AI Agent + 1个真人玩家，四人开房打麻将  
**特色**：AI 之间可以互相对话、嘴臭互动，但不能攻击玩家

---

## 2. 功能需求

### 2.1 用户系统
- **游客模式**：输入昵称直接进入游戏
- **房间系统**：
  - 创建房间（生成4位房间号）
  - 加入房间（输入房间号）
  - 房主可以踢人、重置游戏
- **断线重连**：离开后一段时间内可以回来继续

### 2.2 麻将核心规则
- **牌种**：万、条、筒、风牌、箭牌、财神、癞子
- **基本规则**：
  - 标准开房后13张牌，庄家14张
  - 摸打换三张/吃碰杠胡
  - 支持一炮多响
  - 计分：基础分 + 番数累加
- **番型**：清一色、碰碰胡、清龙、七对子等常见番型

### 2.3 AI Agent 系统
- **Agent 数量**：3个（东、南、西位）
- **Agent 性格**：
  - Agent A（紫璃 🦐）：话痨型，战术分析帝
  - Agent B（白泽 🐲）：稳重型，偶尔毒舌
  - Agent C（李瞳 👧）：傲娇型，输急眼
- **AI 行为**：
  - 根据手牌计算最优出牌
  - 吃碰杠决策
  - 胡牌判断
  - 空闲时随机闲聊/嘴炮
- **语音/文字**：纯文字气泡展示

### 2.4 交互系统
- **出牌**：点击手牌 → 确认打出
- **操作按钮**：吃、碰、杠、胡、跳过
- **吃碰杠选择**：多选时弹出选择框
- **聊天**：快捷语 + 打字（仅玩家可用）

### 2.5 视觉/音效
- **界面**：2D 简约中国风（深色背景 + 暖色牌面）
- **牌桌**：俯视视角，4人方位
- **动画**：出牌飞行、打牌特效、胡牌特效
- **音效**（可选）：摸牌、出牌、胡牌音效

---

## 3. 非功能需求

### 3.1 性能
- 首屏加载 < 3秒
- 游戏响应 < 200ms

### 3.2 兼容性
- PC 浏览器（Chrome、Safari、Edge）
- 移动端（iOS Safari、Android Chrome）

### 3.3 可扩展
- 预留 AI Agent 接入接口（可替换为其他 LLM）
- 预留观战模式

---

## 4. 技术方案

### 4.1 前端
- **框架**：React + TypeScript
- **状态管理**：Zustand / Redux
- **后端通信**：WebSocket（Socket.io）
- **动画**：Framer Motion / GSAP

### 4.2 后端
- **语言**：Node.js / Python
- **WebSocket**：Socket.io / FastAPI + WebSocket
- **游戏逻辑**：麻将规则引擎（建议独立模块）

### 4.3 数据结构

```typescript
// 房间
interface Room {
  id: string;           // 房间号
  players: Player[];    // 4个玩家
  gameState: GameState; // 当前游戏状态
  createdAt: number;
}

// 玩家
interface Player {
  id: string;
  nickname: string;
  isAI: boolean;
  agentId?: string;     // AI Agent ID
  hand: number[];       // 手牌
  action: PlayerAction; // 当前动作
}

// 游戏状态
interface GameState {
  currentPlayer: number;    // 当前出牌玩家 0-3
  phase: 'draw' | 'play' | 'action';
  discardTiles: number[];   // 弃牌堆
  revealedTiles: number[];  // 副露
  river: River[];           // 河
  dealer: number;           // 庄家
  round: number;           // 圈
  score: number[];         // 各家分数
}
```

### 4.4 API 设计

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/room/create | POST | 创建房间 |
| /api/room/:id | GET | 获取房间信息 |
| /api/room/:id/join | POST | 加入房间 |
| /ws/game | WS | 游戏实时通信 |

### 4.5 AI Agent 接口

```typescript
// AI 对话请求
interface AIAgentRequest {
  gameState: GameState;
  playerId: number;
  context: string;  // 上下文
  action: 'thinking' | 'chatting' | 'taunting';
}

// AI 返回
interface AIAgentResponse {
  action: 'play' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
  tile?: number;
  message?: string;  // 闲聊/嘴炮内容
}
```

---

## 5. 界面原型（文字版）

```
┌─────────────────────────────────────┐
│  🀄 AI 麻将室    房间号: 8888      │
├─────────────────────────────────────┤
│                                     │
│        [西家 - AI 李瞳]             │
│        🖐️🖐️🖐️ (3张)               │
│                                     │
│  [北] 🀰🀱🀲  [东] 🀐🀑🀒          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         牌  桌  区          │   │
│  │                             │   │
│  │    🀐  🀇  🀙  🀡          │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [南家 - AI 白泽]                   │
│        🖐️🖐️🖐️ (3张)               │
│                                     │
├─────────────────────────────────────┤
│  🦐 紫璃 (你)   积分: 5000          │
│  🀇🀈🀉🀊🀋 🀌🀍🀎🀏 🀐🀑🀒🀓       │
│  [🀑]                              │
│  ┌────────────┐                   │
│  │ 吃  碰  杠  │  [胡]  [跳过]    │
│  └────────────┘                   │
└─────────────────────────────────────┘
```

---

## 6. 待确认问题

1. **麻将规则**：采用哪个地方玩法？（川麻/国标/血战）
2. **番型范围**：做多少种番型？
3. **AI 对话**：调用外部 LLM 还是本地规则？
4. **部署**：需要公网访问还是局域网？

---

## 7. 开发优先级

| 优先级 | 模块 |
|--------|------|
| P0 | 房间系统 + 基础麻将逻辑 |
| P0 | WebSocket 通信 |
| P1 | 3个 AI Agent 接入 |
| P1 | 界面UI |
| P2 | 音效 |
| P2 | 观战模式 |

---

## 8. 部署与运行方式

### 8.1 运行位置
- **服务器**：白泽的 MacBook Pro（李磊的电脑）
- **访问方式**：
  - 本机访问：`http://localhost:3000`
  - 局域网访问：`http://192.168.3.19:3000`
  - 手机访问：`http://<Mac局域网IP>:3000`

### 8.2 运行要求
- **系统**：macOS
- **配置**：Node.js 18+
- **端口**：3000（需在系统设置中允许防火墙）

### 8.3 启动步骤
```bash
# 1. 打开终端，进入项目目录
cd ~/ai-mahjong

# 2. 安装依赖
npm install

# 3. 启动服务
npm start

# 4. 浏览器打开
# http://localhost:3000
```

### 8.4 手机访问
- 确保手机和 Mac 连同一 WiFi
- 浏览器打开：`http://192.168.3.19:3000`
- 如遇防火墙提示，在系统设置中允许 Node.js Incoming Connections

---

## 9. AI Agent 对接（可选）

如果需要更智能的 AI 对话，需要提供：

### 9.1 LLM API 配置
```env
# 可选：接入自己的 LLM
LLM_PROVIDER=openai  # 或 anthropic / local
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4
```

### 9.2 对话风格预设
| Agent | 性格 | 示例 |
|-------|------|------|
| 紫璃 | 话痨战术帝 | "打这张会被吃杠哦～" |
| 白泽 | 稳重毒舌 | "这牌打得..." |
| 李瞳 | 傲娇 | "哼，我才不会输呢 |

---

## 10. 用户安装指南（简化版）

### 10.1 安装前置要求
- **设备**：Mac / Linux / Windows + WSL
- **环境**：Node.js 18+

### 10.2 安装方式

**方式一：让 AI 助手帮你装**

把下面这段话发给你的 AI 助手（比如紫璃）：

> "帮我安装 AI Mahjong Party：
> 1. git clone https://github.com/abc-lee/ai-mahjong.git
> 2. cd ai-mahjong && npm install
> 3. npm start
> 4. 浏览器打开 http://localhost:3000"

AI 会自动帮你执行安装！

**方式二：手动安装**

```bash
# 1. 打开终端，运行：
git clone https://github.com/abc-lee/ai-mahjong.git
cd ai-mahjong
npm install

# 2. 启动游戏
npm start

# 3. 浏览器打开
http://localhost:3000
```

### 10.3 手机访问
- 手机和电脑连同一 WiFi
- 浏览器打开：`http://<电脑IP>:3000`
- Mac 查看 IP：`ifconfig | grep "192.168"`

---

## 11. 开发团队交接清单

- [x] 产品需求文档（本文件）
- [ ] 项目代码（GitHub 仓库）
- [ ] 安装脚本
- [ ] 测试验收

---

*文档版本：v1.2*  
*创建时间：2026-03-04*
