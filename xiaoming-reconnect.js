/**
 * 小明 - 麻将 AI 玩家客户端 (重连现有玩家)
 * 性格：活泼、激进、喜欢冒险
 * 
 * 尝试重连为已有的小明 AI 玩家
 */

const io = require('socket.io-client');

const ROOM_ID = 'mmg6g03e-2munypjof';
const AGENT_ID = 'xiaoming';  // 使用已有的 ID
const AGENT_NAME = '小明';

// 连接游戏服务器
const socket = io('http://localhost:3000');

// 游戏状态
let myHand = [];
let myPosition = -1;
let lastDrawnTile = null;
let turnPhase = null;
let playerId = null;

// ========== 连接和重连 ==========

socket.on('connect', () => {
  console.log('🔌 已连接到游戏服务器');
  console.log(`🔄 尝试重连为小明 (ID: ${AGENT_ID})...\n`);
  
  // 尝试重连
  socket.emit('agent:reconnect', {
    roomId: ROOM_ID,
    agentId: AGENT_ID
  }, (res) => {
    if (res.success) {
      console.log(`✅ 重连成功！`);
      playerId = res.playerId;
      console.log(`📊 游戏状态：${res.gameState ? '游戏中' : '等待中'}`);
      
      // 请求当前状态
      setTimeout(() => {
        socket.emit('agent:requestState', (stateRes) => {
          console.log('\n📡 请求状态返回:', stateRes ? '有数据' : '无数据');
          if (stateRes) {
            console.log('📝 当前状态:', JSON.stringify(stateRes, null, 2));
          }
          if (stateRes?.prompt) {
            console.log('📝 当前阶段:', stateRes.phase);
            console.log('📋 Prompt:', stateRes.prompt.substring(0, 200) + '...');
          }
        });
      }, 1000);
    } else {
      console.log(`❌ 重连失败：${res.error}`);
      console.log('💡 可能原因：玩家已被自动托管覆盖，或游戏已结束');
    }
  });
});

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
  
  setTimeout(() => {
    if (turnPhase === 'draw') {
      console.log('😄 小明：摸牌咯！');
      sendDecision({ cmd: 'draw' });
    } else if (turnPhase === 'discard') {
      const tileToDiscard = chooseTileToDiscard();
      if (tileToDiscard) {
        console.log(`😎 小明：打${tileToDiscard.display}！`);
        sendDecision({ cmd: 'discard', tileId: tileToDiscard.id });
      } else {
        sendDecision({ cmd: 'discard', tileId: myHand[0].id });
      }
    }
  }, 1000 + Math.random() * 1000);
}

function chooseTileToDiscard() {
  if (myHand.length === 0) return null;
  
  const fengTiles = myHand.filter(t => t.suit === 'feng' || t.suit === 'jian');
  if (fengTiles.length > 0) return fengTiles[0];
  
  const suitCounts = {};
  myHand.forEach(tile => {
    if (!suitCounts[tile.suit]) suitCounts[tile.suit] = 0;
    suitCounts[tile.suit]++;
  });
  
  for (const suit in suitCounts) {
    if (suitCounts[suit] === 1 && suit !== 'feng' && suit !== 'jian') {
      return myHand.find(t => t.suit === suit);
    }
  }
  
  return myHand[0];
}

function sendDecision(decision) {
  console.log('\n📤 发送决策:', decision.cmd, decision.tileId || decision.action || '');
  
  socket.emit('agent:command', decision, (res) => {
    console.log(res?.success ? '✅ 成功' : '❌ 失败:', res?.error || '');
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

console.log('🀄 小明准备重连...\n');
