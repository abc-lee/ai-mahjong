const io = require('socket.io-client');

const ROOM_ID = 'mmf0zw6c-jdr5tjzf1';
const AGENT_ID = 'baize';
const AGENT_NAME = '白泽';

console.log('🀄 白泽 AI 启动中...');
console.log(`🎯 目标房间：${ROOM_ID}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ 已连接到服务器');
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  });
});

socket.on('room:joined', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 加入房间成功!');
  console.log('房间信息:', JSON.stringify(data, null, 2));
});

socket.on('room:updated', (data) => {
  console.log('📢 房间更新：', data.room?.players?.length, '人');
  if (data.room?.players) {
    data.room.players.forEach(p => {
      console.log(`  - ${p.name} (${p.type})`);
    });
  }
});

socket.on('game:started', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎮 游戏开始!');
});

socket.on('agent:your_turn', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔄 你的回合：${data.phase}`);
  console.log('手牌:', JSON.stringify(data.hand, null, 2));
  console.log('刚摸到:', data.lastDraw);
  console.log('提示:', data.prompt);
  
  // 简单决策逻辑
  if (data.phase === 'draw') {
    console.log('👉 决策：摸牌');
    socket.emit('agent:command', { cmd: 'draw' });
  } else if (data.phase === 'discard' && data.hand && data.hand.length > 0) {
    // 选择一个牌打掉（简单策略：打第一张）
    const tileToDiscard = data.hand[0];
    console.log(`👉 决策：打牌 ${tileToDiscard.tileId}`);
    socket.emit('agent:command', { cmd: 'discard', tileId: tileToDiscard.tileId });
  }
});

socket.on('game:actions', (data) => {
  console.log('⚡ 可用操作:', JSON.stringify(data.actions, null, 2));
  
  // 有操作时优先选择
  if (data.actions && data.actions.length > 0) {
    const priority = ['hu', 'gang', 'peng', 'chi'];
    for (const action of priority) {
      if (data.actions.includes(action)) {
        console.log(`👉 决策：${action}`);
        socket.emit('agent:command', { cmd: 'action', action: action });
        return;
      }
    }
  }
});

socket.on('game:tile_discarded', (data) => {
  console.log(`🗑️ 玩家 ${data.playerId} 弃牌：${data.tile?.text || data.tile?.tileId}`);
});

socket.on('game:ended', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏁 游戏结束');
  console.log('结果:', JSON.stringify(data, null, 2));
});

socket.on('disconnect', () => {
  console.log('❌ 断开连接');
  process.exit(1);
});

socket.on('connect_error', (err) => {
  console.error('连接错误:', err.message);
  console.log('请确认游戏服务器已在 localhost:3000 启动');
  process.exit(1);
});

// 保持运行
setInterval(() => {}, 60000);
