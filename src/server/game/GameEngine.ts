import { Tile, isSameTile } from '../../shared/types/tile';
import { Player, toPublicPlayer, PlayerPublic } from '../../shared/types/player';
import { Meld } from '../../shared/types/meld';
import {
  GameState,
  GameStatePublic,
  GamePhase,
  TurnPhase,
  PendingAction,
  WinningHand,
  Fan,
  getActionPriority,
} from '../../shared/types/game';
import { TileDeck } from './TileDeck';
import { HandAnalyzer } from './HandAnalyzer';
import { ActionValidator, AvailableActions } from './ActionValidator';
import { ScoreCalculator, DetailedScoreResult } from './ScoreCalculator';
import { FanDefinition } from '../../shared/fanTypes';

/**
 * 游戏主控类
 * 负责管理游戏状态、处理玩家操作、控制状态流转
 */
export class GameEngine {
  private state: GameState;
  private deck: TileDeck;
  private analyzer: HandAnalyzer;
  private validator: ActionValidator;
  private calculator: ScoreCalculator;
  
  private turnPhase: TurnPhase = 'draw';
  private respondedPlayers: Set<string> = new Set();
  private lastDrawnTile: Map<string, Tile> = new Map();

  constructor(roomId: string) {
    this.deck = new TileDeck();
    this.analyzer = new HandAnalyzer();
    this.validator = new ActionValidator();
    this.calculator = new ScoreCalculator();
    
    this.state = {
      roomId,
      phase: 'waiting',
      players: [],
      currentPlayerIndex: 0,
      wall: [],
      lastDiscard: null,
      lastDiscardPlayer: -1,
      dealerIndex: 0,
      roundNumber: 1,
      pendingActions: [],
      winner: null,
      winningHand: null,
    };
  }

  startGame(players: Player[], lastDealerIndex?: number, roundNumber?: number): void {
    if (players.length !== 4) {
      throw new Error('麻将需要4名玩家');
    }
    
    this.deck = new TileDeck();
    this.deck.shuffle();
    
    // 庄家轮换：上一局的庄家下家成为新庄家
    // 如果是第一局或没有上一局庄家，随机选择
    let dealerIndex: number;
    if (lastDealerIndex !== undefined && lastDealerIndex >= 0) {
      // 上一局庄家的下家成为新庄家
      dealerIndex = (lastDealerIndex + 1) % 4;
    } else {
      // 第一局随机选择
      dealerIndex = Math.floor(Math.random() * 4);
    }
    
    const { hands, wall } = this.deck.deal(dealerIndex);
    
    players.forEach((player, index) => {
      player.hand = hands[index];
      player.melds = [];
      player.discards = [];
      player.isDealer = index === dealerIndex;
      player.position = index as 0 | 1 | 2 | 3;
    });
    
    this.state = {
      roomId: this.state.roomId,
      phase: 'playing',
      players,
      currentPlayerIndex: dealerIndex,
      wall,
      lastDiscard: null,
      lastDiscardPlayer: -1,
      dealerIndex,
      roundNumber: roundNumber || 1,  // 使用传入的局数，默认为1
      pendingActions: [],
      winner: null,
      winningHand: null,
    };
    
    this.turnPhase = 'discard';
    this.respondedPlayers.clear();
    this.lastDrawnTile.clear();
    this.lastDrawnTile.set(players[dealerIndex].id, hands[dealerIndex][hands[dealerIndex].length - 1]);
  }

  drawTile(playerId: string): Tile | null {
    
    if (this.state.phase !== 'playing') return null;
    if (this.hasPendingActions()) return null;
    
    const playerIndex = this.getPlayerIndex(playerId);
    if (playerIndex === -1 || playerIndex !== this.state.currentPlayerIndex) return null;
    if (this.turnPhase !== 'draw') return null;
    
    const tile = this.deck.draw();
    if (!tile) {
      this.endGame(null);
      return null;
    }
    
    const player = this.state.players[playerIndex];
    player.hand.push(tile);
    this.lastDrawnTile.set(playerId, tile);
    this.turnPhase = 'discard';
    
    this.checkSelfDrawActions(player);
    return tile;
  }

  discardTile(playerId: string, tileId: string): boolean {
    
    if (this.state.phase !== 'playing') {
      return false;
    }
    if (this.hasPendingActions()) {
      return false;
    }
    
    const playerIndex = this.getPlayerIndex(playerId);
    if (playerIndex === -1 || playerIndex !== this.state.currentPlayerIndex) {
      return false;
    }
    if (this.turnPhase !== 'discard') {
      return false;
    }
    
    const player = this.state.players[playerIndex];
    if (!this.validator.validateDiscard(player, tileId)) {
      return false;
    }
    
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) {
      return false;
    }
    
