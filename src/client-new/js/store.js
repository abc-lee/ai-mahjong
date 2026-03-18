/**
 * 游戏状态管理模块
 * 使用观察者模式的轻量级状态管理
 */

// 初始状态
const initialState = {
  // 连接状态
  connected: false,
  playerId: null,
  playerName: null,
  selectedDirection: null, // 用户选择的方位：0=东, 1=南, 2=西, 3=北
  playerScore: 0, // 累计分数

  // 房间状态
  currentRoom: null,
  rooms: [],

  // 游戏状态
  gamePhase: 'waiting', // 'waiting' | 'playing' | 'finished'
  gamePublicState: null,
  myHand: [],
  myTurn: false,
  lastDrawnTile: null,
  turnPhase: null, // 'draw' | 'discard' | 'action'
  availableActions: [],

  // 游戏结束状态
  gameEndState: null,

  // 发言系统
  speechMessages: [],
  playerEmotions: {},

  // UI 状态
  selectedTile: null,

  // 国际化
  language: 'zh-CN',
  uiTexts: null, // UI 翻译文字
};

// 当前状态
let state = { ...initialState };

// 订阅者列表
const subscribers = new Set();

/**
 * 获取当前状态
 * @returns {object} 当前状态
 */
export function getState() {
  return { ...state };
}

/**
 * 获取状态中的特定值
 * @param {string} key - 状态键名
 * @returns {any} 状态值
 */
export function getStateValue(key) {
  return state[key];
}

/**
 * 更新状态
 * @param {object} updates - 要更新的状态键值对
 */
export function setState(updates) {
  const prevState = { ...state };
  state = { ...state, ...updates };
  
  // 通知所有订阅者
  subscribers.forEach(callback => {
    try {
      callback(state, prevState);
    } catch (e) {
      console.error('[Store] 订阅者回调错误:', e);
    }
  });
}

/**
 * 订阅状态变化
 * @param {Function} callback - 回调函数 (newState, prevState)
 * @returns {Function} 取消订阅函数
 */
export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * 取消所有订阅
 */
export function clearSubscribers() {
  subscribers.clear();
}

/**
 * 重置状态到初始值
 */
export function resetState() {
  setState({ ...initialState });
}

/**
 * 重置游戏相关状态
 */
export function resetGameState() {
  setState({
    gamePhase: 'waiting',
    gamePublicState: null,
    myHand: [],
    myTurn: false,
    lastDrawnTile: null,
    turnPhase: null,
    availableActions: [],
    selectedTile: null,
    speechMessages: [],
    playerEmotions: {},
    gameEndState: null,
  });
}

// ==================== 便捷方法 ====================

/**
 * 设置连接状态
 * @param {boolean} connected - 是否已连接
 */
export function setConnected(connected) {
  setState({ connected });
  if (!connected) {
    resetState();
  }
}

/**
 * 设置玩家信息
 * @param {string} id - 玩家ID
 * @param {string} name - 玩家名称
 * @param {number} direction - 用户选择的方位
 */
export function setPlayerInfo(id, name, direction = null) {
  setState({ playerId: id, playerName: name, selectedDirection: direction });
}

/**
 * 获取用户选择的方位
 */
export function getSelectedDirection() {
  return state.selectedDirection;
}

/**
 * 设置当前房间
 * @param {object|null} room - 房间对象
 */
export function setCurrentRoom(room) {
  setState({ currentRoom: room });
  if (!room) {
    resetGameState();
  }
}

/**
 * 设置房间列表
 * @param {Array} rooms - 房间列表
 */
export function setRooms(rooms) {
  setState({ rooms });
}

/**
 * 更新游戏状态
 * @param {object} gameState - 公开游戏状态
 * @param {Array} hand - 我的手牌
 * @param {boolean} yourTurn - 是否轮到我
 * @param {object|null} lastDrawn - 最后摸的牌
 * @param {string|null} phase - 回合阶段
 */
export function updateGameState(gameState, hand, yourTurn, lastDrawn, phase) {
  setState({
    gamePublicState: gameState,
    gamePhase: gameState.phase,
    myHand: hand,
    myTurn: yourTurn,
    lastDrawnTile: lastDrawn || null,
    turnPhase: phase || null,
  });
}

