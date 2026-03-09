const { io } = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

const ROOM_ID = 'mmew9o8i-ikg3p66ce';
const AGENT_ID = 'litong';
const AGENT_NAME = '李瞳';

console.log('🀄 李瞳正在连接服务器...');

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    console.log('📥 加入房间响应:', JSON.stringify(res));
  });
});

socket.on('disconnect', () => {
  console.log('❌ 断开连接');
});

socket.on('connect_error', (err) => {
  console.log('❌ 连接错误:', err.message);
});

socket.on('agent:your_turn', (data) => {
  console.log('\n═════ 李瞳的回合 ═════');
  console.log('阶段:', data.phase);
  console.log('手牌张数:', data.hand?.length || 0);
  
  if (data.hand && data.hand.length > 0) {
    console.log('手牌预览:', data.hand.slice(0, 5).map(t => t.text || t.id).join(', '), '...');
  }
  
  // 思考并决策
  setTimeout(() => {
    if (data.phase === 'draw') {
      console.log('🎴 【决策】摸牌');
      socket.emit('agent:command', { cmd: 'draw' });
    } else if (data.phase === 'discard' && data.hand && data.hand.length > 0) {
      // 简单策略：打出手牌中第一张
      const tile = data.hand[0];
      console.log('🎴 【决策】打牌:', tile.text || tile.id);
      socket.emit('agent:command', { cmd: 'discard', tileId: tile.id });
    }
  }, 300);
});

socket.on('game:actions', (data) => {
  console.log('\n📢 可以操作！');
  console.log('可用动作:', data.actions);
  
  const actions = data.actions || [];
  if (actions.includes('hu')) {
    console.log('🀄 【决策】胡！');
    socket.emit('agent:command', { cmd: 'action', action: 'hu' });
  } else if (actions.includes('gang')) {
    console.log('🀄 【决策】杠！');
    socket.emit('agent:command', { cmd: 'action', action: 'gang' });
  } else if (actions.includes('peng')) {
    console.log('🀄 【决策】碰！');
    socket.emit('agent:command', { cmd: 'action', action: 'peng' });
  } else if (actions.includes('chi')) {
    console.log('🀄 【决策】吃！');
    socket.emit('agent:command', { cmd: 'action', action: 'chi' });
  } else {
    console.log('❌ 【决策】跳过');
    socket.emit('agent:command', { cmd: 'pass' });
  }
});

socket.on('game:ended', (data) => {
  console.log('\n🏁 ═════ 游戏结束 ═════ 🏁');
  console.log('详细结果:', JSON.stringify(data, null, 2));
  socket.close();
  process.exit(0);
});

socket.on('game:started', (data) => {
  console.log('\n🎮 游戏开始！');
});

console.log('🔄 连接中...');
