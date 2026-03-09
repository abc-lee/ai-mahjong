const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const ROOM_ID_FILE = path.join(__dirname, 'test-room-id.txt');

const s = io('http://localhost:3000');

s.on('connect', () => {
  console.log('房主已连接');
  
  s.emit('room:create', {name:'紫璃麻将房',mode:'friend'}, (r) => {
    if(r.roomId){
      const roomId = r.roomId;
      console.log('房间创建成功:', roomId);
      
      // 保存房间 ID 到文件
      fs.writeFileSync(ROOM_ID_FILE, roomId);
      console.log('房间 ID 已保存到:', ROOM_ID_FILE);
      
      console.log('房主保持连接中... 按 Ctrl+C 退出');
    } else {
      console.log('创建失败:', r.error);
      s.close();
      process.exit(1);
    }
  });
});

// 保持进程运行
process.on('SIGINT', () => {
  console.log('\n房主退出');
  s.close();
  process.exit(0);
});
