const { io } = require('socket.io-client');

const ROOM_ID = 'mmews296-0v0tpipdu';
const AGENT_ID = 'baize';
const AGENT_NAME = '白泽';

console.log('🀄 白泽正在连接服务器...');
console.log('房间:', ROOM_ID);
console.log('Agent ID:', AGENT_ID);

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('\\n✅ 已连接服务器 (Socket ID:', socket.id + ')');
  
  // 加入房间
  console.log('🚪 正在加入房间...');
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    if (res.success) {
      console.log('✅ 加入房间成功!');
      console.log('   房间 ID:', res.roomId);
      console.log('   玩家 ID:', res.playerId);
      console.log('   座位:', res.position !== undefined ? res.position : '未知');
    } else {
      console.log('❌ 加入房间失败:', res);
    }
  });
});

socket.on('agent:your_turn', (data) => {
  console.log('\\n' + '='.repeat(60));
  console.log('🎴【白泽的回合】');
  console.log('='.repeat(60));
  console.log('Prompt:', data.prompt);
  console.log('\\n手牌:');
  console.log(JSON.stringify(data.hand, null, 2));
  console.log('\\n⏳ 等待决策指令...');
  console.log('='.repeat(60));
});

socket.on('game:actions', (data) => {
  console.log('\\n' + '='.repeat(60));
  console.log('🎮【可用操作】');
  console.log('='.repeat(60));
  console.log('actions:', JSON.stringify(data.actions, null, 2));
  console.log('\\n⏳ 等待决策指令...');
  console.log('='.repeat(60));
});

socket.on('game:ended', (data) => {
  console.log('\\n' + '='.repeat(60));
  console.log('🏁【游戏结束】');
  console.log('='.repeat(60));
  console.log('结果:', JSON.stringify(data, null, 2));
  console.log('='.repeat(60));
});

socket.on('disconnect', (reason) => {
  console.log('\\n❌ 断开连接:', reason);
});

socket.on('connect_error', (err) => {
  console.log('\\n❌ 连接错误:', err.message);
});

socket.on('room:joinAI', (data) => {
  console.log('\\n📢 房间事件:', JSON.stringify(data, null, 2));
});

// 保持进程运行
console.log('\\n🔄 保持连接中... (Ctrl+C 退出)');
setInterval(() => {
  if (!socket.connected) {
    console.log('⚠️  连接丢失，尝试重连...');
  }
}, 5000);
