# AI 麻将派对 🀄

一个让人类玩家与 3 个 AI Agent 一起打麻将的网页游戏。展示 OpenClaw Agent 的能力。

## 特点

- 🎮 **国标麻将规则** - 完整的中国麻将游戏逻辑
- 🤖 **3 个 AI 对手** - AI Agent 会聊天、吐槽、情绪化反应
- 🎨 **中国像素风格** - 传统中式美术风格
- ⚡ **实时对战** - WebSocket 实时通信

## 技术栈

- **前端**: React + TypeScript + Zustand + Socket.io
- **后端**: Node.js + Express + Socket.io
- **构建工具**: Vite

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

启动前端开发服务器和后端服务器：

```bash
npm run dev
```

这将同时启动：
- 前端：http://localhost:5173
- 后端：http://localhost:3000

### 单独启动

```bash
# 只启动前端
npm run dev:client

# 只启动后端
npm run dev:server
```

### 构建

```bash
npm run build
```

## 项目结构

```
src/
├── client/                 # 前端代码
│   ├── components/         # React 组件
│   │   ├── Tile/          # 牌组件
│   │   ├── Hand/          # 手牌组件
│   │   ├── GameBoard/     # 游戏桌面
│   │   ├── Lobby/         # 大厅
│   │   └── Room/          # 房间等待
│   ├── socket/            # Socket.io 客户端
│   ├── store/             # Zustand 状态管理
│   ├── styles/            # 全局样式
│   ├── App.tsx            # 应用主组件
│   └── main.tsx           # 入口文件
│
├── server/                 # 后端代码
│   ├── game/              # 游戏逻辑
│   │   ├── GameEngine.ts  # 游戏主控制器
│   │   ├── TileDeck.ts    # 牌组管理
│   │   ├── HandAnalyzer.ts # 手牌分析
│   │   ├── ActionValidator.ts # 操作验证
│   │   └── ScoreCalculator.ts # 分数计算
│   ├── room/              # 房间管理
│   ├── socket/            # Socket.io 服务端
│   └── index.ts           # 服务入口
│
└── shared/                 # 共享代码
    ├── types/             # 类型定义
    ├── constants.ts       # 游戏常量
    ├── fanTypes.ts        # 番型定义
    └── characters.ts      # AI 角色配置
```

## 游戏规则

- **牌数**: 136 张基本牌（万、条、筒、风、箭）
- **人数**: 4 人（1 人类 + 3 AI）
- **胡牌**: 4 副露 + 1 对将，或七对，或十三幺
- **计分**: 基础分 × 2^番数

## OpenClaw Agent 集成

AI Agent 通过 WebSocket 连接到游戏服务器，像人类玩家一样参与游戏。游戏服务器只负责规则验证，AI 决策由 Agent 自行完成。

## 开发

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 环境变量

创建 `.env` 文件：

```
VITE_SOCKET_URL=http://localhost:3000
PORT=3000
```

## License

MIT
