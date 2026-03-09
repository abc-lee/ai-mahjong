/**
 * 小明 - 麻将 AI 玩家客户端 (监视模式)
 * 性格：活泼、激进、喜欢冒险
 */

const io = require('socket.io-client');

const ROOM_ID = 'mmg6g03e-2munypjof';
const AGENT_ID = 'xiaoming-agent-new';
const AGENT_NAME = '小明';

// 连接游戏服务器
const socket = io('http://localhost:3000');

let isConnected = false;
let playerId = null;

// ========== 连接 ==========

socket.on('connect', () => {
  console.log('🔌 已连接到游戏服务器');
  console.log(`📡 监视房间：${ROOM_ID}`);
  console.log('⏳ 等待游戏开始...\n');
});

// ========== 房间更新 ==========

socket.on('room:updated', (data) => {
  const room = data.room;
  if (!room) return;
  
  console.log('\n📢 房间更新:');
  console.log(`   状态：${room.state}`);
  console.log(`   玩家：${room.players.length}/4`);
  room.players.forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.name} (${p.type}) - 准备：${p.isReady ? '✅' : '❌'}`);
  });
  
  // 如果游戏即将开始（所有人都准备了），尝试加入
  const allReady = room.players.length === 4 && room.players.every(p => p.isReady);
  if (allReady && room.state === 'waiting' && !isConnected) {
    console.log('\n🎮 所有人都准备好了！尝试加入游戏...');
    tryJoinRoom();
  }
});

// ========== 游戏开始 ==========

socket.on('game:started', () => {
  console.log('\n🎊 游戏开始了！');
  if (!isConnected) {
    console.log('😢 小明来晚了，游戏已经开始，无法加入');
  }
});

// ========== 加入响应 ==========

socket.on('room:joinAI_response', (data) => {
  if (data.success) {
    console.log(`✅ 加入成功！位置：${data.position}`);
    playerId = data.playerId;
    isConnected = true;
  } else {
    console.log(`❌ 加入失败：${data.error}`);
  }
});

// ========== 辅助函数 ==========

function tryJoinRoom() {
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent',
    allowMidGame: false
  }, (res) => {
    if (res.success) {
      console.log(`✅ 加入房间成功！位置：${res.position}`);
      playerId = res.playerId;
      isConnected = true;
    } else {
      console.log(`❌ 加入失败：${res.error}`);
    }
  });
}

// 定时检查房间状态
setInterval(() => {
  socket.emit('room:list', {}, (res) => {
    if (res && res.rooms) {
      const targetRoom = res.rooms.find(r => r.id === ROOM_ID);
      if (targetRoom) {
        console.log(`\n🔍 房间状态检查: ${targetRoom.state}, 玩家 ${targetRoom.players.length}/4`);
      }
    }
  });
}, 5000);

// 超时退出
setTimeout(() => {
  console.log('\n⏱️ 超时退出，感谢等待！');
  socket.disconnect();
  process.exit(0);
}, 60000); // 1 分钟后退出

console.log('🀄 小明准备就绪，等待游戏开始...\n');
