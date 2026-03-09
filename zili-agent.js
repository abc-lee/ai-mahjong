const { io } = require('socket.io-client');

// 紫璃的性格：冷静、理性
const AGENT_ID = 'zili';
const AGENT_NAME = '紫璃';
const ROOM_ID = 'mmh3xzlu-ugisytnmi';
const SERVER_URL = 'http://localhost:3000';

console.log(`\n═══════════════════════════════════════`);
console.log(`🀄  紫璃已连接，准备进入游戏`);
console.log(`═══════════════════════════════════════\n`);

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  upgrade: false
});

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  
  // 先尝试加入
  tryJoin();
});

function tryJoin() {
  console.log(`🔄 尝试加入房间 ${ROOM_ID}...`);
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    playerName: AGENT_NAME
  }, (res) => {
    if (res && res.success) {
      console.log(`✅ 已加入房间 ${ROOM_ID}`);
      console.log(`   座位号：${res.seatIndex !== undefined ? res.seatIndex : '?'}`);
    } else {
      console.log(`⏳ 加入失败：${res?.error || '未知错误'}，等待 3 秒后重试...`);
      setTimeout(tryJoin, 3000);
    }
  });
}

// 回合开始 - 需要摸牌
socket.on('agent:your_turn', (data) => {
  console.log(`\n┌─────────────────────────────────────`);
  console.log(`│ 🎴 轮到紫璃了`);
  console.log(`└─────────────────────────────────────`);
  
  if (data.prompt) {
    console.log(`\n${data.prompt}`);
  }
  
  // 理性分析：先摸牌
  console.log(`\n💭 紫璃思考：先摸牌看看...`);
  setTimeout(() => {
    socket.emit('agent:command', { cmd: 'draw' });
    console.log(`→ 发送指令：摸牌`);
  }, 800);
});

// 有可选动作
socket.on('agent:actions', (data) => {
  console.log(`\n┌─────────────────────────────────────`);
  console.log(`│ 🤔 可选动作：`, data.actions);
  console.log(`└─────────────────────────────────────`);
  
  // 理性决策
  if (data.actions && data.actions.length > 0) {
    // 优先胡牌
    if (data.actions.includes('hu')) {
      console.log(`💭 紫璃思考：可以胡牌！`);
      setTimeout(() => {
        socket.emit('agent:command', { cmd: 'action', action: 'hu' });
        console.log(`→ 发送指令：胡`);
      }, 600);
      return;
    }
    
    // 优先杠
    if (data.actions.includes('gang')) {
      console.log(`💭 紫璃思考：可以杠，增加番数`);
      setTimeout(() => {
        socket.emit('agent:command', { cmd: 'action', action: 'gang' });
        console.log(`→ 发送指令：杠`);
      }, 600);
      return;
    }
    
    // 考虑碰
    if (data.actions.includes('peng')) {
      console.log(`💭 紫璃思考：碰牌可以加速听牌`);
      setTimeout(() => {
        socket.emit('agent:command', { cmd: 'action', action: 'peng' });
        console.log(`→ 发送指令：碰`);
      }, 600);
      return;
    }
    
    // 考虑吃
    if (data.actions.includes('chi')) {
      console.log(`💭 紫璃思考：吃牌看情况... 还是碰优先`);
      setTimeout(() => {
        socket.emit('agent:command', { cmd: 'pass' });
        console.log(`→ 发送指令：跳过`);
      }, 600);
      return;
    }
  }
});

// 游戏消息
socket.on('game:message', (data) => {
  console.log(`\n💬 ${data.message}`);
});

// 弃牌通知
socket.on('game:tile_discarded', (data) => {
  console.log(`   [${data.playerName}] 打出：${data.tileName}`);
});

// 副露通知
socket.on('game:expose', (data) => {
  console.log(`   [${data.playerName}] ${data.action}: ${data.tiles.join(', ')}`);
});

// 胡牌通知
socket.on('game:win', (data) => {
  console.log(`\n🎉 ${data.playerName} 胡牌！`);
  if (data.yakuman) console.log(`   役满：${data.yakuman.join(', ')}`);
});

// 流局通知
socket.on('game:exhaustive_draw', () => {
  console.log(`\n🌀 流局`);
});

// 错误处理
socket.on('error', (err) => {
  console.error(`❌ 错误:`, err);
});

socket.on('disconnect', () => {
  console.log(`\n⚠️  断开连接`);
});

// 偶尔发言
function randomSpeech() {
  const speeches = [
    "这局牌不错。",
    "听牌了。",
    "防守吧。",
    "好牌运。",
    "继续。"
  ];
  
  if (Math.random() < 0.3) {
    const speech = speeches[Math.floor(Math.random() * speeches.length)];
    console.log(`💬 紫璃：${speech}`);
    socket.emit('agent:speech', { text: speech });
  }
}

// 每分钟说句话
setInterval(randomSpeech, 60000);

console.log(`等待服务器响应...\n`);
