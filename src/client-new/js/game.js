/**
 * 游戏逻辑模块
 * 处理游戏流程和 UI 更新
 */

import * as socket from './socket.js';
import * as store from './store.js';
import { renderHand, renderActionButtons, renderHiddenHand, renderTile, renderMeld, tileStyles } from './tiles.js';

// ==================== UI 更新函数 ====================

/**
 * 更新顶栏游戏信息
 */
function updateGameInfo() {
  const state = store.getState();
  const gameInfoEl = document.getElementById('game-info');
  const playerInfoEl = document.getElementById('player-info');
  
  if (!gameInfoEl || !playerInfoEl) return;
  
  // 游戏信息
  if (state.gamePublicState) {
    const gs = state.gamePublicState;
    const windNames = ['东', '南', '西', '北'];
    // roundNumber 从1开始，1-4是东风圈，5-8是南风圈，以此类推
    const currentWind = windNames[Math.floor((gs.roundNumber - 1) / 4) % 4];
    const roundInWind = ((gs.roundNumber - 1) % 4) + 1;
    
    gameInfoEl.innerHTML = `
      ${currentWind}风圈 - ${roundInWind}局 <span class="text-yellow-400 ml-2">剩 ${gs.wallRemaining} 张</span>
    `;
  }
  
  // 玩家名字
  const nameEl = document.getElementById('player-name-display');
  if (nameEl && state.playerName) {
    nameEl.textContent = state.playerName;
  }
  
  // 玩家分数 - 从房间信息中获取
  const scoreEl = document.getElementById('player-score');
  if (scoreEl && state.currentRoom) {
    const currentPlayer = state.currentRoom.players?.find(p => p.id === state.playerId);
    if (currentPlayer) {
      scoreEl.textContent = currentPlayer.score || 1000;
    }
  }
}

/**
 * 更新手牌区域
 */
function updateHandArea() {
  const state = store.getState();
  const handAreaEl = document.getElementById('hand-area');
  
  if (!handAreaEl) return;
  
  // 渲染手牌
  let html = '';
  
  // 如果是打牌阶段且轮到我，添加提示
  if (state.myTurn && state.turnPhase === 'discard') {
    html += `<div class="text-yellow-400 text-sm mb-2 animate-pulse">点击一张牌打出</div>`;
  }
  
  html += renderHand(state.myHand, state.lastDrawnTile, {
    onTileClick: true,
  });
  
  // 只替换 hand-area 的内容
  handAreaEl.innerHTML = html;
}

/**
 * 更新操作按钮
 */
function updateActionButtons() {
  const state = store.getState();
  const buttonsContainer = document.getElementById('action-buttons');
  
  if (!buttonsContainer) return;
  
  // 判断哪些操作可用
  const canDraw = state.myTurn && state.turnPhase === 'draw';
  const hasActions = state.availableActions.length > 0;
  const chiActions = state.availableActions.filter(a => a.action === 'chi');
  const pengActions = state.availableActions.filter(a => a.action === 'peng');
  const gangActions = state.availableActions.filter(a => a.action === 'gang');
  const huActions = state.availableActions.filter(a => a.action === 'hu');
  
  const canChi = chiActions.length > 0;
  const canPeng = pengActions.length > 0;
  const canGang = gangActions.length > 0;
  const canHu = huActions.length > 0;
  // 过按钮只在 action 阶段（有吃碰杠胡选择时）才显示，摸牌阶段不显示
  const canPass = hasActions && state.turnPhase === 'action';
  
  // 如果有多种吃法，存储起来供选择
  if (canChi) {
    window.chiOptions = chiActions;
  }
  
  // 存储碰操作，用于发送tiles
  if (canPeng) {
    window.pengOptions = pengActions;
  }
  
  // 生成按钮
  const newButtonsHtml = renderActionButtons({ canDraw, canChi, canPeng, canGang, canHu, canPass });
  buttonsContainer.outerHTML = newButtonsHtml;
  
  // 高亮可以参与吃碰杠的牌
  highlightActionTiles(state.availableActions);
  
  // 为吃牌添加悬停选择交互
  setupChiHoverSelection(chiActions);
}

/**
 * 高亮可以参与吃碰杠的牌
 */
function highlightActionTiles(actions) {
  // 先清除所有高亮
  document.querySelectorAll('.tile').forEach(el => {
    el.classList.remove('ring-2', 'ring-yellow-400', 'bg-yellow-50', '-translate-y-2');
  });
  
  // 收集所有涉及的牌
  const tileIds = new Set();
  actions.forEach(action => {
    if (action.tiles) {
      action.tiles.forEach(tile => tileIds.add(tile.id));
    }
  });
  
  // 高亮这些牌（轻度高亮，表示可参与）
  tileIds.forEach(id => {
    const el = document.querySelector(`[data-tile-id="${id}"]`);
    if (el) {
      el.classList.add('ring-2', 'ring-yellow-400');
    }
  });
}

/**
 * 设置吃牌点击选择交互
 */
let selectedChiCombo = null; // 当前选中的吃组合

