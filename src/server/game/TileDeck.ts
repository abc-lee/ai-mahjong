import { Tile, TileDefinition, TILE_DEFINITIONS } from '../../shared/types/tile';

/**
 * 麻将牌组管理类
 * 负责136张牌的初始化、洗牌、发牌、摸牌
 */
export class TileDeck {
  private tiles: Tile[] = [];
  private nextId: number = 0;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化136张牌
   */
  initialize(): void {
    this.tiles = [];
    this.nextId = 0;

    // 每种牌生成4张
    for (const def of TILE_DEFINITIONS) {
      for (let i = 0; i < 4; i++) {
        this.tiles.push(this.createTile(def));
      }
    }
  }

  /**
   * 创建单张牌
   */
  private createTile(def: TileDefinition): Tile {
    return {
      id: `${def.suit}-${def.value}-${this.nextId++}`,
      suit: def.suit,
      value: def.value,
      display: def.display,
    };
  }

  /**
   * Fisher-Yates 洗牌算法
   */
  shuffle(): void {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  /**
   * 发牌
   * @param dealerIndex 庄家索引（0-3）
   * @returns 玩家手牌和剩余牌墙
   */
  deal(dealerIndex: number): { hands: Tile[][]; wall: Tile[] } {
    const hands: Tile[][] = [[], [], [], []];

    // 每人轮流发4张，发3轮
    for (let round = 0; round < 3; round++) {
      for (let player = 0; player < 4; player++) {
        for (let i = 0; i < 4; i++) {
          const tile = this.tiles.shift();
          if (tile) {
            hands[(dealerIndex + player) % 4].push(tile);
          }
        }
      }
    }

    // 庄家跳牌（第1、5、9、13张对应庄家）
    // 跳牌顺序：庄家、下家、对家、上家
    const jumpOrder = [0, 1, 2, 3]; // 相对于庄家的顺序
    for (const offset of jumpOrder) {
      const playerIndex = (dealerIndex + offset) % 4;
      const tile = this.tiles.shift();
      if (tile) {
        hands[playerIndex].push(tile);
      }
    }

    // 庄家再摸一张（14张）
    const dealerTile = this.tiles.shift();
    if (dealerTile) {
      hands[dealerIndex].push(dealerTile);
    }

    return {
      hands,
      wall: [...this.tiles],
    };
  }

  /**
   * 摸牌
   * @returns 摸到的牌，牌墙为空返回null
   */
  draw(): Tile | null {
    return this.tiles.shift() ?? null;
  }

  /**
   * 获取剩余牌数
   */
  getRemaining(): number {
    return this.tiles.length;
  }
}
