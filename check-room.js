/**
 * 检查房间状态
 */

const io = require('socket.io-client');

const ROOM_ID = 'mmg6g03e-2munypjof';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('🔌 已连接到服务器');
  
  // 请求房间列表
  socket.emit('room:list', {}, (res) => {
    console.log('\n📋 房间列表:');
    console.log('返回:', JSON.stringify(res, null, 2));
    if (res && res.rooms) {
      res.rooms.forEach((room, i) => {
        console.log(`\n${i + 1}. ${room.name} (${room.id})`);
        console.log(`   状态：${room.state}`);
        console.log(`   玩家：${room.players.length}/4`);
        room.players.forEach((p, j) => {
          console.log(`     ${j + 1}. ${p.name} (${p.type || 'human'}) - 准备：${p.isReady ? '✅' : '❌'}`);
        });
      });
    } else {
      console.log('   无房间');
    }
    
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 500);
  });
  
  // 超时保护
  setTimeout(() => {
    console.log('⏱️ 超时，断开连接');
    socket.disconnect();
    process.exit(0);
  }, 5000);
});

socket.on('connect_error', (err) => {
  console.log('❌ 连接失败:', err.message);
  process.exit(1);
});
