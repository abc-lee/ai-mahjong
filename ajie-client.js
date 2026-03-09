const io = require('socket.io-client');

const PLAYER_NAME = '阿杰';
const ROOM_ID = 'mmfyhfky-4u60a9hny';
const SERVER_URL = 'http://localhost:3000';

let socket;
let playerId = null;
let handTiles = [];
let availableActions = [];

// 性格：沉稳冷静，话不多但精准
const PERSONALITY = {
  name: '阿杰',
  style: 'cold', // 冷静型
  talkative: 'low' // 话少
};

function speak(message, emotion = 'neutral') {
  if (!socket || !playerId) return;
  socket.emit('agent:speak', {
    playerId,
    message,
    emotion
  });
  console.log(`[${PERSONALITY.name}]: ${message}`);
}

function makeDecision(action) {
  if (!socket || !playerId) return;
  
  console.log(`[${PERSONALITY.name}] 决策:`, action);
  socket.emit('agent:decision', {
    playerId,
    action
  });
}

function analyzeHand(tiles) {
  // 简单分析手牌，找出有用的牌
  const worthless = [];
  const honors = [];
  const simples = [];
  
  tiles.forEach(tile => {
    if (tile.category === 'wind' || tile.category === 'dragon') {
      honors.push(tile);
    } else {
      simples.push(tile);
    }
  });
  
  // 优先打孤张字牌
  const honorCounts = {};
  honors.forEach(h => {
    honorCounts[h.id] = (honorCounts[h.id] || 0) + 1;
  });
  
  for (const [id, count] of Object.entries(honorCounts)) {
    if (count === 1) {
      return id; // 打孤张字牌
    }
  }
  
  // 其次打孤张数牌
  const simpleCounts = {};
  simples.forEach(s => {
    simpleCounts[s.id] = (simpleCounts[s.id] || 0) + 1;
  });
  
  for (const [id, count] of Object.entries(simpleCounts)) {
    if (count === 1) {
      return id;
    }
  }
  
  // 默认打第一张
  return tiles[0]?.id || null;
}

function handleGameState(state) {
  console.log(`\n[${PERSONALITY.name}] 收到游戏状态`);
  console.log(`阶段: ${state.phase}, 轮次: ${state.round}`);
  
  // 更新手牌
  if (state.players) {
    const myPlayer = state.players.find(p => p.id === playerId);
    if (myPlayer) {
      handTiles = myPlayer.hand || [];
      console.log(`[${PERSONALITY.name}] 手牌数: ${handTiles.length}`);
    }
  }
  
  availableActions = state.availableActions || [];
  
  // 如果轮到我行动
  if (state.currentPlayer === playerId && availableActions.length > 0) {
    handleMyTurn(state);
  }
}

function handleMyTurn(state) {
  console.log(`[${PERSONALITY.name}] 我的回合`);
  
  // 检查是否可以胡牌
  const canHu = availableActions.find(a => a.action === 'hu');
  if (canHu) {
    speak('胡了。', 'happy');
    makeDecision({ cmd: 'action', action: 'hu' });
    return;
  }
  
  // 检查是否可以碰
  const canPeng = availableActions.find(a => a.action === 'peng');
  if (canPeng) {
    // 简单策略：有对子就碰
    speak('碰。', 'neutral');
    makeDecision({ cmd: 'action', action: 'peng' });
    return;
  }
  
  // 检查是否可以杠
  const canGang = availableActions.find(a => a.action === 'gang');
  if (canGang) {
    speak('杠。', 'neutral');
    makeDecision({ cmd: 'action', action: 'gang' });
    return;
  }
  
  // 检查是否可以吃
  const canChi = availableActions.find(a => a.action === 'chi');
  if (canChi) {
    // 简单策略：能吃就吃
    speak('吃。', 'neutral');
    makeDecision({ cmd: 'action', action: 'chi' });
    return;
  }
  
  // 默认：摸牌然后打牌
  if (availableActions.find(a => a.action === 'draw')) {
    makeDecision({ cmd: 'draw' });
    return;
  }
  
  // 打牌
  const tileToDiscard = analyzeHand(handTiles);
  if (tileToDiscard) {
    const tile = handTiles.find(t => t.id === tileToDiscard);
    speak(`打${tile?.name || '牌'}`, 'neutral');
    makeDecision({ cmd: 'discard', tileId: tileToDiscard });
  } else {
    // 没有牌可打，跳过
    speak('过。', 'neutral');
    makeDecision({ cmd: 'pass' });
  }
}

function connect() {
  console.log(`[${PERSONALITY.name}] 连接服务器: ${SERVER_URL}`);
  
  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5
  });
  
  socket.on('connect', () => {
    console.log(`[${PERSONALITY.name}] 已连接`);
    speak('各位好。', 'neutral');
    
    // 加入房间
    socket.emit('room:joinAI', {
      roomId: ROOM_ID,
      name: PLAYER_NAME,
      personality: PERSONALITY
    });
  });
  
  socket.on('room:joined', (data) => {
    playerId = data.playerId;
    console.log(`[${PERSONALITY.name}] 加入房间成功，ID: ${playerId}`);
    speak('准备好了。', 'neutral');
  });
  
  socket.on('game:state', (state) => {
    handleGameState(state);
  });
  
  socket.on('game:actions', (data) => {
    console.log(`[${PERSONALITY.name}] 可用动作:`, data.actions);
    availableActions = data.actions;
    
    // 如果轮到我
    if (data.currentPlayer === playerId) {
      // 需要从 state 获取更多信息
    }
  });
  
  socket.on('game:ended', (data) => {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`[${PERSONALITY.name}] 游戏结束`);
    console.log('战果报告:');
    console.log(`  最终得分：${data.reason || '未知'}`);
    console.log('辛苦了。');
    console.log(`${'='.repeat(40)}`);
    
    // 断开连接
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 2000);
  });
  
  socket.on('disconnect', () => {
    console.log(`[${PERSONALITY.name}] 断开连接`);
  });
  
  socket.on('error', (error) => {
    console.error(`[${PERSONALITY.name}] 错误:`, error);
  });
}

// 启动
console.log(`${'='.repeat(40)}`);
console.log(`麻将 AI 玩家「${PERSONALITY.name}」启动`);
console.log(`房间: ${ROOM_ID}`);
console.log(`${'='.repeat(40)}`);

connect();

// 优雅退出
process.on('SIGINT', () => {
  console.log(`\n[${PERSONALITY.name}] 退出游戏`);
  if (socket) {
    socket.disconnect();
  }
  process.exit(0);
});
