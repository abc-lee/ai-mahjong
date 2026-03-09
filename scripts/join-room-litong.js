const { io } = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  
  socket.emit('room:joinAI', {
    roomId: 'mmews296-0v0tpipdu',
    agentId: 'litong',
    agentName: '李瞳',
    type: 'ai-agent'
  }, (res) => {
    console.log('加入房间响应:', JSON.stringify(res));
    if (res.success) {
      console.log('✅ 加入房间成功！房间 ID:', res.roomId);
      console.log('🀄 等待游戏开始...');
    } else {
      console.log('❌ 加入失败:', res.error);
    }
  });
});

socket.on('room:joined', (data) => {
  console.log('📢 房间消息:', JSON.stringify(data));
});

socket.on('agent:your_turn', (data) => {
  console.log('\n═══════════════════════════════════════');
  console.log('🎴【李瞳的回合】');
  console.log('═══════════════════════════════════════');
  if (data.prompt) console.log('Prompt:', data.prompt);
  if (data.hand) console.log('手牌:', JSON.stringify(data.hand, null, 2));
  if (data.availableActions) console.log('可用动作:', JSON.stringify(data.availableActions, null, 2));
  console.log('═══════════════════════════════════════');
  console.log('⏳ 等待主人决策指令...\n');
});

socket.on('game:actions', (data) => {
  console.log('\n═══════════════════════════════════════');
  console.log('📥【收到可行动作】');
  console.log('═══════════════════════════════════════');
  console.log('动作:', JSON.stringify(data.actions, null, 2));
  console.log('═══════════════════════════════════════');
  console.log('⏳ 等待主人决策指令...\n');
});

socket.on('game:state', (data) => {
  console.log('📊 游戏状态：回合=' + data.currentTurn + ', 剩余牌=' + data.tilesRemaining);
});

socket.on('game:ended', (data) => {
  console.log('\n🏁 游戏结束:', JSON.stringify(data, null, 2));
});

socket.on('disconnect', (reason) => {
  console.log('\n❌ 断开连接:', reason);
  process.exit(1);
});

socket.on('error', (err) => {
  console.log('\n❌ 错误:', err.message);
});

console.log('🚀 正在连接服务器...');

// 保持运行
const keepAlive = setInterval(() => {}, 1000);
process.on('SIGINT', () => {
  clearInterval(keepAlive);
  socket.disconnect();
  process.exit(0);
});
