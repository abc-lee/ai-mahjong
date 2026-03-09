const io = require('socket.io-client');

// 配置
const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'mmfqhyij-6cj4o3clu';
const AGENT_ID = 'baize';
const AGENT_NAME = '白泽';

// 连接服务器
const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// 当前游戏状态
let gameState = null;
let myHand = [];
let availableActions = [];
let myPlayerInfo = null;
let heartbeatInterval = null;

console.log(`\n🀄 白泽 AI 正在连接 ${SERVER_URL}...`);

// ────────────────────────────────────────
// 连接事件
// ────────────────────────────────────────
socket.on('connect', () => {
  console.log(`\n✅ 已连接到服务器 (Socket ID: ${socket.id})`);
  console.log(`🚪 正在加入房间 ${ROOM_ID}...`);
  
  // 加入房间（带回调）
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    agentType: 'ai-agent'
  }, (response) => {
    if (response && response.success) {
      console.log(`\n✅ 加入房间成功！`);
      console.log(`   玩家 ID: ${response.playerId}`);
      console.log(`   位置：${response.position}`);
      myPlayerInfo = { id: response.playerId, position: response.position, name: AGENT_NAME, type: 'ai-agent' };
    } else {
      console.error(`\n❌ 加入房间失败：${response?.error || '未知错误'}`);
      console.log(`   等待房间更新事件...`);
    }
  });
});

socket.on('connect_error', (error) => {
  console.error(`\n❌ 连接失败：${error.message}`);
  console.log('请确保游戏服务器已启动 (npm run dev:server)');
});

socket.on('disconnect', (reason) => {
  console.log(`\n⚠️  已断开连接：${reason}`);
});

// ────────────────────────────────────────
// 房间事件
// ────────────────────────────────────────
socket.on('room:joined', (data) => {
  console.log(`\n🎉 成功加入房间!`);
  console.log(`   房间：${data.roomId}`);
  console.log(`   玩家数：${data.playerCount}/4`);
  myPlayerInfo = data.player;
  console.log(`   我的玩家信息：`, myPlayerInfo);
  
  // 启动心跳
  startHeartbeat();
  
  if (data.players) {
    console.log(`   玩家列表:`);
    data.players.forEach(p => {
      const type = p.type === 'ai-agent' ? '🤖 AI' : p.type === 'human' ? '👤 人类' : '🤖 托管';
      console.log(`     - ${p.name} (${type})`);
    });
  }
});

// 监听房间更新（服务器发送这个事件）
socket.on('room:updated', (data) => {
  console.log(`\n📋 房间更新:`);
  console.log(`   房间：${data.room.id}`);
  console.log(`   玩家数：${data.room.players.length}/4`);
  if (data.room.players) {
    console.log(`   玩家列表:`);
    data.room.players.forEach(p => {
      const type = p.type === 'ai-agent' ? '🤖 AI' : p.type === 'human' ? '👤 人类' : '🤖 托管';
      console.log(`     - ${p.name} (${type}) - 位置${p.position}`);
      if (p.id === AGENT_ID) {
        myPlayerInfo = p;
        console.log(`   ^^^ 这是我！`);
        startHeartbeat();
      }
    });
  }
});

socket.on('room:playerJoined', (data) => {
  console.log(`\n👤 新玩家加入：${data.player.name}`);
});

socket.on('room:full', () => {
  console.log(`\n🎲 房间已满，等待游戏开始...`);
});

// ────────────────────────────────────────
// 游戏事件
// ────────────────────────────────────────
socket.on('game:starting', (data) => {
  console.log(`\n🀄 游戏即将开始!`);
  console.log(`   庄家：${data.dealer}`);
  console.log(`   你的位置：${data.playerPosition}`);
});

socket.on('game:state', (data) => {
  gameState = data;
  
  // 更新手牌
  if (data.players) {
    const me = data.players.find(p => p.id === AGENT_ID);
    if (me) {
      myHand = me.hand || [];
    }
  }
});

socket.on('game:actions', (data) => {
  availableActions = data.actions || [];
  
  // 检查是否轮到我行动
  const myAction = availableActions.find(a => a.playerId === AGENT_ID);
  if (myAction) {
    console.log(`\n🎴 【该我行动了】`);
    console.log(`   可执行操作：${myAction.allowedActions.join(', ')}`);
    
    // 显示当前手牌
    if (myHand.length > 0) {
      console.log(`\n   我的手牌 (${myHand.length}张):`);
      displayHand(myHand);
    }
    
    // 决策
    makeDecision(myAction);
  }
});

socket.on('game:actionResult', (data) => {
  console.log(`\n📝 ${data.playerName} 执行了 ${data.action}`);
  if (data.tile) {
    console.log(`   牌：${formatTile(data.tile)}`);
  }
  
  // 如果是我的打牌行动，发送汇报
  if (data.playerId === AGENT_ID && data.action === 'discard' && data.tile) {
    sendReport('discard', formatTile(data.tile));
  }
});

socket.on('game:turn', (data) => {
  console.log(`\n🎯 ${data.playerName} 的回合`);
});

socket.on('game:ended', (data) => {
  console.log(`\n🏁 游戏结束!`);
  if (data.winner) {
    console.log(`   获胜者：${data.winner}`);
  }
  if (data.reason) {
    console.log(`   原因：${data.reason}`);
  }
});

// ────────────────────────────────────────
// 心跳和汇报
// ────────────────────────────────────────
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, 10000); // 每 10 秒
  
  console.log(`\n💓 心跳已启动（每 10 秒）`);
}

