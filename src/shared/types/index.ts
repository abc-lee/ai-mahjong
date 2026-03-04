/**
 * 共享类型导出
 */

// 显式导出类型和值
export type { Suit, Tile, TileDefinition } from './tile';
export { TILE_DEFINITIONS, isSameTile, isNumberTile, isWindTile, isDragonTile, getTileNumber } from './tile';

export type { Meld, MeldType } from './meld';

export type { Player, PlayerPublic, PlayerType, Mood, Personality, AIConfig, AIPersonality } from './player';
export { toPublicPlayer } from './player';

export type { GameStatePublic, GamePhase, TurnPhase, PendingAction, WinningHand, Fan, GameEvent, EmotionContext } from './game';
export { getActionPriority } from './game';

export type { Room, RoomState, RoomSettings } from './room';
