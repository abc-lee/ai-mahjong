import { Player } from '../../shared/types/player';
import { Tile, isSameTile, isNumberTile } from '../../shared/types/tile';
import { PendingAction, getActionPriority } from '../../shared/types/game';
import { HandAnalyzer } from './HandAnalyzer';

/**
 * 杠牌类型
 */
export type GangType = 'ming' | 'an' | 'jia';

/**
 * 可用操作结果
 */
export interface AvailableActions {
  canHu: boolean;
  canGang: boolean;
  gangTiles: Tile[];
  canPeng: boolean;
  canChi: boolean;
  chiCombinations: Tile[][];
  actions: PendingAction[];
}

/**
 * 操作验证类
 * 负责验证玩家的操作是否合法，返回可用的操作列表
 */
export class ActionValidator {
  private analyzer: HandAnalyzer;

  constructor() {
    this.analyzer = new HandAnalyzer();
  }

  /**
   * 验证打牌
   */
  validateDiscard(player: Player, tileId: string): boolean {
    const tile = player.hand.find(t => t.id === tileId);
    if (!tile) return false;
    return player.hand.length > 0;
  }

  /**
   * 验证吃牌
   */
  validateChi(player: Player, tile: Tile, tilesToUse: Tile[]): boolean {
    if (!tilesToUse || tilesToUse.length !== 2) return false;

    for (const t of tilesToUse) {
      if (!player.hand.some(h => h.id === t.id)) return false;
    }

    const allTiles = [tile, ...tilesToUse];
    return this.canFormSequence(allTiles);
  }

  /**
   * 验证碰牌
   */
  validatePeng(player: Player, tile: Tile): boolean {
    let count = 0;
    for (const h of player.hand) {
      if (isSameTile(h, tile)) count++;
    }
    return count >= 2;
  }

  /**
   * 验证杠牌
   */
  validateGang(player: Player, tile: Tile, gangType: GangType, isSelfDraw: boolean = false): boolean {
    const gangResult = this.analyzer.canGang(player.hand, tile, player.melds, isSelfDraw);

    switch (gangType) {
      case 'ming':
        return !isSelfDraw && gangResult.canMingGang;
      case 'an':
        return isSelfDraw && gangResult.canAnGang;
      case 'jia':
        return isSelfDraw && gangResult.canJiaGang;
      default:
        return false;
    }
  }

  /**
   * 验证胡牌
   */
  validateHu(player: Player, tile: Tile, isSelfDraw: boolean): boolean {
    const fullHand = isSelfDraw ? player.hand : [...player.hand, tile];
    return this.analyzer.canWin(fullHand, player.melds);
  }

  /**
   * 获取玩家可用的操作
   */
  getAvailableActions(
    player: Player,
    lastDiscard: Tile | null,
    isSelfDraw: boolean = false,
    lastDiscardPlayer: number = -1,
    currentPlayerIndex: number = -1
  ): AvailableActions {
    const result: AvailableActions = {
      canHu: false,
      canGang: false,
      gangTiles: [],
      canPeng: false,
      canChi: false,
      chiCombinations: [],
      actions: [],
    };

    if (isSelfDraw) {
      this.checkSelfDrawActions(player, result);
    } else if (lastDiscard) {
      this.checkDiscardActions(player, lastDiscard, result, lastDiscardPlayer, currentPlayerIndex);
    }

    return result;
  }

  /**
   * 检查自摸阶段的操作
   */
  private checkSelfDrawActions(player: Player, result: AvailableActions): void {
    if (this.analyzer.canWin(player.hand, player.melds)) {
      result.canHu = true;
      result.actions.push({
        playerId: player.id,
        action: 'hu',
        priority: getActionPriority('hu'),
      });
    }

    const anGangTiles = this.analyzer.getAnGangTiles(player.hand);
    if (anGangTiles.length > 0) {
      result.canGang = true;
      result.gangTiles = anGangTiles;
      result.actions.push({
        playerId: player.id,
        action: 'gang',
        priority: getActionPriority('gang'),
        tiles: anGangTiles,
      });
    }

    if (player.hand.length > 0) {
      const lastTile = player.hand[player.hand.length - 1];
      const pengMeld = player.melds.find(m =>
        m.type === 'peng' &&
        m.tiles.length > 0 &&
        isSameTile(m.tiles[0], lastTile)
      );
      if (pengMeld) {
        result.canGang = true;
        result.gangTiles.push(lastTile);
      }
    }
  }

