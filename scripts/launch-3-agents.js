/**
 * 启动 3 个 AI Agent 连接到麻将服务器
 * 紫璃创建房间，青鸾和烟华加入
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID_FILE = path.join(__dirname, 'current-room-id.txt');

console.log('🀄 启动 3 个 AI Agent 麻将玩家\n');
console.log('服务器:', SERVER_URL);
console.log('=================================\n');

// 启动紫璃
console.log('📌 启动 紫璃 (房主)...');
const zili = spawn('node', ['scripts/agent-zili-standalone.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
});

zili.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.output?.write?.(output) || console.log(output.replace(/\n$/, ''));
  
  // 检测房间创建成功
  if (output.includes('创建房间成功：')) {
    const match = output.match(/创建房间成功：([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      const roomId = match[1];
      console.log(`\n📝 房间 ID: ${roomId}\n`);
      
      // 保存房间 ID
      fs.writeFileSync(ROOM_ID_FILE, roomId);
      
      // 2 秒后启动其他 AI
      setTimeout(() => startOtherAgents(roomId), 2000);
    }
  }
});

zili.stderr.on('data', (data) => {
  console.error(`❌ ${data.toString()}`);
});

function startOtherAgents(roomId) {
  console.log('📌 启动 青鸾...');
  const qingluan = spawn('node', ['scripts/agent-qingluan.js', roomId], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  qingluan.stdout.on('data', (data) => {
    process.stdout.output?.write?.(data.toString()) || console.log(data.toString().replace(/\n$/, ''));
  });
  
  qingluan.stderr.on('data', (data) => {
    console.error(`❌ ${data.toString()}`);
  });
  
  console.log('📌 启动 烟华...');
  const yanhua = spawn('node', ['scripts/agent-yanhua.js', roomId], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });
  
  yanhua.stdout.on('data', (data) => {
    process.stdout.output?.write?.(data.toString()) || console.log(data.toString().replace(/\n$/, ''));
  });
  
  yanhua.stderr.on('data', (data) => {
    console.error(`❌ ${data.toString()}`);
  });
  
  console.log('\n✅ 所有 AI Agent 已启动！按 Ctrl+C 退出\n');
}

// 保持进程运行
process.on('SIGINT', () => {
  console.log('\n👋 正在退出...');
  zili.kill();
  process.exit(0);
});

setInterval(() => {}, 60000);
