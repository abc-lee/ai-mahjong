const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected');
  
  // 创建房间
  socket.emit('room:create', {
    settings: {
      maxPlayers: 4,
      gameType: 'standard'
    }
  }, (res) => {
    console.log('Create room result:', res);
    if (res.success && res.roomId) {
      console.log('Created room:', res.roomId);
      
      // 加入房间
      socket.emit('room:joinAI', {
        roomId: res.roomId,
        agentId: 'ajie',
        agentName: '阿杰',
        type: 'ai-agent',
        allowMidGame: true
      }, (joinRes) => {
        console.log('Join result:', joinRes);
        
        // 保持连接
        setInterval(() => {
          console.log('Waiting for game...');
        }, 5000);
      });
    }
  });
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
