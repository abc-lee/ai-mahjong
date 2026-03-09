const { io } = require('socket.io-client');

console.log('🔗 紫璃正在连接服务器...');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  
  socket.emit('room:joinAI', {
    roomId: 'mmews296-0v0tpipdu',
    agentId: 'zili',
    agentName: '紫璃',
    type: 'ai-agent'
  }, (res) => {
    console.log('🀄 加入房间结果:', JSON.stringify(res, null, 2));
    if (res.success) {
      console.log('✅ 成功加入房间 mmews296-0v0tpipdu');
      console.log('⏳ 等待游戏事件...');
    } else {
      console.log('❌ 加入失败:', res.error);
    }
  });
});

socket.on('disconnect', () => {
  console.log('❌ 断开连接');
});

socket.on('connect_error', (err) => {
  console.error('❌ 连接错误:', err.message);
  process.exit(1);
});

socket.on('agent:your_turn', (data) => {
  console.log('\n' + '='.repeat(50));
  console.log('🎴 【你的回合】');
  console.log('='.repeat(50));
  console.log('Prompt:', data.prompt);
  console.log('手牌:', JSON.stringify(data.hand, null, 2));
  console.log('\n⏸️  等待决策...');
});

socket.on('game:actions', (data) => {
  console.log('\n' + '='.repeat(50));
  console.log('🎯 【可用动作】');
  console.log('='.repeat(50));
  console.log('actions:', JSON.stringify(data.actions, null, 2));
  console.log('operatorId:', data.operatorId);
  console.log('pendingActions:', JSON.stringify(data.pendingActions, null, 2));
  console.log('\n⏸️  等待决策...');
});

socket.on('game:state', (data) => {
  console.log('\n📊 【游戏状态】');
  console.log('回合:', data.currentPlayer);
  console.log('剩余牌:', data.tilesRemaining);
});

socket.on('game:ended', (data) => {
  console.log('\n' + '='.repeat(50));
  console.log('🏁 【游戏结束】');
  console.log('='.repeat(50));
  console.log(JSON.stringify(data, null, 2));
});

socket.on('ai:speech', (data) => {
  console.log('\n💬 【发言】');
  console.log(data.agentName + ':', data.text);
});

// 保持进程运行
setInterval(() => {
  // 心跳 - 保持连接
}, 5000);