function setupChiHoverSelection(chiActions) {
  if (!chiActions || chiActions.length === 0) return;
  
  // 清除之前的选中状态
  selectedChiCombo = null;
  
  // 构建牌ID到吃组合的映射
  const tileToCombos = new Map();
  chiActions.forEach((action, index) => {
    if (action.tiles) {
      action.tiles.forEach(tile => {
        if (!tileToCombos.has(tile.id)) {
          tileToCombos.set(tile.id, []);
        }
        tileToCombos.get(tile.id).push({ action, index });
      });
    }
  });
  
  // 为每张可吃的牌添加点击事件
  tileToCombos.forEach((combos, tileId) => {
    const el = document.querySelector(`[data-tile-id="${tileId}"]`);
    if (!el) return;
    
    // 点击选择这组吃牌
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // 清除所有抬起状态
      document.querySelectorAll('.tile').forEach(t => {
        t.classList.remove('-translate-y-4', 'bg-yellow-50');
      });
      
      // 选择第一个包含这张牌的吃组合
      const firstCombo = combos[0];
      if (firstCombo && firstCombo.action) {
        selectedChiCombo = firstCombo.action;
        
        // 抬起选中的组合牌
        if (firstCombo.action.tiles) {
          firstCombo.action.tiles.forEach(t => {
            const tileEl = document.querySelector(`[data-tile-id="${t.id}"]`);
            if (tileEl) {
              tileEl.classList.add('-translate-y-4', 'bg-yellow-50');
            }
          });
        }
      }
    });
  });
}

/**
 * 执行选中的吃牌操作
 */
async function executeSelectedChi() {
  if (!selectedChiCombo) {
    console.log('[Game] 没有选中吃牌组合');
    return;
  }
  
  const tiles = selectedChiCombo.tiles;
  try {
    await socket.performAction('chi', tiles);
    console.log('[Game] 吃牌:', tiles?.map(t => t.display).join(','));
    store.clearAvailableActions();
    selectedChiCombo = null;
  } catch (err) {
    console.error('[Game] 吃牌失败:', err.message);
  }
}

// 计时器状态
let timerInterval = null;
let lastPlayerIndex = -1;

/**
 * 更新中央计时器
 */
function updateTimer() {
  const state = store.getState();
  const timerEl = document.getElementById('timer');
  const timerNumber = document.getElementById('timer-number');
  const timerFan = document.getElementById('timer-fan');
  
  if (!timerEl || !state.gamePublicState) return;
  
  const currentPlayer = state.gamePublicState.currentPlayerIndex;
  
  // 如果玩家换了，重置计时器
  if (currentPlayer !== lastPlayerIndex) {
    lastPlayerIndex = currentPlayer;
    startCountdown(15);
  }
  
  // 如果不在游戏中，显示 -- 并停止
  if (!state.gamePublicState || state.gamePhase !== 'playing') {
    if (timerNumber) timerNumber.textContent = '--';
    if (timerFan) timerFan.style.background = 'conic-gradient(from -90deg, rgba(245, 158, 11, 0.3) 0deg, transparent 0deg)';
    stopCountdown();
    lastPlayerIndex = -1;
  }
}

/**
 * 开始倒计时
 */
function startCountdown(seconds) {
  stopCountdown();
  
  let remaining = seconds;
  const timerNumber = document.getElementById('timer-number');
  const timerFan = document.getElementById('timer-fan');
  
  // 立即显示初始值（完整扇面）
  updateFanDisplay(remaining, seconds);
  if (timerNumber) timerNumber.textContent = remaining;
  
  timerInterval = setInterval(() => {
    remaining--;
    
    if (timerNumber) {
      timerNumber.textContent = remaining;
    }
    
    // 更新扇面
    updateFanDisplay(remaining, seconds);
    
    // 时间到
    if (remaining <= 0) {
      stopCountdown();
      if (timerNumber) timerNumber.textContent = '0';
    }
  }, 1000);
}

/**
 * 更新扇面显示
 */
function updateFanDisplay(remaining, total) {
  const timerFan = document.getElementById('timer-fan');
  if (!timerFan) return;
  
  // 计算扇面角度（从12点位置顺时针）
  const percentage = remaining / total;
  const degrees = percentage * 360;
  
  // conic-gradient: from -90deg 让起点在12点位置
  timerFan.style.background = `conic-gradient(from -90deg, rgba(245, 158, 11, 0.5) 0deg, rgba(245, 158, 11, 0.5) ${degrees}deg, transparent ${degrees}deg)`;
}

/**
 * 停止倒计时
 */
function stopCountdown() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * 更新方位指示灯
 */
function updatePositionIndicator(currentPlayer) {
  // 保留但不再使用指示灯
}

/**
 * 更新其他玩家区域
 */
