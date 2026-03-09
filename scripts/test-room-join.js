const io = require('socket.io-client');

const s = io('http://localhost:3000');

s.on('connect', () => {
  console.log('已连接');
  
  s.emit('room:create', {name:'测试',mode:'friend'}, (r) => {
    if(r.roomId){
      const roomId = r.roomId;
      console.log('房间创建成功:', roomId);
      
      // 用同一个 socket 尝试加入 AI
      s.emit('room:joinAI', {
        roomId: roomId,
        agentId: 'zili-test',
        agentName: '紫璃',
        type: 'ai-agent'
      }, (r2) => {
        console.log('AI 加入结果:', JSON.stringify(r2));
        s.close();
        process.exit(0);
      });
    } else {
      console.log('创建失败:', r.error);
      s.close();
      process.exit(1);
    }
  });
});

setTimeout(() => {
  console.log('超时');
  process.exit(1);
}, 10000);
