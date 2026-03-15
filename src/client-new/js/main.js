/**
 * 主入口模块
 * 初始化应用和事件绑定
 */

import * as game from './game.js';
import * as socket from './socket.js';
import * as store from './store.js';
import * as settings from './settings.js';
import { tileStyles } from './tiles.js';

// 注入牌样式
const styleEl = document.createElement('style');
styleEl.textContent = tileStyles;
document.head.appendChild(styleEl);

// ==================== 大厅逻辑 ====================

/**
 * 显示大厅
 */
function showLobby() {
  // TODO: 实现大厅界面
  console.log('[Main] 显示大厅');
}

/**
 * 显示房间等待
 */
function showRoom() {
  // TODO: 实现房间等待界面
  console.log('[Main] 显示房间');
}

/**
 * 显示游戏界面
 */
function showGame() {
  // 游戏界面已经在 HTML 中
  console.log('[Main] 显示游戏界面');
}

// ==================== 初始化 ====================

/**
 * 应用初始化
 */
async function init() {
  console.log('[Main] 应用初始化');
  
  // 初始化游戏模块
  game.init();
  
  // 初始化设置模块
  await settings.init();
  
  // 绑定 UI 事件
  bindUIEvents();
  
  // 订阅状态变化
  store.subscribe((state, prevState) => {
    // 游戏阶段变化
    if (state.gamePhase !== prevState.gamePhase) {
      onGamePhaseChange(state.gamePhase);
    }
  });
  
  // 检查 URL 参数
  checkUrlParams();
}

/**
 * 绑定 UI 事件
 */
function bindUIEvents() {
  // 聊天输入框已在 game.js 中绑定，这里不再重复
  // 如果 game.js 没有绑定，才在这里处理
  const chatInput = document.getElementById('chat-input');
  const chatButton = document.getElementById('chat-send-btn');
  
  if (chatInput && chatButton && !window.chatInputBound) {
    const sendMessage = async () => {
      const message = chatInput.value.trim();
      if (message) {
        try {
          await socket.sendSpeech(message);
          chatInput.value = '';
          console.log('[Main] 发送消息:', message);
        } catch (e) {
          console.error('[Main] 发送失败:', e.message);
        }
      }
    };
    
    chatButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    window.chatInputBound = true;
    console.log('[Main] 聊天输入已绑定');
  }
  
  // 操作按钮点击
  document.querySelectorAll('[onclick^="window.handleAction"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.target.textContent.trim();
      game.handleAction(action.toLowerCase());
    });
  });
}

/**
 * 游戏阶段变化处理
 */
function onGamePhaseChange(phase) {
  console.log('[Main] 游戏阶段变化:', phase);
  
  switch (phase) {
    case 'waiting':
      showLobby();
      break;
    case 'playing':
      showGame();
      break;
    case 'finished':
      // 游戏结束处理在 game.js 中
      break;
  }
}

/**
 * 检查 URL 参数
 */
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const playerName = params.get('name') || '玩家' + Math.floor(Math.random() * 10000);
  
  if (roomId) {
    // 直接加入指定房间
    socket.onConnect(async () => {
      try {
        await game.joinRoom(roomId, playerName);
      } catch (e) {
        alert('加入房间失败: ' + e.message);
      }
    });
  }
}

// ==================== 调试功能 ====================

/**
 * 快速创建房间并开始游戏（调试用）
 */
window.debugQuickStart = async function(playerName = '测试玩家') {
  try {
    console.log('[Debug] 快速开始...');
    
    // 创建房间
    const result = await game.createRoom(playerName);
    console.log('[Debug] 房间创建成功:', result.roomId);
    
    // 设置准备
    await game.setReady(true);
    console.log('[Debug] 已准备');
    
    // 等待其他玩家或自动开始
    // 注意：需要 AI 玩家加入后才能开始
    
    return result.roomId;
  } catch (e) {
    console.error('[Debug] 快速开始失败:', e);
  }
};

/**
 * 获取当前状态（调试用）
 */
window.debugGetState = function() {
  return store.getState();
};

// ==================== 启动 ====================

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default { init };
