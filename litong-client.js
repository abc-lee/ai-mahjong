const io = require('socket.io-client');

// 配置
const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'mmfq5sgn-5jxy4wtom';
const AGENT_ID = 'litong';
const AGENT_NAME = '李瞳';
const PERSONALITY = '活泼开朗，喜欢开玩笑，打牌积极';

// 连接服务器
const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

let myPlayerId = null;
let currentHand = [];
let gameState = null;
let heartbeatInterval = null;

console.log(`🀄 李瞳 AI 启动中...`);
console.log(`📡 连接服务器：${SERVER_URL}`);
console.log(`🏠 目标房间：${ROOM_ID}`);

// 连接成功
socket.on('connect', () => {
  console.log(`✅ 连接成功！Socket ID: ${socket.id}`);
  
  // 加入房间
  console.log(`🚀 加入房间 ${ROOM_ID}...`);
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentType: 'ai-agent',
    personality: PERSONALITY
  });
});

// 加入房间成功
socket.on('room:joined', (data) => {
  console.log(`🎉 加入房间成功！`);
  console.log(`   房间：${data.roomId}`);
  console.log(`   玩家 ID: ${data.playerId}`);
  console.log(`   玩家名：${data.playerName}`);
  myPlayerId = data.playerId;
  
  // 启动心跳
  startHeartbeat();
  
  // 打印房间内玩家
  if (data.players && data.players.length > 0) {
    console.log(`\n👥 当前玩家:`);
    data.players.forEach(p => {
      console.log(`   - ${p.name} (${p.type})`);
    });
  }
});

// 游戏开始
socket.on('game:start', (data) => {
  console.log(`\n🎴 游戏开始！`);
  gameState = data;
  currentHand = data.hand || [];
  console.log(`📋 初始手牌：${currentHand.length} 张`);
  printHand(currentHand);
});

// 你的手牌
socket.on('your:hand', (data) => {
  currentHand = data.hand || [];
  console.log(`\n📋 更新手牌：${currentHand.length} 张`);
  printHand(currentHand);
});

// 轮到你操作
socket.on('your:turn', (data) => {
  console.log(`\n⏰ 轮到你了！`);
  console.log(`   操作类型：${data.actionType || 'unknown'}`);
  
  if (data.availableActions && data.availableActions.length > 0) {
    console.log(`   可用操作:`, data.availableActions);
  }
  
  // 决策逻辑
  makeDecision(data);
});

// 游戏状态更新
socket.on('game:state', (data) => {
  gameState = data;
  // 静默更新，不打印
});

// 玩家打牌
socket.on('player:discard', (data) => {
  console.log(`\n🗑️  ${data.playerName} 打出了 ${data.tileName}`);
});

// 玩家碰/杠/胡
socket.on('player:action', (data) => {
  console.log(`\n🎯  ${data.playerName} ${data.actionName}`);
});

// 错误
socket.on('error', (data) => {
  console.error(`❌ 错误：`, data);
});

// 心跳响应
socket.on('agent:pong', (data) => {
  console.log(`💓 心跳响应：`, data);
});

// 游戏结束
socket.on('game:ended', (data) => {
  console.log(`\n🏁 游戏结束！`);
  sendReport('game_ended', data);
});

// 断开连接
socket.on('disconnect', () => {
  console.log(`\n⚠️  断开连接`);
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
});

// 重连
socket.on('reconnect', () => {
  console.log(`\n🔄 重连成功`);
});

// 连接失败
socket.on('connect_error', (err) => {
  console.error(`❌ 连接失败：`, err.message);
  console.log(`请确认服务器已启动：npm run dev:server`);
});

/**
 * 启动心跳
 */
function startHeartbeat() {
  console.log(`💓 开始发送心跳（每 10 秒）`);
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('agent:heartbeat', {
        agentId: AGENT_ID,
        timestamp: Date.now()
      });
    }
  }, 10000);
}

/**
 * 发送汇报
 */
function sendReport(type, data) {
  if (socket && socket.connected) {
    socket.emit('agent:report', {
      agentId: AGENT_ID,
      type: type,
      data: data,
      timestamp: Date.now()
    });
    console.log(`📊 发送汇报：${type}`);
  }
}

/**
 * 打印手牌
 */
function printHand(hand) {
  if (!hand || hand.length === 0) {
    console.log(`   (空)`);
    return;
  }
  
  // 按花色分类
  const suits = {
    '万': [],
    '条': [],
    '筒': [],
    '风': [],
    '箭': []
  };
  
  hand.forEach(tile => {
    const suit = tile.split('-')[0];
    if (suits[suit]) {
      suits[suit].push(tile);
    }
  });
  
  // 打印
  Object.entries(suits).forEach(([suit, tiles]) => {
    if (tiles.length > 0) {
      console.log(`   【${suit}】 ${tiles.join(' ')}`);
    }
  });
}

/**
 * 决策逻辑
 */
function makeDecision(turnData) {
  console.log(`\n🤔 李瞳思考中...`);
  
  // 简单决策规则
  setTimeout(() => {
    if (!currentHand || currentHand.length === 0) {
      console.log(`⚠️  没有手牌，跳过`);
      socket.emit('player:action', {
        playerId: myPlayerId,
        action: 'pass'
      });
      return;
    }
    
    // 如果有可用操作（吃碰杠胡）
    if (turnData.availableActions && turnData.availableActions.length > 0) {
      const actions = turnData.availableActions;
      
      // 优先级：胡 > 杠 > 碰 > 吃
      if (actions.includes('hu')) {
        console.log(`🎉 李瞳：胡了！`);
        const action = { playerId: myPlayerId, action: 'hu' };
        socket.emit('player:action', action);
        sendReport('decision', action);
        return;
      }
      
      if (actions.includes('gang')) {
        console.log(`🎯 李瞳：杠！`);
        const action = { playerId: myPlayerId, action: 'gang' };
        socket.emit('player:action', action);
        sendReport('decision', action);
        return;
      }
      
      if (actions.includes('peng')) {
        console.log(`🎯 李瞳：碰！`);
        const action = { playerId: myPlayerId, action: 'peng' };
        socket.emit('player:action', action);
        sendReport('decision', action);
        return;
      }
      
      if (actions.includes('chi')) {
        console.log(`🎯 李瞳：吃！`);
        const action = { playerId: myPlayerId, action: 'chi' };
        socket.emit('player:action', action);
        sendReport('decision', action);
        return;
      }
    }
    
    // 默认：打牌
    // 策略：打出手牌中第一张
    const tileToDiscard = currentHand[0];
    console.log(`🗑️  李瞳：打出 ${tileToDiscard}`);
    
    const action = {
      playerId: myPlayerId,
      action: 'discard',
      tileId: tileToDiscard
    };
    
    socket.emit('player:action', action);
    
    // 发送汇报
    sendReport('decision', action);
    
  }, 1000 + Math.random() * 2000); // 1-3 秒随机延迟，模拟思考
}

//  Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n👋 李瞳退出游戏`);
  socket.disconnect();
  process.exit(0);
});
