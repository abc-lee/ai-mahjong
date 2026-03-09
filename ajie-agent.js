const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const TARGET_ROOM = 'mmh3xzlu-ugisytnmi';
const AGENT_ID = 'ajie_' + Date.now();
const AGENT_NAME = '阿杰';

const socket = io(SERVER_URL, { 
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 3000
});

let joined = false;
let gameActive = false;
let myHand = [];

console.log('🀄 阿杰连接中...');

socket.on('connect', () => {
  console.log(`✅ 已连接服务器：${socket.id}`);
  tryJoin();
});

socket.on('connect_error', (e) => {
  console.log('❌ 连接错误:', e.message);
});

socket.on('disconnect', () => {
  console.log('❌ 断开连接');
  joined = false;
  setTimeout(tryJoin, 3000);
});

function tryJoin() {
  if (joined) return;
  
  console.log(`🔄 尝试加入房间：${TARGET_ROOM}`);
  
  socket.emit('room:joinAI', {
    roomId: TARGET_ROOM,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    personality: 'cautious',
    type: 'ai-agent',
    allowMidGame: true,  // 允许游戏中途加入
  }, (res) => {
    if (res && res.success) {
      console.log(`✅ 加入房间成功！位置：${res.position}`);
      joined = true;
    } else {
      console.log(`❌ 加入失败：${res?.error || '未知错误'}`);
      console.log('⏳ 3 秒后重试...');
      setTimeout(tryJoin, 3000);
    }
  });
}

socket.on('agent:welcome', (data) => {
  console.log('📦 收到欢迎消息');
  console.log('Prompt:', data.prompt);
});

socket.on('game:started', () => {
  console.log('🎴 游戏开始！');
  gameActive = true;
});

socket.on('game:ended', () => {
  console.log('🏁 游戏结束');
  gameActive = false;
  joined = false;
  setTimeout(tryJoin, 2000);
});

socket.on('agent:your_turn', (data) => {
  console.log('\n═══════════════════════════');
  console.log('轮到你打牌了');
  console.log('═══════════════════════════');
  console.log('阶段:', data.phase);
  console.log('手牌:', JSON.stringify(data.hand, null, 2));
  console.log('刚摸到:', data.lastDrawnTile?.display || '无');
  
  myHand = data.hand || myHand;
  
  // 阿杰的思考：稳重、谨慎
  console.log('\n🤔 阿杰思考中...');
  
  // 简单决策逻辑
  if (data.phase === 'draw') {
    console.log('阿杰决定：摸牌');
    socket.emit('agent:command', { cmd: 'draw' });
  } else if (data.phase === 'discard') {
    const tiles = [...(data.hand || []), data.lastDrawnTile].filter(Boolean);
    
    if (tiles.length > 0) {
      // 统计找孤张（稳重打法：先打孤张）
      const cnt = {};
      for (const t of tiles) { 
        const k = t.suit + '_' + t.value; 
        cnt[k] = (cnt[k] || 0) + 1; 
      }
      const singles = tiles.filter(t => cnt[t.suit + '_' + t.value] === 1);
      const toDiscard = singles.length ? singles[0] : tiles[tiles.length - 1];
      
      console.log(`阿杰决定打牌：${toDiscard.display}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: toDiscard.id });
      
      // 偶尔发言
      const speeches = [
        '这张牌留着没用，打掉吧。',
        '先打这张看看。',
        '嗯...这张应该安全。',
        '开局先处理闲张。',
        '稳住稳住'
      ];
      const randomSpeech = speeches[Math.floor(Math.random() * speeches.length)];
      socket.emit('agent:speech', { text: randomSpeech, emotion: 'calm' });
    } else {
      console.log('❌ 没有手牌可打');
      socket.emit('agent:command', { cmd: 'pass' });
    }
  }
  
  console.log('✅ 已发送决策');
});

socket.on('agent:actions', (data) => {
  console.log('\n🎯 可以执行操作:', data.actions.map(a => a.action).join(','));
  
  const actions = data.actions || [];
  
  // 优先级：胡 > 杠 > 碰 > 吃
  if (actions.find(a => a.action === 'hu')) {
    console.log('阿杰：胡！');
    socket.emit('agent:command', { cmd: 'action', action: 'hu' });
  } else if (actions.find(a => a.action === 'gang')) {
    console.log('阿杰：杠');
    socket.emit('agent:command', { cmd: 'action', action: 'gang' });
  } else if (actions.find(a => a.action === 'peng')) {
    console.log('阿杰：碰');
    socket.emit('agent:command', { cmd: 'action', action: 'peng' });
  } else if (actions.find(a => a.action === 'chi')) {
    console.log('阿杰：吃');
    socket.emit('agent:command', { cmd: 'action', action: 'chi' });
  } else {
    console.log('阿杰：过');
    socket.emit('agent:command', { cmd: 'pass' });
  }
});

socket.on('game:tile_discarded', (data) => {
  console.log(`🃏 玩家${data.playerId} 打出了：${data.tile?.display || data.tile}`);
});

socket.on('game:player_action', (data) => {
  console.log(`🎯 玩家${data.playerId} 进行了操作：${data.action}`);
});

socket.on('room:chat', (data) => {
  console.log(`💬 [聊天] ${data.playerName}: ${data.message}`);
});

socket.on('player:speech', (data) => {
  console.log(`💬 [发言] ${data.playerName}: ${data.message} (${data.emotion})`);
});

socket.on('game:start', (data) => {
  console.log('🎴 游戏开始！');
  console.log('你的手牌:', data.hand);
  if (data.hand) myHand = data.hand;
});

socket.on('agent:your_turn', (data) => {
  console.log('\n═══════════════════════════');
  console.log('轮到你打牌了');
  console.log('═══════════════════════════');
  console.log('Prompt:', data.prompt);
  console.log('手牌:', JSON.stringify(data.hand, null, 2));
  
  myHand = data.hand || myHand;
  
  // 阿杰的思考：稳重、谨慎
  console.log('\n🤔 阿杰思考中...');
  
  // 简单的决策逻辑：打出手牌中第一张
  const tileToDiscard = myHand && myHand.length > 0 ? myHand[0] : null;
  
  if (tileToDiscard) {
    console.log(`阿杰决定打牌：${tileToDiscard}`);
    
    // 偶尔发言
    const speeches = [
      '这张牌留着没用，打掉吧。',
      '先打这张看看。',
      '嗯...这张应该安全。',
      '开局先处理闲张。'
    ];
    const randomSpeech = speeches[Math.floor(Math.random() * speeches.length)];
    
    socket.emit('agent:speech', {
      text: randomSpeech,
      emotion: 'calm'
    });
    
    socket.emit('agent:command', {
      cmd: 'discard',
      tileId: tileToDiscard
    });
    
    console.log('✅ 已发送决策');
  } else {
    console.log('❌ 没有手牌可打');
    socket.emit('agent:command', { cmd: 'pass' });
  }
});

socket.on('game:tile_discarded', (data) => {
  console.log(`🃏 玩家${data.playerId}打出了: ${data.tile}`);
});

socket.on('game:player_action', (data) => {
  console.log(`🎯 玩家${data.playerId}进行了操作：${data.action}`);
});

socket.on('disconnect', () => {
  console.log('❌ 断开连接');
});

socket.on('error', (err) => {
  console.error('❌ 错误:', err);
});

console.log('等待服务器响应...');
