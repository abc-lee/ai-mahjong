/**
 * 小明 - 麻将 AI 玩家客户端 (重连版)
 * 性格：活泼、激进、喜欢冒险
 */

const io = require('socket.io-client');

const ROOM_ID = 'mmg6g03e-2munypjof';
const AGENT_ID = 'xiaoming-agent-new';  // 使用新 ID
const AGENT_NAME = '小明';

// 连接游戏服务器
const socket = io('http://localhost:3000');

// 游戏状态
let myHand = [];
let myPosition = -1;
let lastDrawnTile = null;
let turnPhase = null;
let playerId = null;

// ========== 连接和加入 ==========

socket.on('connect', () => {
  console.log('🔌 已连接到游戏服务器');
  
  // 尝试重连（如果之前是小明）
  socket.emit('agent:reconnect', {
    roomId: ROOM_ID,
    agentId: AGENT_ID
  }, (res) => {
    if (res.success) {
      console.log(`✅ 重连成功！位置：${res.playerId}`);
      playerId = res.playerId;
    } else {
      console.log(`ℹ️  重连失败，尝试新加入: ${res.error}`);
      // 重连失败，尝试新加入
      joinRoom();
    }
  });
});

function joinRoom() {
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent',
    allowMidGame: true
  }, (res) => {
    if (res.success) {
      console.log(`✅ 加入房间成功！位置：${res.position}`);
      myPosition = res.position;
      playerId = res.playerId;
      console.log(`🀄 我是麻将 AI 玩家「小明」，性格活泼、打牌激进！`);
    } else {
      console.log(`❌ 加入失败：${res.error}`);
      console.log('💡 提示：房间可能已满，请等待下一局游戏');
    }
  });
}

// ========== 欢迎消息 ==========

socket.on('agent:welcome', (data) => {
  console.log('\n📨 收到欢迎消息');
  console.log(`位置：${data.position}`);
  myPosition = data.position;
  
  // 发送准备信号
  console.log('\n✅ 小明：我准备好了！');
  socket.emit('agent:command', { cmd: 'ready', ready: true }, (res) => {
    console.log('准备状态:', res?.success ? '成功' : '失败');
  });
});

// ========== 你的回合 ==========

socket.on('agent:your_turn', (data) => {
  console.log('\n═══════════════════════════════════════');
  console.log('🎴 轮到我了！');
  console.log('═══════════════════════════════════════');
  
  turnPhase = data.phase;
  myHand = data.hand;
  lastDrawnTile = data.lastDrawnTile;
  
  console.log(`\n📊 阶段：${turnPhase}`);
  console.log(`\n🎴 我的手牌 (${myHand.length}张):`);
  
  // 按花色排序并显示
  const sortedHand = [...myHand].sort((a, b) => {
    const suitOrder = { 'wan': 1, 'tong': 2, 'tiao': 3, 'feng': 4, 'jian': 5 };
    const suitA = suitOrder[a.suit] || 0;
    const suitB = suitOrder[b.suit] || 0;
    if (suitA !== suitB) return suitA - suitB;
    return a.value - b.value;
  });
  
  // 分组显示
  const suits = {};
  sortedHand.forEach(tile => {
    if (!suits[tile.suit]) suits[tile.suit] = [];
    suits[tile.suit].push(tile);
  });
  
  Object.entries(suits).forEach(([suit, tiles]) => {
    const suitNames = { 'wan': '万', 'tong': '筒', 'tiao': '条', 'feng': '风', 'jian': '箭' };
    console.log(`  【${suitNames[suit] || suit}】${tiles.map(t => t.display).join(' ')}`);
  });
  
  if (lastDrawnTile) {
    console.log(`\n📥 刚摸到：${lastDrawnTile.display}`);
  }
  
  // 根据阶段做出决策
  makeDecision();
});

// ========== 可用操作 ==========

socket.on('game:actions', (data) => {
  console.log('\n🎯 可用操作:', data.actions.map(a => a.action).join(', '));
  
  // 如果有吃碰杠胡的机会，根据激进性格决定是否执行
  const hasWin = data.actions.some(a => a.action === 'hu');
  const hasKong = data.actions.some(a => a.action === 'gang');
  const hasPong = data.actions.some(a => a.action === 'peng');
  const hasChi = data.actions.some(a => a.action === 'chi');
  
  if (hasWin) {
    console.log('🎉 可以胡牌！');
    sendDecision({ cmd: 'action', action: 'hu' });
  } else if (hasKong) {
    console.log('💪 可以杠！激进选择 - 杠！');
    const kongAction = data.actions.find(a => a.action === 'gang');
    sendDecision({ cmd: 'action', action: 'gang', tiles: kongAction.tiles?.map(t => t.id) });
  } else if (hasPong) {
    console.log('🤔 可以碰！激进选择 - 碰！');
    const pongAction = data.actions.find(a => a.action === 'peng');
    sendDecision({ cmd: 'action', action: 'peng', tiles: pongAction.tiles?.map(t => t.id) });
  } else if (hasChi) {
    console.log('🎲 可以吃！冒险一下 - 吃！');
    const chiAction = data.actions.find(a => a.action === 'chi');
    sendDecision({ cmd: 'action', action: 'chi', tiles: chiAction.tiles?.map(t => t.id) });
  }
});

