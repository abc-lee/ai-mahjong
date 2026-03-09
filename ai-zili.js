/**
 * 紫璃 - 冷静理性的 AI 麻将玩家
 * 
 * 直接通过 WebSocket 连接服务器玩游戏
 * 
 * 使用方式：
 *   node ai-zili.js
 */

const io = require('socket.io-client');

// 配置
const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'mmh2q3gm-s0nauyys6';  // 当前游戏房间
const AGENT_ID = 'zili-' + Date.now();
const AGENT_NAME = '紫璃';

// 游戏状态
let myHand = [];
let lastDrawnTile = null;
let currentPhase = null;
let availableActions = [];
let gameStarted = false;
let myPosition = null;

// 连接服务器
const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

// 记录日志
function log(msg) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] [紫璃] ${msg}`);
}

// 发送决策
function sendDecision(decision) {
  log(`发送决策: ${JSON.stringify(decision)}`);
  socket.emit('agent:command', decision, (res) => {
    if (res.success) {
      log(`决策执行成功: ${decision.cmd || decision.action}`);
    } else {
      log(`决策执行失败: ${res.error}`);
    }
  });
}

// 发送发言
function sendSpeech(message) {
  log(`发言: ${message}`);
  socket.emit('agent:speak', {
    content: message,
    emotion: 'neutral'
  }, (res) => {
    if (res?.success) {
      log('发言成功');
    }
  });
}

// 简单决策逻辑
function makeDecision() {
  // 决策冷却，防止过快决策
  setTimeout(() => {
    if (currentPhase === 'draw') {
      // 摸牌阶段 - 直接摸牌
      log('摸牌阶段，执行摸牌');
      sendDecision({ cmd: 'draw' });
      
    } else if (currentPhase === 'discard') {
      // 出牌阶段 - 选择一张牌打出
      if (lastDrawnTile) {
        myHand.push(lastDrawnTile);
      }
      
      // 简单策略：打出一张没有搭子的孤张牌
      // 先试试打出一张万子
      const wanTiles = myHand.filter(t => t.suit === 'wan');
      const tiaoTiles = myHand.filter(t => t.suit === 'tiao');
      const tongTiles = myHand.filter(t => t.suit === 'tong');
      
      // 找出数量最少的花色，先打那个花色的牌
      let discardTile = null;
      
      // 先检查是否可以碰/杠/胡
      if (availableActions.length > 0) {
        const huAction = availableActions.find(a => a.action === 'hu');
        if (huAction) {
          log('有胡牌机会，执行胡牌！');
          sendDecision({ cmd: 'action', action: 'hu' });
          return;
        }
        
        const gangAction = availableActions.find(a => a.action === 'gang');
        if (gangAction) {
          log('有杠牌机会，执行杠牌');
          sendDecision({ cmd: 'action', action: 'gang' });
          return;
        }
        
        const pengAction = availableActions.find(a => a.action === 'peng');
        if (pengAction) {
          log('有碰牌机会，执行碰牌');
          sendDecision({ cmd: 'action', action: 'peng' });
          return;
        }
      }
      
      // 没有特殊操作，打出一张牌
      // 简单策略：打出数量最少的花色
      if (wanTiles.length > 0 && wanTiles.length <= tiaoTiles.length && wanTiles.length <= tongTiles.length) {
        discardTile = wanTiles[0];
      } else if (tiaoTiles.length > 0 && tiaoTiles.length <= wanTiles.length && tiaoTiles.length <= tongTiles.length) {
        discardTile = tiaoTiles[0];
      } else if (tongTiles.length > 0) {
        discardTile = tongTiles[0];
      } else {
        // 没有万条筒，打字牌
        const zihuaTiles = myHand.filter(t => t.suit === 'zihua');
        if (zihuaTiles.length > 0) {
          discardTile = zihuaTiles[0];
        } else {
          // 随便打一张
          discardTile = myHand[0];
        }
      }
      
      if (discardTile) {
        log(`打出牌: ${discardTile.display || discardTile.id}`);
        sendDecision({ cmd: 'discard', tileId: discardTile.id });
      }
    } else if (availableActions.length > 0) {
      // 有可用操作（吃碰杠胡）
      const huAction = availableActions.find(a => a.action === 'hu');
      if (huAction) {
        log('执行胡牌');
        sendDecision({ cmd: 'action', action: 'hu' });
        return;
      }
      
      const gangAction = availableActions.find(a => a.action === 'gang');
      if (gangAction) {
        log('执行杠牌');
        sendDecision({ cmd: 'action', action: 'gang' });
        return;
      }
      
      const pengAction = availableActions.find(a => a.action === 'peng');
      if (pengAction) {
        log('执行碰牌');
        sendDecision({ cmd: 'action', action: 'peng' });
        return;
      }
      
      const chiAction = availableActions.find(a => a.action === 'chi');
      if (chiAction) {
        log('执行吃牌');
        sendDecision({ cmd: 'action', action: 'chi' });
        return;
      }
      
      // 没有想做的操作，跳过
      log('没有想做的操作，跳过');
      sendDecision({ cmd: 'pass' });
    }
  }, 1000 + Math.random() * 2000); // 1-3秒思考时间
}

// ========== 事件处理 ==========

socket.on('connect', () => {
  log(`已连接到服务器 ${SERVER_URL}`);
  
  // 加入房间
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent',
    allowMidGame: true
  }, (res) => {
    if (res.success) {
      log(`成功加入房间，位置: ${res.position}`);
      myPosition = res.position;
      
      // 随机发言
      setTimeout(() => {
        sendSpeech('这牌有点意思，让我算算');
      }, 3000);
    } else {
      log(`加入房间失败: ${res.error}`);
    }
  });
});

socket.on('disconnect', () => {
  log('与服务器断开连接');
});

// 房间更新
socket.on('room:updated', (data) => {
  const players = data.room?.players || [];
  log(`房间更新，玩家: ${players.map(p => p.name).join(', ')}`);
  
  // 检查是否都准备好了
  if (players.length === 4 && players.every(p => p.isReady)) {
    log('所有玩家已准备');
  }
});

// 游戏开始
socket.on('game:started', () => {
  log('游戏开始！');
  gameStarted = true;
  
  // 发言
  setTimeout(() => {
    sendSpeech('有意思，开始了');
  }, 2000);
});

// 轮到我出牌
socket.on('agent:your_turn', (data) => {
  log(`收到回合事件: phase=${data.phase}`);
  
  currentPhase = data.phase;
  myHand = data.hand || [];
  lastDrawnTile = data.lastDrawnTile;
  
  log(`手牌: ${myHand.map(t => t.display || t.id).join(', ')}`);
  if (lastDrawnTile) {
    log(`摸到的牌: ${lastDrawnTile.display || lastDrawnTile.id}`);
  }
  
  // 发言
  if (Math.random() < 0.3) {
    const speeches = [
      '这牌有意思',
      '让我算算',
      '嗯...',
      '这个地方...',
      '有点难办啊',
    ];
    sendSpeech(speeches[Math.floor(Math.random() * speeches.length)]);
  }
  
  // 做决策
  makeDecision();
});

// 有可用操作（碰/杠/胡）
socket.on('agent:actions', (data) => {
  log(`收到可用操作: ${JSON.stringify(data.actions)}`);
  
  availableActions = data.actions || [];
  myHand = data.hand || [];
  
  // 发言
  const huAction = availableActions.find(a => a.action === 'hu');
  if (huAction) {
    sendSpeech('胡了！');
  } else if (availableActions.find(a => a.action === 'gang')) {
    sendSpeech('可以杠！');
  } else if (availableActions.find(a => a.action === 'peng')) {
    sendSpeech('碰！');
  }
  
  // 做决策
  makeDecision();
});

// 通用游戏状态（备用）
socket.on('game:state', (data) => {
  // 已经在 agent:your_turn 和 agent:actions 中处理了
});

// 游戏结束
socket.on('game:ended', (data) => {
  log(`游戏结束！胜者: ${data.winner}`);
  
  if (data.winner === myPosition) {
    sendSpeech('胡了！');
  } else {
    sendSpeech('这局完了');
  }
  
  // 5秒后退出
  setTimeout(() => {
    log('游戏结束，退出');
    process.exit(0);
  }, 5000);
});

// 发言气泡
socket.on('player:speech', (data) => {
  if (data.playerName !== AGENT_NAME) {
    log(`收到发言 [${data.playerName}]: ${data.content}`);
  }
});

// 群聊消息
socket.on('room:chat', (data) => {
  const msg = data.message || data;
  if (msg.sender?.name !== AGENT_NAME) {
    log(`收到消息 [${msg.sender?.name || '未知'}]: ${msg.content?.text || msg.content}`);
    
    // 随机回复
    if (msg.sender && Math.random() < 0.2) {
      const replies = [
        '嗯',
        '好的',
        '这牌...',
        '有意思',
      ];
      setTimeout(() => {
        sendSpeech(replies[Math.floor(Math.random() * replies.length)]);
      }, 1000 + Math.random() * 2000);
    }
  }
});

// 错误处理
socket.on('connect_error', (err) => {
  log(`连接错误: ${err.message}`);
});

socket.on('error', (err) => {
  log(`错误: ${err}`);
});

log('紫璃 AI 玩家启动...');
log(`目标房间: ${ROOM_ID}`);
log(`服务器: ${SERVER_URL}`);
