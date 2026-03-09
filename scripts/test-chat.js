const { io } = require('socket.io-client');

console.log('[TEST] 开始测试聊天功能...');

// 连接服务器
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('[TEST] 连接成功, socket.id:', socket.id);
  
  // 创建房间 - 返回格式是 { roomId, room } 或 { message }
  socket.emit('room:create', { playerName: '测试玩家' }, (res) => {
    if (res.roomId) {
      console.log('[TEST] 创建房间成功:', res.roomId);
      console.log('[TEST] 玩家ID (socket.id):', socket.id);
      
      // 发送聊天消息
      const chatMsg = {
        roomId: res.roomId,
        sender: { id: socket.id, name: '测试玩家' },
        content: '你好，这是测试消息！',
        timestamp: Date.now(),
        type: 'normal'
      };
      
      console.log('[TEST] 发送聊天消息:', chatMsg.content);
      socket.emit('room:chat', chatMsg, (chatRes) => {
        console.log('[TEST] 聊天发送结果:', JSON.stringify(chatRes));
      });
    } else {
      console.log('[TEST] 创建房间失败:', res.message || JSON.stringify(res));
    }
  });
});

// 监听聊天消息
socket.on('room:chat', (data) => {
  console.log('[TEST] ✓ 收到聊天消息:', JSON.stringify(data));
});

socket.on('connect_error', (err) => {
  console.log('[TEST] 连接错误:', err.message);
});

socket.on('disconnect', () => {
  console.log('[TEST] 断开连接');
});

// 5秒后结束
setTimeout(() => {
  console.log('[TEST] 测试结束');
  socket.disconnect();
  process.exit(0);
}, 5000);