function updatePlayerAreas() {
  const state = store.getState();
  
  if (!state.gamePublicState || !state.currentRoom) return;
  
  const players = state.gamePublicState.players;
  if (!players || !Array.isArray(players)) {
    console.log('[Game] updatePlayerAreas: players 无效');
    return;
  }
  
  const myPosition = store.getMyPosition();
  const selectedDirection = store.getSelectedDirection() ?? 0; // 默认南
  const currentPlayerIndex = state.gamePublicState.currentPlayerIndex; // 当前出牌玩家
  
  // 顺时针顺序：东(1) → 南(0) → 西(3) → 北(2)
  const CLOCKWISE = [1, 0, 3, 2]; // 东、南、西、北对应的 direction 值
  
  // 方向值对应的字母和颜色：0=南, 1=东, 2=北, 3=西
  const DIRECTION_LETTERS = ['S', 'E', 'N', 'W'];
  const DIRECTION_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];
  const DIRECTION_ICONS = ['🔥', '☀️', '❄️', '🌙'];
  // 方向值对应的头像图片：0=南(企鹅), 1=东(熊猫), 2=北(北极熊), 3=西(白头鹰)
  const DIRECTION_AVATARS = ['./avatars/south.png', './avatars/east.png', './avatars/north.png', './avatars/west.png'];
  
  // 找到用户选的方位在顺时针数组中的索引
  const clockwiseIndex = CLOCKWISE.indexOf(selectedDirection);
  
  // 计算每个玩家的相对方位并更新对应区域
  players.forEach((player, index) => {
    // 相对方位 = (theirPosition - myPosition + 4) % 4
    // 0 = 自己，1 = 下家，2 = 对家，3 = 上家
    const relativePosition = (player.position - myPosition + 4) % 4;
    
    // 根据相对位置确定容器
    const relativeToDirection = {
      0: 'south',  // 自己在下方
      1: 'west',   // 下家在左边
      2: 'north',  // 对家在上边
      3: 'east',   // 上家在右边
    };
    const direction = relativeToDirection[relativePosition];
    
    // 计算显示的方位值：顺时针找第N个
    const displayDirection = CLOCKWISE[(clockwiseIndex + relativePosition) % 4];
    const letter = DIRECTION_LETTERS[displayDirection];
    const color = DIRECTION_COLORS[displayDirection];
    const icon = DIRECTION_ICONS[displayDirection];
    const avatarImg = DIRECTION_AVATARS[displayDirection];
    
    const areaEl = document.querySelector(`[data-position="${direction}"]`) || 
                   document.getElementById(`player-${direction}`);
    
    if (!areaEl) return;
    
    // 更新头像 - 使用图片
    const avatarEl = areaEl.querySelector('.player-avatar');
    if (avatarEl) {
      // 设置背景图片
      avatarEl.style.backgroundImage = `url('${avatarImg}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.style.backgroundColor = 'transparent';
      
      // 当前玩家闪动效果
      const isCurrentPlayer = currentPlayerIndex === index;
      if (isCurrentPlayer) {
        avatarEl.classList.add('animate-pulse-avatar');
        avatarEl.style.boxShadow = '0 0 20px 5px rgba(245, 158, 11, 0.8)';
      } else {
        avatarEl.classList.remove('animate-pulse-avatar');
        avatarEl.style.boxShadow = '';
      }
      
      // 隐藏文字和图标
      const letterEl = avatarEl.querySelector('.avatar-letter');
      if (letterEl) {
        letterEl.style.display = 'none';
      }
      const iconEl = avatarEl.querySelector('.avatar-icon');
      if (iconEl) {
        iconEl.style.display = 'none';
      }
      
      // 北边特殊处理：清空文字内容
      if (direction === 'north') {
        avatarEl.textContent = '';
      }
    }
    
    // 更新玩家名称
    const nameEl = areaEl.querySelector('.player-name');
    if (nameEl) {
      nameEl.textContent = player.name;
    }
    
    // 更新手牌数量（其他玩家显示背面）
    if (player.position !== myPosition) {
      const handEl = areaEl.querySelector('.player-hand');
      if (handEl) {
        handEl.innerHTML = renderHiddenHand(player.handCount || 13, direction);
      }
    }
    
    // 更新弃牌区
    const discardsEl = document.getElementById(`${direction}-discards`);
    if (discardsEl && player.discards && player.discards.length > 0) {
      // 检查是否是最后打出的牌
      const lastDiscard = state.gamePublicState?.lastDiscard;
      const lastDiscardPlayer = state.gamePublicState?.lastDiscardPlayer;
      const isThisPlayerLastDiscard = lastDiscardPlayer === index;
      
      let discardsHtml = '';
      player.discards.forEach(tile => {
        // 判断这张牌是否是最后打出的牌
        const isLastDiscard = isThisPlayerLastDiscard && lastDiscard && tile.id === lastDiscard.id;
        discardsHtml += renderTile(tile, { size: 'small', position: direction, isLastDiscard });
      });
      discardsEl.innerHTML = discardsHtml;
    } else if (discardsEl) {
      discardsEl.innerHTML = '';
    }
    
    // 更新副露区
    const meldsEl = document.getElementById(`${direction}-melds`);
    if (meldsEl && player.melds && player.melds.length > 0) {
      let meldsHtml = '';
      player.melds.forEach(meld => {
        meldsHtml += renderMeld(meld, direction);
      });
      meldsEl.innerHTML = meldsHtml;
    } else if (meldsEl) {
      meldsEl.innerHTML = '';
    }
  });
}

/**
 * 更新聊天消息
 */
function updateChatMessages() {
  const state = store.getState();
  const chatBox = document.querySelector('.chat-scroll');
  
  if (!chatBox) return;
  
  // 清空现有消息
  chatBox.innerHTML = '';
  
  // 添加所有消息
  state.speechMessages.forEach(msg => {
    const isMe = msg.playerId === state.playerId;
    const msgHtml = `
      <div class="flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}">
        <span class="text-[10px] text-white/50 ${isMe ? 'mr-1' : 'ml-1'}">${msg.playerName}</span>
        <div class="${isMe ? 'bg-green-600/40' : 'bg-white/10'} rounded-lg px-3 py-1 text-white max-w-[90%]">${msg.content}</div>
      </div>
    `;
    chatBox.innerHTML += msgHtml;
  });
  
  // 滚动到底部
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ==================== 游戏操作处理 ====================

/**
 * 处理牌点击事件
 */
export async function handleTileClick(tileId) {
  const state = store.getState();
  
  if (!state.myTurn) {
    console.log('[Game] 不是你的回合');
    return;
  }
  
  if (state.turnPhase === 'discard') {
    // 打牌阶段，点击牌即打出
    try {
      await socket.discardTile(tileId);
      console.log('[Game] 打牌成功:', tileId);
      store.selectTile(null);
    } catch (e) {
      console.error('[Game] 打牌失败:', e.message);
    }
  } else {
    // 其他阶段，选中牌
    const tile = state.myHand.find(t => t.id === tileId) || state.lastDrawnTile;
    if (tile && tile.id === tileId) {
      store.selectTile(tile);
      console.log('[Game] 选中牌:', tileId);
    }
  }
}

/**
 * 处理操作按钮点击
 */
export async function handleAction(action) {
  try {
    if (action === 'draw') {
      await socket.drawTile();
      console.log('[Game] 摸牌成功');
    } else if (action === 'pass') {
      await socket.passAction();
      console.log('[Game] 过');
      store.clearAvailableActions();
    } else if (action === 'hu') {
      await socket.performAction('hu');
      console.log('[Game] 胡牌!');
      store.clearAvailableActions();
    } else if (action === 'gang') {
      const state = store.getState();
      const gangAction = state.availableActions.find(a => a.action === 'gang');
      const tiles = gangAction?.tiles;
      await socket.performAction('gang', tiles);
      console.log('[Game] 杠牌');
      store.clearAvailableActions();
    } else if (action === 'peng') {
      const state = store.getState();
      const pengAction = state.availableActions.find(a => a.action === 'peng');
      console.log('[Game] 碰操作数据:', pengAction);
      await socket.performAction('peng');
      console.log('[Game] 碰牌');
      store.clearAvailableActions();
    } else if (action === 'chi') {
      // 使用选中的吃牌组合
      if (selectedChiCombo) {
        const tiles = selectedChiCombo.tiles;
        await socket.performAction('chi', tiles);
        console.log('[Game] 吃牌:', tiles?.map(t => t.display).join(','));
        selectedChiCombo = null;
      } else {
        // 如果没有选中，提示用户先选择
        console.log('[Game] 请先点击选择要吃的牌');
        return;
      }
      store.clearAvailableActions();
    }
  } catch (e) {
    console.error('[Game] 操作失败:', e.message);
  }
}

/**
 * 处理跳过操作
 */
export async function handlePass() {
  try {
    await socket.passAction();
    console.log('[Game] 跳过');
    store.clearAvailableActions();
  } catch (e) {
    console.error('[Game] 跳过失败:', e.message);
  }
}

/**
 * 处理摸牌
 */
export async function handleDraw() {
  const state = store.getState();
  
  if (!state.myTurn || state.turnPhase !== 'draw') {
    console.log('[Game] 当前不能摸牌');
    return;
  }
  
  try {
    const result = await socket.drawTile();
    console.log('[Game] 摸牌成功:', result.tile);
    // 状态会通过 game:state 事件更新
  } catch (e) {
    console.error('[Game] 摸牌失败:', e.message);
  }
}

// ==================== 聊天功能 ====================

/**
 * 设置聊天输入监听
 */
function setupChatInput() {
  // 避免重复绑定
  if (window.chatInputBound) {
    console.log('[Game] 聊天输入已绑定，跳过');
    return;
  }
  
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  
  if (!chatInput) return;
  
  // 发送发言
  const sendChat = async () => {
    const content = chatInput.value.trim();
    if (!content) return;
    
    try {
      await socket.sendSpeech(content);
      chatInput.value = '';
      console.log('[Game] 发言成功:', content);
    } catch (e) {
      console.error('[Game] 发言失败:', e.message);
    }
  };
  
  // 发送按钮点击
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendChat);
  }
  
  // 回车发送
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  });
  
  window.chatInputBound = true;
  console.log('[Game] 聊天输入已绑定');
}

// ==================== 事件监听设置 ====================

/**
 * 设置游戏事件监听
 */
export function setupGameListeners() {
  // 连接事件
  socket.onConnect(() => {
    console.log('[Game] 已连接到服务器');
    store.setConnected(true);
  });
  
  socket.onDisconnect(() => {
    console.log('[Game] 与服务器断开连接');
    store.setConnected(false);
  });
  
  // 设置聊天发送功能
  setupChatInput();
  
  // 房间事件
  socket.onRoomUpdated((data) => {
    // 服务器发送的是 { room: clientRoom }，需要提取 room
    const room = data.room || data;
    console.log('[Game] 房间更新:', room?.id, '玩家数:', room?.players?.length);
    store.setCurrentRoom(room);
    updatePositionStatus(room);
    
    // 更新开始按钮显示
    const state = store.getState();
    const startBtnContainer = document.getElementById('start-button-container');
    console.log('[Game] 检查开始按钮: host=', room.host, 'playerId=', state.playerId, 'state=', room.state);
    if (startBtnContainer) {
      // 房主在 waiting 或 finished 状态可以开始游戏
      if (room.host === state.playerId && (room.state === 'waiting' || room.state === 'finished')) {
        startBtnContainer.classList.remove('hidden');
        console.log('[Game] 显示开始按钮');
      } else {
        startBtnContainer.classList.add('hidden');
      }
    }
  });
  
  socket.onRoomError((message) => {
    console.error('[Game] 房间错误:', message);
    alert(message);
  });
  
  // 游戏状态事件
  socket.onGameState((data) => {
    // 服务器发送的是一个对象 { state, yourHand, yourTurn, lastDrawnTile, turnPhase, availableActions }
    const gameState = data.state;
    const hand = data.yourHand || [];
    const myTurn = data.yourTurn;
    const lastDrawn = data.lastDrawnTile;
    const turnPhase = data.turnPhase;
    const availableActions = data.availableActions || [];
    
    console.log('[Game] 游戏状态更新', { myTurn, turnPhase, handCount: hand?.length || 0, actionsCount: availableActions.length, actions: availableActions.map(a => a.action) });
    
    store.updateGameState(gameState, hand, myTurn, lastDrawn, turnPhase);
    
    // 更新可用操作（无论是否有操作都要更新）
    store.setAvailableActions(availableActions);
    
    // 更新 UI
    updateGameInfo();
    updateHandArea();
    updateTimer();
    updatePlayerAreas();
    updateActionButtons();  // 每次状态更新都刷新按钮
  });
  
  // 可用操作事件
  socket.onActions((data) => {
    const actions = data.actions || data;
    console.log('[Game] 可用操作:', actions);
    store.setAvailableActions(actions);
    updateActionButtons();
  });
  
  // 游戏结束事件
  socket.onGameEnded((data) => {
    const winner = data.winner;
    const winningHand = data.winningHand;
    const players = data.players;
    console.log('[Game] 游戏结束，获胜者:', winner);
    console.log('[Game] 分数变化:', players?.map(p => `${p.name}=${p.scoreChange}`).join(', '));
    
    // 更新 currentRoom 中玩家的分数
    const state = store.getState();
    if (state.currentRoom && players) {
      const updatedPlayers = state.currentRoom.players.map(p => {
        const updated = players.find(up => up.id === p.id);
        if (updated) {
          return { ...p, score: updated.score };
        }
        return p;
      });
      store.setCurrentRoom({ ...state.currentRoom, players: updatedPlayers });
      
      // 立即更新其他玩家的分数显示
      updatePlayerScores(updatedPlayers);
    }
    
    store.setGameEndState({ winner, winningHand, players });
    showGameEndDialog(winner, winningHand, players);
  });
  
  socket.onGameError((message) => {
    console.error('[Game] 游戏错误:', message);
    alert(message);
  });
  
  // 发言系统
  socket.onPlayerSpeech((data) => {
    console.log('[Game] 玩家发言:', data);
    store.addSpeechMessage(data);
    updateChatMessages();
  });
  
  socket.onPlayerEmotion((data) => {
    console.log('[Game] 玩家情绪:', data);
    store.setPlayerEmotion(data.playerId, data.emotion);
  });
  
  // 状态订阅 - 自动更新 UI
  store.subscribe((newState, prevState) => {
    // 手牌变化时更新
    if (newState.myHand !== prevState.myHand || newState.lastDrawnTile !== prevState.lastDrawnTile) {
      updateHandArea();
    }
    // 可用操作变化时更新
    if (newState.availableActions !== prevState.availableActions) {
      updateActionButtons();
    }
  });
}

/**
 * 显示游戏结束对话框
 */
function showGameEndDialog(winner, winningHand, players) {
  const state = store.getState();
  const winnerPlayer = winner !== null ? state.currentRoom?.players[winner] : null;
  const isWinner = winnerPlayer?.id === state.playerId;
  const isDraw = winner === null; // 流局
  
  // 计算分数变化
  const scoreChanges = players || [];
  
  // 国际化文字
  const t = (cat, key, fallback) => store.t(cat, key, fallback);
  const drawText = t('game', 'drawGame', '流局');
  const winText = t('game', 'winner', '赢家');
  const scoresText = t('game', 'scores', '本局得分');
  const newRoundText = t('game', 'newRound', '再来一局');
  
  // 创建弹窗 HTML
  const modalHtml = `
    <div id="game-end-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[300]">
      <div class="bg-gradient-to-b from-amber-900 to-amber-950 rounded-2xl p-8 max-w-md w-full mx-4 text-center border-4 border-amber-600 shadow-2xl">
        <div class="text-6xl mb-4">${isDraw ? '🤝' : (isWinner ? '🎉' : '😢')}</div>
        <h2 class="text-2xl font-bold text-amber-100 mb-2">
          ${isDraw ? drawText : (isWinner ? `🎉 ${winText}!` : `${winnerPlayer?.name || 'Player'} ${winText}`)}
        </h2>
        ${!isDraw && winningHand?.fans ? `
          <div class="text-amber-300 mb-4">
            ${winningHand.fans.map(f => f.name).join(', ')}
          </div>
        ` : ''}
        <div class="bg-black/30 rounded-lg p-4 mb-6">
          <div class="text-amber-100 text-lg mb-2">${scoresText}</div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            ${scoreChanges.map(p => `
              <div class="text-white/70">${p.name}</div>
              <div class="${(p.scoreChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'} font-bold">
                ${(p.scoreChange || 0) >= 0 ? '+' : ''}${p.scoreChange || 0}
              </div>
            `).join('')}
          </div>
        </div>
        <button id="play-again-btn" class="px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-full text-xl transition-all hover:scale-105">
          ${newRoundText}
        </button>
      </div>
    </div>
  `;
  
  // 添加到页面
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // 更新顶栏分数显示 - 使用服务端同步的分数
  const myId = state.playerId;
  const myResult = scoreChanges.find(p => p.id === myId);
  if (myResult) {
    const scoreEl = document.getElementById('player-score');
    if (scoreEl) {
      // 直接使用服务端返回的最新分数
      scoreEl.textContent = myResult.score || 1000;
    }
  }
  
  // 绑定按钮事件
  document.getElementById('play-again-btn')?.addEventListener('click', async () => {
    // 移除弹窗
    document.getElementById('game-end-modal')?.remove();
    // 请求服务器开始新一局
    try {
      const result = await socket.startGame();
      console.log('[Game] 新一局开始:', result);
    } catch (e) {
      console.error('[Game] 开始新一局失败:', e.message);
      // 显示错误提示
      alert('开始新一局失败: ' + e.message + '\n\n请刷新页面重新开始');
    }
  });
}

// ==================== 公开 API ====================

/**
 * 创建房间
 */
export async function createRoom(playerName) {
  try {
    const result = await socket.createRoom(playerName);
    store.setPlayerInfo(result.playerId || socket.socket.id, playerName);
    store.setCurrentRoom(result.room);
    console.log('[Game] 创建房间成功:', result.roomId);
    return result;
  } catch (e) {
    console.error('[Game] 创建房间失败:', e.message);
    throw e;
  }
}

/**
 * 加入房间
 */
export async function joinRoom(roomId, playerName) {
  try {
    const result = await socket.joinRoom(roomId, playerName);
    store.setPlayerInfo(result.playerId || socket.socket.id, playerName);
    store.setCurrentRoom(result.room);
    console.log('[Game] 加入房间成功:', result.roomId);
    return result;
  } catch (e) {
    console.error('[Game] 加入房间失败:', e.message);
    throw e;
  }
}

/**
 * 设置准备状态
 */
export async function setReady(ready) {
  try {
    const result = await socket.setReady(ready);
    console.log('[Game] 准备状态:', ready);
    return result;
  } catch (e) {
    console.error('[Game] 设置准备失败:', e.message);
    throw e;
  }
}

/**
 * 开始游戏
 */
export async function startGame() {
  try {
    await socket.startGame();
    console.log('[Game] 开始游戏');
  } catch (e) {
    console.error('[Game] 开始游戏失败:', e.message);
    throw e;
  }
}

/**
 * 连接并初始化
 */
export function init() {
  console.log('[Game] 初始化游戏模块');
  setupPositionModal();
  socket.connect();
  setupGameListeners();
}

/**
 * 设置方位选择弹窗
 */
function setupPositionModal() {
  const modal = document.getElementById('position-modal');
  const startBtnContainer = document.getElementById('start-button-container');
  const startBtn = document.getElementById('start-game-btn');
  const nameInput = document.getElementById('player-name-input');
  
  if (!modal) return;
  
  // 绑定方位按钮点击事件
  const positionButtons = modal.querySelectorAll('[data-position]');
  positionButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const position = parseInt(btn.dataset.position);
      const playerName = (nameInput?.value || '').trim();
      
      // 检查名字是否为空
      if (!playerName) {
        alert('请输入你的昵称');
        nameInput?.focus();
        return;
      }
      
      // 检查位置是否已占用
      if (btn.classList.contains('opacity-50')) {
        alert('该位置已被占用，请选择其他位置');
        return;
      }
      
      try {
        // 先获取现有等待中的房间
        const roomList = await socket.getRoomList();
        let roomId = null;
        
        // 先设置 playerId（用 socket.id），避免事件触发时 playerId 为 null
        const socketId = socket.socket?.id;
        if (socketId) {
          store.setPlayerInfo(socketId, playerName, position);
        }
        
        if (roomList.rooms && roomList.rooms.length > 0) {
          // 有等待中的房间，加入
          roomId = roomList.rooms[0].id;
          console.log('[Game] 加入现有房间:', roomId);
          const result = await socket.joinRoom(roomId, playerName);
          // 更新 playerId（服务器可能返回不同的 id）
          if (result.playerId) {
            store.setPlayerInfo(result.playerId, playerName, position);
          }
          store.setCurrentRoom(result.room);
        } else {
          // 没有等待中的房间，创建新房间
          console.log('[Game] 创建新房间');
          const result = await socket.createRoom(playerName);
          // 更新 playerId
          if (result.playerId) {
            store.setPlayerInfo(result.playerId, playerName, position);
          }
          store.setCurrentRoom(result.room);
          
          // 第一个进入的人显示开始按钮
          if (startBtnContainer) {
            startBtnContainer.classList.remove('hidden');
          }
        }
        
        // 隐藏弹窗
        modal.classList.add('hidden');
        
        console.log('[Game] 选择座位成功，方位:', position);
      } catch (e) {
        console.error('[Game] 加入游戏失败:', e.message);
        alert('加入游戏失败: ' + e.message);
      }
    });
  });
  
  // 开始按钮点击事件
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        // 先根据配置添加 AI/NPC 玩家
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        if (config?.players) {
          const { aiCount, npcCount, aiPlayers } = config.players;
          const state = store.getState();
          const roomId = state.currentRoom?.id;
          
          console.log('[Game] 配置:', { aiCount, npcCount, aiPlayers });
          
          // 当前房间玩家数量
          const currentPlayers = state.currentRoom?.players?.length || 1;
          const maxPlayers = 4;
          const availableSlots = maxPlayers - currentPlayers;
          
          console.log(`[Game] 当前玩家: ${currentPlayers}, 可用位置: ${availableSlots}`);
          
          // 计算实际能添加的 AI 和 NPC 数量
          let actualAiCount = Math.min(aiCount, availableSlots);
          let actualNpcCount = Math.min(npcCount, availableSlots - actualAiCount);
          
          if (actualAiCount < aiCount) {
            console.log(`[Game] 警告: 设置 ${aiCount} 个AI，但只有 ${availableSlots} 个位置，实际添加 ${actualAiCount} 个`);
          }
          if (actualNpcCount < npcCount) {
            console.log(`[Game] 警告: 设置 ${npcCount} 个NPC，但只剩 ${availableSlots - actualAiCount} 个位置，实际添加 ${actualNpcCount} 个`);
          }
          
          // 添加 AI 玩家（使用配置的名字）
          for (let i = 0; i < actualAiCount; i++) {
            const aiConfig = aiPlayers?.[i] || { name: `AI${i + 1}`, personality: 'balanced' };
            
            const addRes = await fetch('/api/room/add-player', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                name: aiConfig.name,
                personality: aiConfig.personality,
                type: 'ai-agent'  // AI Agent 类型
              })
            });
            
            const addResult = await addRes.json();
            if (!addResult.success) {
              console.error('[Game] 添加 AI Agent 失败:', addResult.error);
            } else {
              console.log('[Game] 添加 AI Agent:', addResult);
            }
          }
          
          // 添加 NPC 玩家
          for (let i = 0; i < actualNpcCount; i++) {
            const addRes = await fetch('/api/room/add-player', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId,
                name: `NPC${i + 1}`,
                type: 'npc'  // NPC 类型
              })
            });
            
            const addResult = await addRes.json();
            if (!addResult.success) {
              console.error('[Game] 添加 NPC 失败:', addResult.error);
            } else {
              console.log('[Game] 添加 NPC:', addResult);
            }
          }
        }
        
        // 开始游戏
        await socket.startGame();
        startBtnContainer.classList.add('hidden');
        console.log('[Game] 游戏开始');
      } catch (e) {
        console.error('[Game] 开始游戏失败:', e.message);
        alert('开始游戏失败: ' + e.message);
      }
    });
  }
}

/**
 * 更新方位选择弹窗中的玩家状态
 */
function updatePositionStatus(room) {
  if (!room || !room.players) {
    console.log('[Game] updatePositionStatus: room 或 players 为空');
    return;
  }
  
  const positionMap = {
    0: 'south',
    1: 'east',
    2: 'north',
    3: 'west',
  };
  
  // 重置所有位置状态
  Object.values(positionMap).forEach(pos => {
    const btn = document.getElementById(`pos-${pos}`);
    const status = document.getElementById(`pos-${pos}-status`);
    if (btn) {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (status) {
      status.textContent = '空';
    }
  });
  
  // 更新已占用的位置
  room.players.forEach(player => {
    const posName = positionMap[player.position];
    const btn = document.getElementById(`pos-${posName}`);
    const status = document.getElementById(`pos-${posName}-status`);
    if (btn) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (status) {
      status.textContent = player.name;
    }
  });
  
  // 同时更新主游戏界面的玩家状态（等待阶段）
  updateWaitingPlayers(room);
}

/**
 * 更新等待阶段的玩家显示（游戏开始前）
 */
function updateWaitingPlayers(room) {
  if (!room || !room.players) return;
  
  const state = store.getState();
  const myPosition = store.getMyPosition();
  const selectedDirection = store.getSelectedDirection() ?? 0;
  
  // 顺时针顺序：东(1) → 南(0) → 西(3) → 北(2)
  const CLOCKWISE = [1, 0, 3, 2];
  
  // 方向值对应的字母和颜色：0=南, 1=东, 2=北, 3=西
  const DIRECTION_LETTERS = ['S', 'E', 'N', 'W'];
  const DIRECTION_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];
  const DIRECTION_ICONS = ['🔥', '☀️', '❄️', '🌙'];
  // 方向值对应的头像图片：0=南(企鹅), 1=东(熊猫), 2=北(北极熊), 3=西(白头鹰)
  const DIRECTION_AVATARS = ['./avatars/south.png', './avatars/east.png', './avatars/north.png', './avatars/west.png'];
  
  // 找到用户选的方位在顺时针数组中的索引
  const clockwiseIndex = CLOCKWISE.indexOf(selectedDirection);
  
  // UI容器映射
  const relativeToDirection = {
    0: 'south',
    1: 'west',
    2: 'north',
    3: 'east',
  };
  
  // 重置所有玩家区域
  Object.values(relativeToDirection).forEach(dirName => {
    const areaEl = document.querySelector(`[data-position="${dirName}"]`) || 
                   document.getElementById(`player-${dirName}`);
    if (areaEl) {
      const nameEl = areaEl.querySelector('.player-name');
      if (nameEl) {
        nameEl.textContent = '等待中';
      }
      const scoreEl = areaEl.querySelector('.player-score');
      if (scoreEl) {
        scoreEl.textContent = '0';
      }
      const avatarEl = areaEl.querySelector('.player-avatar');
      if (avatarEl) {
        // 重置为默认状态
        avatarEl.style.backgroundImage = '';
        avatarEl.style.backgroundSize = '';
        avatarEl.style.backgroundPosition = '';
        avatarEl.style.backgroundColor = '#374151';
        const letterEl = avatarEl.querySelector('.avatar-letter');
        const iconEl = avatarEl.querySelector('.avatar-icon');
        if (letterEl) {
          letterEl.textContent = '?';
          letterEl.style.display = '';
        }
        if (iconEl) {
          iconEl.textContent = '';
          iconEl.style.display = '';
        }
        if (dirName === 'north') {
          avatarEl.textContent = '?';
        }
      }
    }
  });
  
  // 更新已加入的玩家
  room.players.forEach(player => {
    // 相对方位 = (theirPosition - myPosition + 4) % 4
    const relativePosition = (player.position - myPosition + 4) % 4;
    const direction = relativeToDirection[relativePosition];
    
    // 计算显示的方位值：顺时针找第N个
    const displayDirection = CLOCKWISE[(clockwiseIndex + relativePosition) % 4];
    const letter = DIRECTION_LETTERS[displayDirection];
    const color = DIRECTION_COLORS[displayDirection];
    const icon = DIRECTION_ICONS[displayDirection];
    const avatarImg = DIRECTION_AVATARS[displayDirection];
    
    const areaEl = document.querySelector(`[data-position="${direction}"]`) || 
                   document.getElementById(`player-${direction}`);
    if (areaEl) {
      const nameEl = areaEl.querySelector('.player-name');
      if (nameEl) {
        nameEl.textContent = player.name;
      }
      
      // 更新分数
      const scoreEl = areaEl.querySelector('.player-score');
      if (scoreEl) {
        scoreEl.textContent = player.score || 1000;
      }
      
      // 更新头像 - 使用图片
      const avatarEl = areaEl.querySelector('.player-avatar');
      if (avatarEl) {
        // 设置背景图片
        avatarEl.style.backgroundImage = `url('${avatarImg}')`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.style.backgroundColor = 'transparent';
        
        // 隐藏文字和图标
        const letterEl = avatarEl.querySelector('.avatar-letter');
        if (letterEl) {
          letterEl.style.display = 'none';
        }
        const iconEl = avatarEl.querySelector('.avatar-icon');
        if (iconEl) {
          iconEl.style.display = 'none';
        }
        
        // 北边特殊处理
        if (direction === 'north') {
          avatarEl.textContent = '';
        }
      }
      
      // 添加类型标识
      const statusEl = areaEl.querySelector('.player-status');
      if (statusEl) {
        if (player.type === 'ai-agent') {
          statusEl.textContent = '🤖 AI';
        } else if (player.type === 'npc') {
          statusEl.textContent = '💻 NPC';
        } else {
          statusEl.textContent = player.isReady ? '已准备' : '';
        }
      }
    }
  });
  
  // 更新聊天室人数
  const chatHeader = document.querySelector('#chat-header .font-bold');
  if (chatHeader) {
    chatHeader.textContent = `赛事聊天室 (${room.players.length}人)`;
  }
  
  // 更新顶栏玩家名称和分数
  const currentPlayer = room.players.find(p => p.id === state.playerId);
  if (currentPlayer) {
    const playerInfoEl = document.getElementById('player-info');
    if (playerInfoEl) {
      const nameSpan = document.getElementById('player-name-display');
      if (nameSpan) {
        nameSpan.textContent = currentPlayer.name;
      }
    }
    // 更新分数 - 直接使用服务端同步的分数
    const scoreEl = document.getElementById('player-score');
    if (scoreEl) {
      // 使用服务端的分数，而不是 store 中累计的
      scoreEl.textContent = currentPlayer.score || 1000;
    }
  }
  
  console.log('[Game] 更新等待玩家:', room.players.map(p => `${p.name}(${p.position})`));
}

/**
 * 更新其他玩家的分数显示
 */
function updatePlayerScores(players) {
  const state = store.getState();
  const myPosition = store.getMyPosition();
  
  if (myPosition === null || myPosition === undefined) return;
  
  const relativeToDirection = ['south', 'west', 'north', 'east'];
  
  players.forEach(player => {
    // 相对方位
    const relativePosition = (player.position - myPosition + 4) % 4;
    const direction = relativeToDirection[relativePosition];
    
    const areaEl = document.querySelector(`[data-position="${direction}"]`) || 
                   document.getElementById(`player-${direction}`);
    if (areaEl) {
      const scoreEl = areaEl.querySelector('.player-score');
      if (scoreEl) {
        scoreEl.textContent = player.score || 1000;
      }
    }
  });
}

// 导出到全局（供 HTML onclick 使用）
window.handleTileClick = handleTileClick;
window.handleAction = handleAction;
window.handlePass = handlePass;
window.handleDraw = handleDraw;

export default {
  init,
  createRoom,
  joinRoom,
  setReady,
  startGame,
  handleTileClick,
  handleAction,
  handlePass,
  handleDraw,
};
