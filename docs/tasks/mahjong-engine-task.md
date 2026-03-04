# 麻将引擎模块 - 开发任务书

## 模块概述

麻将引擎是游戏的核心，负责处理所有麻将规则逻辑。

## 文件结构

```
src/server/game/
├── TileDeck.ts        # 牌组管理
├── HandAnalyzer.ts    # 手牌分析
├── ActionValidator.ts # 操作验证
├── ScoreCalculator.ts # 计分
└── GameEngine.ts      # 游戏主控
```

---

## 1. TileDeck.ts - 牌组管理

### 职责
- 生成 136 张牌
- 洗牌
- 发牌（每人 13 张，庄家 14 张）
- 摸牌

### 类设计

```typescript
class TileDeck {
  private tiles: Tile[];
  private nextId: number;
  
  constructor();
  
  // 初始化 136 张牌
  initialize(): void;
  
  // 洗牌
  shuffle(): void;
  
  // 发牌：返回 4 个玩家的手牌（庄家 14 张）
  deal(dealerIndex: number): { hands: Tile[][], wall: Tile[] };
  
  // 摸牌：从牌墙取一张
  draw(): Tile | null;
  
  // 获取剩余牌数
  getRemaining(): number;
}
```

### 边界情况
- 牌墙为空时，draw() 返回 null
- 初始化时每种牌 4 张，共 136 张

---

## 2. HandAnalyzer.ts - 手牌分析

### 职责
- 判断是否听牌
- 判断是否胡牌
- 计算番型

### 类设计

```typescript
class HandAnalyzer {
  // 判断是否可以胡牌
  canWin(hand: Tile[], melds: Meld[]): boolean;
  
  // 获取所有听的牌
  getWaitingTiles(hand: Tile[], melds: Meld[]): Tile[];
  
  // 判断是否可以吃
  canChi(hand: Tile[], tile: Tile): Tile[][];
  
  // 判断是否可以碰
  canPeng(hand: Tile[], tile: Tile): boolean;
  
  // 判断是否可以杠
  canGang(hand: Tile[], tile: Tile, isSelfDraw: boolean): {
    canMingGang: boolean;  // 明杠
    canAnGang: boolean;    // 暗杠
    canJiaGang: boolean;   // 加杠
  };
  
  // 计算番型
  calculateFans(hand: Tile[], melds: Meld[], isSelfDraw: boolean, winningTile: Tile): Fan[];
}
```

### 胡牌判定逻辑
基础胡牌：4 组面子（顺子/刻子）+ 1 对将牌

### 边界情况
- 七对子：7 个对子
- 国士无双（可选）：13 种幺九牌各一张
- 字牌不能组成顺子

---

## 3. ActionValidator.ts - 操作验证

### 职责
- 验证玩家的操作是否合法
- 返回可用的操作列表

### 类设计

```typescript
class ActionValidator {
  // 验证打牌
  validateDiscard(player: Player, tileId: string): boolean;
  
  // 验证吃牌
  validateChi(player: Player, tile: Tile, tilesToUse: Tile[]): boolean;
  
  // 验证碰牌
  validatePeng(player: Player, tile: Tile): boolean;
  
  // 验证杠牌
  validateGang(player: Player, tile: Tile, gangType: 'ming' | 'an' | 'jia'): boolean;
  
  // 验证胡牌
  validateHu(player: Player, tile: Tile, isSelfDraw: boolean): boolean;
  
  // 获取玩家可用的操作
  getAvailableActions(player: Player, lastDiscard: Tile | null): PendingAction[];
}
```

### 操作优先级
胡(4) > 杠(3) > 碰(2) > 吃(1)

---

## 4. ScoreCalculator.ts - 计分

### 职责
- 计算番数
- 计算分数（底分 × 2^番数）

### 类设计

```typescript
class ScoreCalculator {
  // 计算番数
  calculateHan(fans: Fan[]): number;
  
  // 计算分数
  calculateScore(han: number, baseScore: number): number;
  
  // 计算最终得分
  calculateFinalScore(
    winner: Player,
    loser: Player | null,  // 点炮者，自摸为 null
    han: number
  ): {
    winnerScore: number;
    loserScore: number;    // 如果是点炮
    otherScores: number[]; // 如果是自摸，其他玩家的分数
  };
}
```

### 计分公式
- 分数 = 底分 × 2^番数
- 自摸：其他三家各付
- 点炮：点炮者一人付

---

## 5. GameEngine.ts - 游戏主控

### 职责
- 管理游戏状态
- 处理玩家操作
- 状态流转

### 类设计

```typescript
type GamePhase = 'waiting' | 'playing' | 'finished';
type TurnPhase = 'draw' | 'discard' | 'action';

class GameEngine {
  private state: GameState;
  private deck: TileDeck;
  private analyzer: HandAnalyzer;
  private validator: ActionValidator;
  private calculator: ScoreCalculator;
  
  constructor(roomId: string);
  
  // 开始游戏
  startGame(players: Player[]): void;
  
  // 摸牌
  drawTile(playerId: string): Tile | null;
  
  // 打牌
  discardTile(playerId: string, tileId: string): boolean;
  
  // 吃碰杠胡
  performAction(playerId: string, action: PendingAction): boolean;
  
  // 跳过
  passAction(playerId: string): void;
  
  // 获取游戏状态
  getState(): GameState;
  
  // 获取公开状态（广播用）
  getPublicState(forPlayerId?: string): GameStatePublic;
  
  // 检查是否轮到某玩家
  isPlayerTurn(playerId: string): boolean;
  
  // 检查是否有待处理的操作
  hasPendingActions(): boolean;
}
```

### 状态流转

```
waiting → playing → finished

playing 期间：
  draw → discard → (action) → draw → ...
  
action 阶段：
  等待其他玩家选择吃碰杠胡
  有优先级的玩家先响应
  超时自动 pass
```

---

## 已有的类型定义

参考 `src/shared/types/` 目录下的文件：
- tile.ts - 牌的定义
- meld.ts - 副露的定义
- player.ts - 玩家的定义
- game.ts - 游戏状态的定义

---

## 测试要求

每个类需要编写单元测试：
- TileDeck: 测试发牌数量、洗牌随机性
- HandAnalyzer: 测试胡牌判定、番型计算
- ActionValidator: 测试各种操作的合法性
- ScoreCalculator: 测试计分公式
- GameEngine: 测试完整游戏流程

---

## 注意事项

1. 不要修改 `src/shared/types/` 下的类型定义
2. 所有牌的操作都要考虑边界情况
3. 吃牌需要检查花色相同且数值连续
4. 碰牌需要检查有 2 张相同的牌
5. 杠牌要区分明杠、暗杠、加杠
