/**
 * 启动 3 个 AI Agent 连接到麻将服务器
 * 紫璃创建房间，青鸾和烟华加入，然后添加第 4 个自动托管玩家
 */
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID_STORAGE = 'scripts/agent-room-id.txt';

console.log('🀄 启动 3 个 AI Agent...\n');

// 第一步：紫璃创建房间
console.log('📌 步骤 1: 紫璃创建房间...');

const ziliSocket = io(SERVER_URL);

ziliSocket.on('connect', () => {
  console.log('✅ 紫璃已连接');
  
  ziliSocket.emit('room:createAI', {
    agentId: 'zili',
    agentName: '紫璃',
    type: 'ai-agent'
  }, (res) => {
    if (res && res.roomId) {
      console.log(`✅ 紫璃创建房间成功：${res.roomId}`);
      
      // 保存房间 ID 到文件
      const fs = require('fs');
      fs.writeFileSync(ROOM_ID_STORAGE, res.roomId);
      console.log(`📝 房间 ID 已保存到 ${ROOM_ID_STORAGE}`);
      
      // 延迟后启动其他 AI
      setTimeout(() => {
        startOtherAgents(res.roomId);
      }, 2000);
      
      // 保持连接
    } else {
      console.error('❌ 紫璃创建房间失败:', res?.error || res?.message || '未知错误');
      process.exit(1);
    }
  });
});

function startOtherAgents(roomId) {
  console.log('\n📌 步骤 2: 启动青鸾和烟华...\n');
  
  // 启动青鸾
  const qingluan = spawn('node', ['scripts/agent-qingluan.js', roomId], {
    stdio: 'inherit',
    detached: false
  });
  
  // 启动烟华
  const yanhua = spawn('node', ['scripts/agent-yanhua.js', roomId], {
    stdio: 'inherit',
    detached: false
  });
  
  qingluan.on('error', (err) => {
    console.error('❌ 青鸾启动失败:', err.message);
  });
  
  yanhua.on('error', (err) => {
    console.error('❌ 烟华启动失败:', err.message);
  });
  
  console.log('\n✅ 所有 AI Agent 已启动！\n');
  console.log('按 Ctrl+C 退出所有 Agent\n');
  
  // 步骤 3: 添加第 4 个自动托管玩家
  setTimeout(() => {
    console.log('📌 步骤 3: 添加第 4 个自动托管玩家...');
    
    ziliSocket.emit('agent:command', { cmd: 'add_auto_player' }, (res) => {
      if (res && res.success) {
        console.log('✅ 第 4 个自动托管玩家已添加\n');
      } else {
        console.log('⚠️  添加自动托管玩家失败:', res?.error || '未知错误');
      }
    });
  }, 4000);
}

// 保持进程运行
setInterval(() => {}, 60000);
