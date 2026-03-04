/**
 * 全局状态管理 Store
 * 使用 Zustand 管理游戏状态
 */

import { create } from 'zustand';
import {
  Room,
  Tile,
  PendingAction,
  GameStatePublic,
  GamePhase,
} from '@shared/types';

// 初始状态常量
const initialState = {
  // 连接状态
  connected: false,
  playerId: null as string | null,
  playerName: null as string | null,

  // 房间状态
  currentRoom: null as Room | null,
  rooms: [] as Room[],

  // 游戏状态
  gamePhase: 'waiting' as GamePhase,
  gamePublicState: null as GameStatePublic | null,
  myHand: [] as Tile[],
  myTurn: false,
  lastDrawnTile: null as Tile | null,
  turnPhase: null as 'draw' | 'discard' | 'action' | null,
  availableActions: [] as PendingAction[],

  // UI 状态
  selectedTile: null as Tile | null,
  showActionModal: false,
};

interface GameState {
  // 连接状态
  connected: boolean;
  playerId: string | null;
  playerName: string | null;

  // 房间状态
  currentRoom: Room | null;
  rooms: Room[];

  // 游戏状态
  gamePhase: GamePhase;
  gamePublicState: GameStatePublic | null;
  myHand: Tile[];
  myTurn: boolean;
  lastDrawnTile: Tile | null;
  turnPhase: 'draw' | 'discard' | 'action' | null;
  availableActions: PendingAction[];

  // UI 状态
  selectedTile: Tile | null;
  showActionModal: boolean;

  // Actions - 连接相关
  setConnected: (connected: boolean) => void;
  setPlayerInfo: (id: string, name: string) => void;

  // Actions - 房间相关
  setCurrentRoom: (room: Room | null) => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;

  // Actions - 游戏相关
  updateGameState: (
    state: GameStatePublic,
    hand: Tile[],
    yourTurn: boolean,
    lastDrawn?: Tile,
    turnPhase?: 'draw' | 'discard' | 'action'
  ) => void;
  setAvailableActions: (actions: PendingAction[]) => void;
  clearAvailableActions: () => void;

  // Actions - UI 相关
  selectTile: (tile: Tile | null) => void;
  setShowActionModal: (show: boolean) => void;

  // Actions - 重置
  reset: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // 初始状态
  ...initialState,

  // ==================== 连接相关 ====================

  setConnected: (connected: boolean) => {
    set({ connected });
    if (!connected) {
      // 断开连接时重置状态
      get().reset();
    }
  },

  setPlayerInfo: (id: string, name: string) => {
    set({ playerId: id, playerName: name });
  },

  // ==================== 房间相关 ====================

  setCurrentRoom: (room: Room | null) => {
    set({ currentRoom: room });
    if (!room) {
      // 离开房间时重置游戏状态
      get().resetGame();
    }
  },

  setRooms: (rooms: Room[]) => {
    set({ rooms });
  },

  addRoom: (room: Room) => {
    set((state) => ({
      rooms: [...state.rooms, room],
    }));
  },

  updateRoom: (room: Room) => {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
      currentRoom:
        state.currentRoom?.id === room.id ? room : state.currentRoom,
    }));
  },

  removeRoom: (roomId: string) => {
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
    }));
  },

  // ==================== 游戏相关 ====================

  updateGameState: (
    state: GameStatePublic,
    hand: Tile[],
    yourTurn: boolean,
    lastDrawn?: Tile,
    turnPhase?: 'draw' | 'discard' | 'action'
  ) => {
    set({
      gamePublicState: state,
      gamePhase: state.phase,
      myHand: hand,
      myTurn: yourTurn,
      lastDrawnTile: lastDrawn || null,
      turnPhase: turnPhase || null,
    });
  },

  setAvailableActions: (actions: PendingAction[]) => {
    set({
      availableActions: actions,
      showActionModal: actions.length > 0,
    });
  },

  clearAvailableActions: () => {
    set({
      availableActions: [],
      showActionModal: false,
    });
  },

  // ==================== UI 相关 ====================

  selectTile: (tile: Tile | null) => {
    set({ selectedTile: tile });
  },

  setShowActionModal: (show: boolean) => {
    set({ showActionModal: show });
  },

  // ==================== 重置 ====================

  reset: () => {
    set({ ...initialState });
  },

  resetGame: () => {
    set({
      gamePhase: 'waiting',
      gamePublicState: null,
      myHand: [],
      myTurn: false,
      lastDrawnTile: null,
      turnPhase: null,
      availableActions: [],
      selectedTile: null,
      showActionModal: false,
    });
  },
}));

// ==================== 选择器 ====================

// 连接状态选择器
export const useConnected = () => useGameStore((state) => state.connected);
export const usePlayerInfo = () =>
  useGameStore((state) => ({
    playerId: state.playerId,
    playerName: state.playerName,
  }));

// 房间状态选择器
export const useCurrentRoom = () => useGameStore((state) => state.currentRoom);
export const useRooms = () => useGameStore((state) => state.rooms);

// 游戏状态选择器
export const useGamePhase = () => useGameStore((state) => state.gamePhase);
export const useGamePublicState = () =>
  useGameStore((state) => state.gamePublicState);
export const useMyHand = () => useGameStore((state) => state.myHand);
export const useMyTurn = () => useGameStore((state) => state.myTurn);
export const useLastDrawnTile = () =>
  useGameStore((state) => state.lastDrawnTile);
export const useAvailableActions = () =>
  useGameStore((state) => state.availableActions);

// UI 状态选择器
export const useSelectedTile = () =>
  useGameStore((state) => state.selectedTile);
export const useShowActionModal = () =>
  useGameStore((state) => state.showActionModal);

// 派生状态选择器
export const useIsInRoom = () => useGameStore((state) => state.currentRoom !== null);
export const useIsPlaying = () => useGameStore((state) => state.gamePhase === 'playing');
export const useHasActions = () => useGameStore((state) => state.availableActions.length > 0);

// 获取当前玩家在房间中的位置
export const useMyPosition = () =>
  useGameStore((state) => {
    if (!state.currentRoom || !state.playerId) return null;
    const player = state.currentRoom.players.find(
      (p) => p.id === state.playerId
    );
    return player?.position ?? null;
  });

// 获取当前玩家是否是房主
export const useIsHost = () =>
  useGameStore((state) => {
    if (!state.currentRoom || !state.playerId) return false;
    return state.currentRoom.host === state.playerId;
  });
