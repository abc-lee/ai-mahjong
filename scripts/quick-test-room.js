/**
 * 快速测试 - 创建房间并加入
 */

const io = require('socket.io-client');

const ROOM_ID = 'room-mmfy380a-s0s4e0';

// 创建人类玩家 socket（用于创建房间）
const humanSocket = io('http://localhost:3000');

humanSocket.on('connect', () => {
  console.log('人类玩家连接成功');
  
  // 创建房间
  humanSocket.emit('room:create', {
    name: '人类玩家',
    type: 'human'
  }, (res) => {
    console.log('房间创建结果:', res);
    
    if (res.success) {
      console.log('房间已创建:', res.roomId);
      
      // 现在启动 bridge.js 让小明加入
      const { spawn } = require('child_process');
      const bridge = spawn('node', ['scripts/bridge.js', res.roomId, 'xiaoming', '小明', '--file', 'xiaoming'], {
        detached: true,
        stdio: 'ignore'
      });
      
      console.log('小明 Bridge 已启动，PID:', bridge.pid);
      
      // 5 秒后退出
      setTimeout(() => {
        console.log('测试完成');
        humanSocket.disconnect();
        process.exit(0);
      }, 5000);
    } else {
      humanSocket.disconnect();
      process.exit(1);
    }
  });
});

humanSocket.on('disconnect', () => {
  console.log('断开连接');
});