function sendHeartbeat() {
  if (!myPlayerInfo) return;
  
  socket.emit('agent:heartbeat', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    status: 'active',
    timestamp: Date.now()
  });
  console.log(`[心跳] 发送心跳...`);
}

function sendReport(actionType, detail = null) {
  if (!myPlayerInfo) return;
  
  socket.emit('agent:report', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    action: actionType,
    detail: detail,
    timestamp: Date.now()
  });
  console.log(`[汇报] 已报告：${actionType}${detail ? ' - ' + detail : ''}`);
}

// ────────────────────────────────────────
// 辅助函数
// ────────────────────────────────────────
function displayHand(hand) {
  const suits = {
    'wan': '万',
    'tong': '筒',
    'tiao': '条',
    'feng': '风',
    'jian': '箭'
  };
  
  const bySuit = {};
  hand.forEach(tile => {
    const suit = tile.type;
    if (!bySuit[suit]) bySuit[suit] = [];
    bySuit[suit].push(tile);
  });
  
  let output = '   ';
  Object.keys(bySuit).forEach(suit => {
    const suitName = suits[suit] || suit;
    const tiles = bySuit[suit].map(t => formatTileShort(t)).join(' ');
    output += `[${suitName}] ${tiles}  `;
  });
  console.log(output);
}

function formatTile(tile) {
  const names = {
    '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
    'east': '东风', 'south': '南风', 'west': '西风', 'north': '北风',
    'red': '红中', 'green': '发财', 'white': '白板'
  };
  
  const suffixes = {
    'wan': '万',
    'tong': '筒',
    'tiao': '条',
    'feng': '',
    'jian': ''
  };
  
  if (tile.type === 'feng' || tile.type === 'jian') {
    return names[tile.value];
  }
  return names[tile.value] + suffixes[tile.type];
}

function formatTileShort(tile) {
  const numNames = {
    '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'
  };
  
  if (tile.type === 'wan') return numNames[tile.value] + '万';
  if (tile.type === 'tong') return numNames[tile.value] + '筒';
  if (tile.type === 'tiao') return numNames[tile.value] + '条';
  if (tile.type === 'feng') {
    const fengNames = { 'east': '东', 'south': '南', 'west': '西', 'north': '北' };
    return fengNames[tile.value];
  }
  if (tile.type === 'jian') {
    const jianNames = { 'red': '中', 'green': '发', 'white': '白' };
    return jianNames[tile.value];
  }
  return '?';
}

// ────────────────────────────────────────
// AI 决策逻辑（白泽版）
// ────────────────────────────────────────
function makeDecision(action) {
  console.log(`\n🤔 白泽思考中...`);
  
  // 简单决策逻辑（可以扩展）
  setTimeout(() => {
    if (action.allowedActions.includes('hu')) {
      console.log(`✨ 白泽：胡了！`);
      socket.emit('game:action', {
        roomId: ROOM_ID,
        playerId: AGENT_ID,
        action: 'hu'
      });
      return;
    }
    
    if (action.allowedActions.includes('gang')) {
      console.log(`✨ 白泽：杠！`);
      socket.emit('game:action', {
        roomId: ROOM_ID,
        playerId: AGENT_ID,
        action: 'gang'
      });
      return;
    }
    
    if (action.allowedActions.includes('peng')) {
      console.log(`✨ 白泽：碰！`);
      socket.emit('game:action', {
        roomId: ROOM_ID,
        playerId: AGENT_ID,
        action: 'peng'
      });
      return;
    }
    
    // 默认打牌
    if (action.allowedActions.includes('discard') && myHand.length > 0) {
      // 白泽的策略：先打孤张字牌
      const tileToDiscard = findDiscardTile(myHand);
      if (tileToDiscard) {
        console.log(`✨ 白泽：打 ${formatTile(tileToDiscard)}`);
        socket.emit('game:action', {
          roomId: ROOM_ID,
          playerId: AGENT_ID,
          action: 'discard',
          tileId: tileToDiscard.id
        });
      }
      return;
    }
    
    // 摸牌
    if (action.allowedActions.includes('draw')) {
      console.log(`✨ 白泽：摸牌`);
      socket.emit('game:action', {
        roomId: ROOM_ID,
        playerId: AGENT_ID,
        action: 'draw'
      });
      return;
    }
    
    // 跳过
    console.log(`✨ 白泽：过`);
    socket.emit('game:action', {
      roomId: ROOM_ID,
      playerId: AGENT_ID,
      action: 'pass'
    });
  }, 1000 + Math.random() * 2000); // 1-3 秒思考时间
}

function findDiscardTile(hand) {
  // 优先打孤张字牌
  const honorTiles = hand.filter(t => t.type === 'feng' || t.type === 'jian');
  if (honorTiles.length > 0) {
    // 找单张
    const honorCounts = {};
    honorTiles.forEach(t => {
      const key = `${t.type}-${t.value}`;
      honorCounts[key] = (honorCounts[key] || 0) + 1;
    });
    
    for (const key in honorCounts) {
      if (honorCounts[key] === 1) {
        return honorTiles.find(t => `${t.type}-${t.value}` === key);
      }
    }
    return honorTiles[0];
  }
  
  // 其次打孤张数牌
  const numberTiles = hand.filter(t => t.type !== 'feng' && t.type !== 'jian');
  if (numberTiles.length > 0) {
    return numberTiles[0];
  }
  
  return hand[0];
}

// ────────────────────────────────────────
// 优雅退出
// ────────────────────────────────────────
process.on('SIGINT', () => {
  console.log(`\n\n👋 白泽退出游戏`);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  socket.disconnect();
  process.exit(0);
});