  /**
   * 检查别人打牌后的操作
   */
  private checkDiscardActions(
    player: Player,
    lastDiscard: Tile,
    result: AvailableActions,
    lastDiscardPlayer: number,
    currentPlayerIndex: number
  ): void {
    const fullHand = [...player.hand, lastDiscard];
    console.log(`[checkDiscardActions] 玩家 ${player.name}, hand=${player.hand.length}, melds=${player.melds.length}, fullHand=${fullHand.length}`);
    
    if (this.analyzer.canWin(fullHand, player.melds)) {
      console.log(`[checkDiscardActions] 玩家 ${player.name} 可以胡牌！`);
      result.canHu = true;
      result.actions.push({
        playerId: player.id,
        action: 'hu',
        priority: getActionPriority('hu'),
        tiles: [lastDiscard],
      });
    }

    const gangResult = this.analyzer.canGang(player.hand, lastDiscard, player.melds, false);
    if (gangResult.canMingGang) {
      result.canGang = true;
      result.actions.push({
        playerId: player.id,
        action: 'gang',
        priority: getActionPriority('gang'),
        tiles: [lastDiscard],
      });
    }

    if (this.analyzer.canPeng(player.hand, lastDiscard)) {
      result.canPeng = true;
      result.actions.push({
        playerId: player.id,
        action: 'peng',
        priority: getActionPriority('peng'),
        tiles: [lastDiscard],
      });
    }

    const canChi = this.canPlayerChi(lastDiscardPlayer, currentPlayerIndex, player.position);
    if (canChi) {
      const chiCombinations = this.analyzer.canChi(player.hand, lastDiscard);
      if (chiCombinations.length > 0) {
        result.canChi = true;
        result.chiCombinations = chiCombinations;
        // 为每个可能的吃牌组合创建一个 action
        // chiCombinations 返回的是3张牌（包括被吃的那张）
        // 我们需要提取出玩家手里的那2张牌
        for (const combo of chiCombinations) {
          // 从组合中排除被吃的牌，剩下的就是玩家手里的牌
          const playerTiles = combo.filter(t => !isSameTile(t, lastDiscard));
          if (playerTiles.length === 2) {
            result.actions.push({
              playerId: player.id,
              action: 'chi',
              priority: getActionPriority('chi'),
              tiles: playerTiles,  // 玩家手里的两张牌
            });
          }
        }
      }
    }

    result.actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 检查玩家是否可以吃牌（只能吃上家的牌）
   */
  private canPlayerChi(
    lastDiscardPlayer: number,
    currentPlayerIndex: number,
    playerPosition: number
  ): boolean {
    if (lastDiscardPlayer < 0 || currentPlayerIndex < 0) return false;
    const expectedChiPlayer = (lastDiscardPlayer + 1) % 4;
    return playerPosition === expectedChiPlayer;
  }

  /**
   * 检查三张牌是否能组成顺子
   */
  private canFormSequence(tiles: Tile[]): boolean {
    if (tiles.length !== 3) return false;
    if (!tiles.every(t => isNumberTile(t))) return false;

    const suit = tiles[0].suit;
    if (!tiles.every(t => t.suit === suit)) return false;

    const values = tiles.map(t => t.value).sort((a, b) => a - b);
    return values[1] === values[0] + 1 && values[2] === values[1] + 1;
  }

  /**
   * 获取最高优先级的操作
   */
  getHighestPriorityAction(actions: PendingAction[]): PendingAction | null {
    if (actions.length === 0) return null;
    return actions.reduce((highest, current) =>
      current.priority > highest.priority ? current : highest
    );
  }

  /**
   * 检查是否有高优先级的操作
   */
  hasHigherPriorityAction(allPendingActions: PendingAction[], action: 'chi' | 'peng' | 'gang' | 'hu'): boolean {
    const actionPriority = getActionPriority(action);
    return allPendingActions.some(pending => pending.priority > actionPriority);
  }
}
