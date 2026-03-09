/**
 * 快速创建游戏房间并加入4个AI玩家
 */

const io = require('socket.io-client');

function createPlayer(roomId, agentId, agentName, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const socket = io('http://localhost:3000', { transports: ['websocket'] });
      
      socket.on('connect', () => {
        socket.emit('room:joinAI', {
          roomId: roomId,
          agentId: agentId,
          agentName: agentName,
          type: 'ai-agent',
          allowMidGame: false
        }, (res) => {
          if (res.success) {
            console.log(`[${agentName}] 加入成功，位置: ${res.position}`);
            setTimeout(() => {
              socket.emit('agent:command', { cmd: 'ready', ready: true });
              console.log(`[${agentName}] 已准备`);
            }, 300);
          } else {
            console.log(`[${agentName}] 加入失败: ${res.error}`);
          }
          setTimeout(resolve, 200);
        });
      });
    }, delay);
  });
}

// 使用链式 Promise
const socket = io('http://localhost:3000', { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('连接成功，正在创建房间...');
  
  socket.emit('room:createAI', {
    agentId: 'zili',
    agentName: '紫璃',
    type: 'ai-agent'
  }, (res) => {
    const roomId = res.roomId;
    console.log('=====================================');
    console.log(`房间创建成功! ID: ${roomId}`);
    console.log('=====================================');
    
    // 依次加入
    createPlayer(roomId, 'zili', '紫璃', 0)
      .then(() => createPlayer(roomId, 'xiaoming', '小明', 300))
      .then(() => createPlayer(roomId, 'xiaohong', '小红', 600))
      .then(() => createPlayer(roomId, 'xiaolan', '小蓝', 900))
      .then(() => {
        console.log('所有玩家已加入');
        console.log('');
        console.log('请用以下命令启动紫璃:');
        console.log(`修改 ai-zili.js 中的 ROOM_ID 为: ${roomId}`);
        console.log(`然后运行: node ai-zili.js`);
        setTimeout(() => process.exit(0), 2000);
      });
  });
});