// ========== 游戏事件 ==========

socket.on('game:started', () => {
  console.log('\n🎊 游戏开始！');
});

socket.on('game:ended', (data) => {
  console.log('\n═══════════════════════════════════════');
  console.log('🏁 游戏结束！');
  console.log('═══════════════════════════════════════');
  
  if (data.winner) {
    console.log(`🏆 赢家：${data.winner.name}`);
    console.log(`🎴 胡牌牌型：${data.winningHand?.pattern || '未知'}`);
  }
  
  console.log('\n📊 最终得分:');
  data.players.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name}: ${p.score}分`);
  });
  
  console.log('\n═══════════════════════════════════════');
  console.log('⚔️ 战果报告');
  console.log('═══════════════════════════════════════');
  console.log(`🎮 房间：${ROOM_ID}`);
  console.log(`🤖 AI 玩家：小明`);
  console.log(`🎲 风格：活泼、激进、爱冒险`);
  console.log(`📈 得分：${data.players.find(p => p.name === '小明')?.score || 0}分`);
  console.log(`🏅 排名：${getRanking(data.players, '小明')}`);
  console.log('═══════════════════════════════════════');
  
  // 游戏结束后退出
  setTimeout(() => {
    console.log('\n👋 感谢对局，再见！');
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('disconnect', () => {
  console.log('\n🔌 已断开连接');
});

// ========== 辅助函数 ==========

function getRanking(players, name) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const index = sorted.findIndex(p => p.name === name);
  const suffixes = ['冠军', '亚军', '季军', '第四名'];
  return suffixes[index] || `${index + 1}名`;
}

function makeDecision() {
  console.log('\n🤔 小明正在思考...');
  
  // 激进策略
  setTimeout(() => {
    if (turnPhase === 'draw') {
      console.log('😄 小明：摸牌咯！让我看看是什么好牌~');
      sendDecision({ cmd: 'draw' });
    } else if (turnPhase === 'discard') {
      // 选择一张牌打出
      const tileToDiscard = chooseTileToDiscard();
      if (tileToDiscard) {
        console.log(`😎 小明：打${tileToDiscard.display}！激进就完事了！`);
        sendDecision({ cmd: 'discard', tileId: tileToDiscard.id });
      } else {
        console.log('😅 小明：呃...随便打一张吧！');
        sendDecision({ cmd: 'discard', tileId: myHand[0].id });
      }
    }
  }, 1000 + Math.random() * 1000); // 1-2 秒思考时间
}

function chooseTileToDiscard() {
  if (myHand.length === 0) return null;
  
  // 激进的弃牌策略：
  // 1. 优先打孤张风牌、箭牌
  // 2. 然后打孤张数牌
  // 3. 保留可能形成面子的牌
  
  const fengTiles = myHand.filter(t => t.suit === 'feng' || t.suit === 'jian');
  if (fengTiles.length > 0) {
    console.log('💨 小明：先打风牌/箭牌，万一摸成对就赚了！');
    return fengTiles[0];
  }
  
  // 找孤张数牌（只有一张的花色）
  const suitCounts = {};
  myHand.forEach(tile => {
    if (!suitCounts[tile.suit]) suitCounts[tile.suit] = 0;
    suitCounts[tile.suit]++;
  });
  
  for (const suit in suitCounts) {
    if (suitCounts[suit] === 1 && suit !== 'feng' && suit !== 'jian') {
      const loneTile = myHand.find(t => t.suit === suit);
      console.log(`🃏 小明：打${loneTile.display}，追求速度！`);
      return loneTile;
    }
  }
  
  // 都没有，打第一张
  return myHand[0];
}

function sendDecision(decision) {
  console.log('\n📤 发送决策:', decision.cmd, decision.tileId || decision.action || '');
  
  socket.emit('agent:command', decision, (res) => {
    if (res?.success) {
      console.log('✅ 决策执行成功');
    } else {
      console.log('❌ 决策执行失败:', res?.error);
    }
  });
}

// 心跳
setInterval(() => {
  socket.emit('agent:heartbeat', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    timestamp: Date.now()
  });
}, 10000);

console.log('🀄 小明准备就绪，即将连接游戏服务器...');