/**
 * 设置可用操作
 * @param {Array} actions - 可用操作列表
 */
export function setAvailableActions(actions) {
  setState({
    availableActions: actions,
  });
}

/**
 * 清除可用操作
 */
export function clearAvailableActions() {
  setState({
    availableActions: [],
  });
}

/**
 * 设置游戏结束状态
 * @param {object|null} endState - 结束状态
 */
export function setGameEndState(endState) {
  let newScore = state.playerScore || 0;
  
  // 计算新的累计分数
  if (endState && endState.players) {
    const myId = state.playerId;
    const myResult = endState.players.find(p => p.id === myId);
    if (myResult && myResult.scoreChange) {
      newScore = newScore + myResult.scoreChange;
    }
  }
  
  setState({ 
    gameEndState: endState,
    playerScore: newScore 
  });
}

/**
 * 获取玩家累计分数
 */
export function getPlayerScore() {
  return state.playerScore || 0;
}

/**
 * 添加发言消息
 * @param {object} message - 发言消息
 */
export function addSpeechMessage(message) {
  // 过滤空内容
  if (!message.content || message.content.trim().length === 0) {
    console.log('[Store] 过滤空消息');
    return;
  }
  
  // 去重：检查是否已存在相同消息
  const exists = state.speechMessages.some(m => 
    m.playerId === message.playerId && 
    m.content === message.content &&
    Math.abs((m.timestamp || 0) - (message.timestamp || 0)) < 2000
  );
  
  if (exists) {
    console.log('[Store] 消息去重:', message.content?.substring(0, 20));
    return;
  }
  
  const messages = [...state.speechMessages, message].slice(-20); // 保留最近20条
  setState({ speechMessages: messages });
}

/**
 * 清除发言消息
 */
export function clearSpeechMessages() {
  setState({ speechMessages: [] });
}

/**
 * 设置玩家情绪
 * @param {string} playerId - 玩家ID
 * @param {object} emotion - 情绪状态
 */
export function setPlayerEmotion(playerId, emotion) {
  setState({
    playerEmotions: {
      ...state.playerEmotions,
      [playerId]: emotion,
    },
  });
}

/**
 * 选择牌
 * @param {object|null} tile - 选中的牌
 */
export function selectTile(tile) {
  setState({ selectedTile: tile });
}

// ==================== 派生状态 ====================

/**
 * 是否在房间中
 */
export function isInRoom() {
  return state.currentRoom !== null;
}

/**
 * 是否正在游戏中
 */
export function isPlaying() {
  return state.gamePhase === 'playing';
}

/**
 * 是否有可用操作
 */
export function hasActions() {
  return state.availableActions.length > 0;
}

/**
 * 获取我在房间中的位置
 */
export function getMyPosition() {
  if (!state.currentRoom || !state.playerId) return null;
  const player = state.currentRoom.players.find(p => p.id === state.playerId);
  return player?.position ?? null;
}

/**
 * 是否是房主
 */
export function isHost() {
  if (!state.currentRoom || !state.playerId) return false;
  return state.currentRoom.host === state.playerId;
}

/**
 * 设置 UI 翻译
 */
export function setUITexts(language, uiTexts) {
  state.language = language;
  state.uiTexts = uiTexts;
}

/**
 * 获取 UI 文字
 * @param {string} category - 分类：game, settings, personalities, errors
 * @param {string} key - 键名
 * @param {string} fallback - 默认值
 */
export function t(category, key, fallback = null) {
  if (!state.uiTexts) return fallback || key;
  const ui = state.uiTexts;
  return ui?.[category]?.[key] || fallback || key;
}

// 导出所有方法
export default {
  getState,
  getStateValue,
  setState,
  subscribe,
  clearSubscribers,
  resetState,
  resetGameState,
  setConnected,
  setPlayerInfo,
  setCurrentRoom,
  setRooms,
  updateGameState,
  setAvailableActions,
  clearAvailableActions,
  setGameEndState,
  addSpeechMessage,
  clearSpeechMessages,
  setPlayerEmotion,
  selectTile,
  isInRoom,
  isPlaying,
  hasActions,
  getMyPosition,
  getSelectedDirection,
  getPlayerScore,
  isHost,
  setUITexts,
  t,
};
