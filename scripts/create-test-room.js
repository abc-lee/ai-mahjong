/**
 * 创建测试房间并返回 roomId
 * 供 bridge.js 测试使用
 */

const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  
  // 创建房间
  socket.emit('room:createAI', {
    agentId: 'test-host-' + Date.now(),
    agentName: '测试房主',
    type: 'ai-agent'
  }, (res) => {
    if (res && res.roomId) {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('✅ 房间创建成功！');
      console.log('═══════════════════════════════════════');
      console.log('');
      console.log('房间ID:', res.roomId);
      console.log('');
      console.log('测试命令:');
      console.log(`node scripts/bridge.js ${res.roomId} test-agent 测试玩家`);
      console.log('');
      
      // 保存房间ID到文件
      const fs = require('fs');
      fs.writeFileSync('scripts/test-room-id.txt', res.roomId);
      console.log('房间ID已保存到 scripts/test-room-id.txt');
      
      // 退出
      process.exit(0);
    } else {
      console.error('❌ 创建房间失败:', res?.error || res);
      process.exit(1);
    }
  });
});

socket.on('connect_error', (err) => {
  console.error('❌ 连接失败:', err.message);
  process.exit(1);
});
