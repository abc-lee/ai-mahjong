const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('连接成功');
  socket.emit('room:list', (rooms) => {
    console.log('收到房间列表:', typeof rooms, Array.isArray(rooms));
    if (rooms && rooms.length > 0) {
      rooms.forEach(r => {
        console.log('房间ID:', r.id);
        console.log('玩家数:', r.players ? r.players.length : 0);
        if (r.players) {
          r.players.forEach(p => console.log('  -', p.name, p.type || 'human'));
        }
      });
    } else {
      console.log('没有房间');
    }
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.log('连接错误:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('超时');
  process.exit(1);
}, 5000);