    const tile = player.hand.splice(tileIndex, 1)[0];
    player.discards.push(tile);
    
    this.state.lastDiscard = tile;
    this.state.lastDiscardPlayer = playerIndex;
    this.lastDrawnTile.delete(playerId);
    
    this.checkDiscardActions(playerIndex, tile);
    
    if (!this.hasPendingActions()) {
      this.nextTurn();
    } else {
      this.turnPhase = 'action';
    }
    
    return true;
  }

  performAction(playerId: string, action: PendingAction): boolean {
    
    if (this.state.phase !== 'playing') {
      return false;
    }
    if (!this.hasPendingActions()) {
      return false;
    }
    
    const pendingAction = this.state.pendingActions.find(
      p => p.playerId === playerId && p.action === action.action
    );
    if (!pendingAction) {
      return false;
    }
    
    const playerIndex = this.getPlayerIndex(playerId);
    const player = this.state.players[playerIndex];
    
    let result = false;
    switch (action.action) {
      case 'hu':
        result = this.performHu(player, playerIndex);
        break;
      case 'gang':
        result = this.performGang(player, playerIndex, action.tiles?.[0]);
        break;
      case 'peng':
        result = this.performPeng(player, playerIndex);
        break;
      case 'chi':
        result = this.performChi(player, playerIndex, action.tiles);
        break;
      default:
        result = false;
    }
    
    
    // 如果操作成功，清除所有 pendingActions（因为吃碰杠胡是互斥的）
    if (result) {
      this.state.pendingActions = [];
      this.respondedPlayers.clear();
    }
    
    return result;
  }

  passAction(playerId: string): void {
    if (!this.hasPendingActions()) return;
    
    const hasAction = this.state.pendingActions.some(p => p.playerId === playerId);
    if (!hasAction) return;
    
    this.respondedPlayers.add(playerId);
    this.state.pendingActions = this.state.pendingActions.filter(p => p.playerId !== playerId);
    
    if (this.state.pendingActions.length === 0) {
      this.turnPhase = 'draw';
      this.respondedPlayers.clear();
      this.nextTurn();
    }
  }

  getState(): GameState {
    return { ...this.state };
  }

  getPublicState(forPlayerId?: string): GameStatePublic {
    const players: PlayerPublic[] = this.state.players.map((player) => {
      return toPublicPlayer(player);
    });
    
    return {
      roomId: this.state.roomId,
      phase: this.state.phase,
      players,
      currentPlayerIndex: this.state.currentPlayerIndex,
      wallRemaining: this.deck.getRemaining(),
      lastDiscard: this.state.lastDiscard,
      lastDiscardPlayer: this.state.lastDiscardPlayer,
      dealerIndex: this.state.dealerIndex,
      roundNumber: this.state.roundNumber,
      hasPendingActions: this.hasPendingActions(),
      winner: this.state.winner,
    };
  }

  isPlayerTurn(playerId: string): boolean {
    if (this.state.phase !== 'playing') return false;
    // 如果有待处理的操作（吃碰杠胡），任何人都不能行动
    if (this.hasPendingActions()) {
      return false;
    }
    const playerIndex = this.getPlayerIndex(playerId);
    const result = playerIndex === this.state.currentPlayerIndex;
    return result;
  }

  hasPendingActions(): boolean {
    return this.state.pendingActions.length > 0;
  }

  getAvailableActions(playerId: string): PendingAction[] {
    return this.state.pendingActions.filter(p => p.playerId === playerId);
  }

  getTurnPhase(): TurnPhase {
    return this.turnPhase;
  }

  getLastDrawnTile(playerId: string): Tile | undefined {
    return this.lastDrawnTile.get(playerId);
  }

  private getPlayerIndex(playerId: string): number {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  private nextTurn(): void {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % 4;
    this.state.lastDiscard = null;
    this.state.lastDiscardPlayer = -1;
    this.turnPhase = 'draw';
  }

  private checkSelfDrawActions(player: Player): void {
    // 注意：流局检查已在 drawTile 中处理，这里不需要重复检查
    // 如果牌墙为空但 draw() 返回了牌（最后一张），玩家仍然可以胡牌
    
    const actions = this.validator.getAvailableActions(player, null, true, -1, this.state.currentPlayerIndex);
    
    // 胡牌优先级最高，如果可以胡，就不检查杠
    if (actions.canHu) {
      this.state.pendingActions.push({
        playerId: player.id,
        action: 'hu',
        priority: getActionPriority('hu'),
      });
      this.turnPhase = 'action';
      return; // 直接返回，不添加杠操作
    }
    
    // 只有不能胡时才检查杠
    if (actions.canGang && actions.gangTiles.length > 0) {
      this.state.pendingActions.push({
        playerId: player.id,
        action: 'gang',
        priority: getActionPriority('gang'),
        tiles: actions.gangTiles,
      });
    }
  }

  private checkDiscardActions(discardPlayerIndex: number, tile: Tile): void {
    this.state.pendingActions = [];
    this.respondedPlayers.clear();
    
    // 先收集所有玩家的操作
    const allActions: PendingAction[] = [];
    
    for (let i = 0; i < this.state.players.length; i++) {
      if (i === discardPlayerIndex) continue;
      
      const player = this.state.players[i];
      const actions = this.validator.getAvailableActions(
        player, tile, false, discardPlayerIndex, (discardPlayerIndex + 1) % 4
      );
      
      
      for (const action of actions.actions) {
        allActions.push(action);
      }
    }
    
    // 检查是否有胡牌操作（优先级最高）
    const hasHuAction = allActions.some(a => a.action === 'hu');
    
    if (hasHuAction) {
      // 如果有人可以胡，只保留胡牌操作
      this.state.pendingActions = allActions.filter(a => a.action === 'hu');
    } else {
      // 没有胡牌，检查是否有杠/碰操作
      const hasGangOrPeng = allActions.some(a => a.action === 'gang' || a.action === 'peng');
      
      if (hasGangOrPeng) {
        // 有杠或碰，过滤掉吃牌操作
        this.state.pendingActions = allActions.filter(a => a.action !== 'chi');
      } else {
        // 只有吃牌操作
        this.state.pendingActions = allActions;
      }
    }
    
    this.state.pendingActions.sort((a, b) => b.priority - a.priority);
  }

  private performHu(player: Player, playerIndex: number): boolean {
    const isSelfDraw = this.lastDrawnTile.has(player.id);
    const winningTile = isSelfDraw ? this.lastDrawnTile.get(player.id)! : this.state.lastDiscard!;
    
    
    if (!isSelfDraw) {
      player.hand.push(winningTile);
    }
    
    const fans = this.analyzer.calculateFans(player.hand, player.melds, isSelfDraw, winningTile);
    
    
    const loserIndex = isSelfDraw ? null : this.state.lastDiscardPlayer;
    const loser = loserIndex !== null ? this.state.players[loserIndex] : null;
    const scoreResult = this.calculator.calculateDetailedScore(player, loser, fans, isSelfDraw);
    
    
    this.calculator.applyScoreChange(this.state.players, playerIndex, loserIndex, scoreResult);
    
    
    this.state.winner = playerIndex;
    this.state.winningHand = {
      tiles: [...player.hand],
      melds: [...player.melds],
      fans: fans.map(f => ({ id: f.id, name: f.name, fan: f.fan, enabled: f.enabled })),
      score: scoreResult.winnerScore,
      isSelfDraw,
    };
    
    this.endGame(playerIndex);
    return true;
  }

  private performGang(player: Player, playerIndex: number, tile?: Tile): boolean {
    if (!tile) return false;
    
    const isSelfDraw = this.lastDrawnTile.has(player.id);
    const gangResult = this.analyzer.canGang(player.hand, tile, player.melds, isSelfDraw);
    
    let gangType: 'ming' | 'an' | 'jia' | null = null;
    if (!isSelfDraw && gangResult.canMingGang) gangType = 'ming';
    else if (isSelfDraw && gangResult.canAnGang) gangType = 'an';
    else if (isSelfDraw && gangResult.canJiaGang) gangType = 'jia';
    
    if (!gangType) return false;
    
    if (gangType === 'ming') {
      const tilesToRemove = player.hand.filter(t => isSameTile(t, tile)).slice(0, 3);
      tilesToRemove.forEach(t => {
        const idx = player.hand.findIndex(h => h.id === t.id);
        if (idx !== -1) player.hand.splice(idx, 1);
      });
      this.state.lastDiscard = null;
      player.melds.push({
        type: 'gang',
        tiles: [...tilesToRemove, tile],
        fromPlayer: this.state.lastDiscardPlayer,
        isConcealed: false,
      });
    } else if (gangType === 'an') {
      const tilesToRemove = player.hand.filter(t => isSameTile(t, tile)).slice(0, 4);
      tilesToRemove.forEach(t => {
        const idx = player.hand.findIndex(h => h.id === t.id);
        if (idx !== -1) player.hand.splice(idx, 1);
      });
      player.melds.push({
        type: 'gang',
        tiles: tilesToRemove,
        fromPlayer: playerIndex,
        isConcealed: true,
      });
    } else if (gangType === 'jia') {
      const pengIndex = player.melds.findIndex(
        m => m.type === 'peng' && m.tiles.length > 0 && isSameTile(m.tiles[0], tile)
      );
      if (pengIndex === -1) return false;
      
      const idx = player.hand.findIndex(h => isSameTile(h, tile));
      if (idx === -1) return false;
      player.hand.splice(idx, 1);
      
      player.melds[pengIndex] = {
        type: 'gang',
        tiles: [...player.melds[pengIndex].tiles, tile],
        fromPlayer: player.melds[pengIndex].fromPlayer,
        isConcealed: false,
      };
    }
    
    this.state.pendingActions = [];
    this.respondedPlayers.clear();
    
    const drawnTile = this.deck.draw();
    if (drawnTile) {
      player.hand.push(drawnTile);
      this.lastDrawnTile.set(player.id, drawnTile);
      this.turnPhase = 'discard';
      this.checkSelfDrawActions(player);
    } else {
      // 流局：清除所有待处理动作，结束游戏
      this.state.pendingActions = [];
      this.respondedPlayers.clear();
      this.endGame(null);
    }
    
    this.state.currentPlayerIndex = playerIndex;
    return true;
  }

  private performPeng(player: Player, playerIndex: number): boolean {
    const tile = this.state.lastDiscard;
    if (!tile) return false;
    
    if (!this.validator.validatePeng(player, tile)) return false;
    
    const tilesToRemove = player.hand.filter(t => isSameTile(t, tile)).slice(0, 2);
    tilesToRemove.forEach(t => {
      const idx = player.hand.findIndex(h => h.id === t.id);
      if (idx !== -1) player.hand.splice(idx, 1);
    });
    
    player.melds.push({
      type: 'peng',
      tiles: [...tilesToRemove, tile],
      fromPlayer: this.state.lastDiscardPlayer,
      isConcealed: false,
    });
    
    // 从打出这张牌的玩家的弃牌区移除
    const discardPlayer = this.state.players[this.state.lastDiscardPlayer];
    if (discardPlayer) {
      const discardIdx = discardPlayer.discards.findIndex(d => d.id === tile.id);
      if (discardIdx !== -1) {
        discardPlayer.discards.splice(discardIdx, 1);
      }
    }
    
    this.state.pendingActions = [];
    this.respondedPlayers.clear();
    this.state.currentPlayerIndex = playerIndex;
    this.state.lastDiscard = null;
    this.state.lastDiscardPlayer = -1;
    this.turnPhase = 'discard';
    
    return true;
  }

  private performChi(player: Player, playerIndex: number, tiles?: Tile[]): boolean {
    
    if (!tiles || tiles.length !== 2) {
      return false;
    }
    
    const tile = this.state.lastDiscard;
    if (!tile) {
      return false;
    }
    
    
    if (!this.validator.validateChi(player, tile, tiles)) {
      return false;
    }
    
    tiles.forEach(t => {
      const idx = player.hand.findIndex(h => h.id === t.id);
      if (idx !== -1) player.hand.splice(idx, 1);
    });
    
    const chiTiles = [...tiles, tile].sort((a, b) => a.value - b.value);
    
    player.melds.push({
      type: 'chi',
      tiles: chiTiles,
      fromPlayer: this.state.lastDiscardPlayer,
      isConcealed: false,
    });
    
    // 从打出这张牌的玩家的弃牌区移除
    const discardPlayer = this.state.players[this.state.lastDiscardPlayer];
    if (discardPlayer) {
      const discardIdx = discardPlayer.discards.findIndex(d => d.id === tile.id);
      if (discardIdx !== -1) {
        discardPlayer.discards.splice(discardIdx, 1);
      }
    }
    
    this.state.pendingActions = [];
    this.respondedPlayers.clear();
    this.state.currentPlayerIndex = playerIndex;
    this.state.lastDiscard = null;
    this.state.lastDiscardPlayer = -1;
    this.turnPhase = 'discard';
    
    
    return true;
  }

  private endGame(winnerIndex: number | null): void {
    this.state.phase = 'finished';
    this.state.winner = winnerIndex;
    this.state.pendingActions = [];
    this.turnPhase = 'discard';
  }
}
