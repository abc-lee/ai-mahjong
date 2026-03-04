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

  startGame(players: Player[]): void {
    if (players.length !== 4) {
      throw new Error('麻将需要4名玩家');
    }
    
    this.deck = new TileDeck();
    this.deck.shuffle();
    
    const dealerIndex = Math.floor(Math.random() * 4);
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
      roundNumber: 1,
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
    if (this.state.phase !== 'playing') return false;
    if (this.hasPendingActions()) return false;
    
    const playerIndex = this.getPlayerIndex(playerId);
    if (playerIndex === -1 || playerIndex !== this.state.currentPlayerIndex) return false;
    if (this.turnPhase !== 'discard') return false;
    
    const player = this.state.players[playerIndex];
    if (!this.validator.validateDiscard(player, tileId)) return false;
    
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) return false;
    
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
    if (this.state.phase !== 'playing') return false;
    if (!this.hasPendingActions()) return false;
    
    const pendingAction = this.state.pendingActions.find(
      p => p.playerId === playerId && p.action === action.action
    );
    if (!pendingAction) return false;
    
    const playerIndex = this.getPlayerIndex(playerId);
    const player = this.state.players[playerIndex];
    
    switch (action.action) {
      case 'hu':
        return this.performHu(player, playerIndex);
      case 'gang':
        return this.performGang(player, playerIndex, action.tiles?.[0]);
      case 'peng':
        return this.performPeng(player, playerIndex);
      case 'chi':
        return this.performChi(player, playerIndex, action.tiles);
      default:
        return false;
    }
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
      wallRemaining: this.state.wall.length,
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
    const playerIndex = this.getPlayerIndex(playerId);
    return playerIndex === this.state.currentPlayerIndex;
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
    const actions = this.validator.getAvailableActions(player, null, true, -1, this.state.currentPlayerIndex);
    
    if (actions.canHu) {
      this.state.pendingActions.push({
        playerId: player.id,
        action: 'hu',
        priority: getActionPriority('hu'),
      });
      this.turnPhase = 'action';
    }
    
    if (actions.canGang && actions.gangTiles.length > 0) {
      this.state.pendingActions.push({
        playerId: player.id,
        action: 'gang',
        priority: getActionPriority('gang'),
        tiles: actions.gangTiles,
      });
    }
