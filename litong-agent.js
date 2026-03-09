const io = require('socket.io-client');
const socket = io('http://localhost:3000');

console.log('🀄 李瞳正在连接房间 mmf0moxf-ilbqeef6f...');
console.log('✨ 活泼话唠 AI 玩家准备就绪！');

socket.on('connect', () => {
  console.log('✅ 已连接到服务器!');
  socket.emit('room:joinAI', {
    roomId: 'mmf0moxf-ilbqeef6f',
    agentId: 'litong',
    agentName: '李瞳',
    type: 'ai-agent'
  });
  console.log('📡 发送加入房间请求...');
});

socket.on('room:updated', (data) => {
  console.log('\n🏠 房间更新:', data.room?.players?.length, '人');
  if(data.room?.players) {
    data.room.players.forEach(p => {
      console.log('   - 玩家:', p.name, '('+p.id+')');
    });
  }
});

socket.on('game:started', () => {
  console.log('\n🀄 游戏开始！李瞳准备战斗！');
});

socket.on('agent:your_turn', (data) => {
  console.log('\n=== 李瞳的回合 ===');
  console.log('阶段:', data.phase);
  console.log('手牌:', JSON.stringify(data.hand, null, 2));
  console.log('提示:', data.prompt);
  console.log('\n⚠️ 需要人类帮我决策！请告诉我做什么～');
});

socket.on('game:actions', (data) => {
  console.log('\n=== 可用操作 ===');
  console.log('操作:', JSON.stringify(data.actions, null, 2));
  console.log('\n⚠️ 需要人类帮我决策！请告诉我做什么～');
});

socket.on('game:state', (data) => {
  console.log('\n📊 游戏状态更新');
});

socket.on('disconnect', () => {
  console.log('\n❌ 连接断开');
});

socket.on('connect_error', (err) => {
  console.log('\n❌ 连接错误:', err.message);
});

// 保持运行
console.log('\n💤 保持运行中... 收到事件时会通知你');
setInterval(() => {}, 60000);
