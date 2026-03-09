const io = require('socket.io-client');

const ROOM_ID = 'room-mmfxyydc-rtnt1p7so';
const AGENT_ID = 'zili';
const AGENT_NAME = '紫璃';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('已连接服务器');
  
  // 尝试加入房间
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    if (res.success) {
      console.log('✓ 加入房间成功，位置:', res.position);
      console.log('房间 ID:', ROOM_ID);
    } else {
      console.log('✗ 加入失败:', res.error);
      console.log('尝试用 AI 身份创建房间...');
      
      // 用 AI 身份创建房间
      socket.emit('room:createAI', {
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        type: 'ai-agent',
        personality: 'balanced'
      }, (createRes) => {
        if (createRes.success) {
          const newRoomId = createRes.roomId;
          console.log('✓ 房间创建成功:', newRoomId);
          console.log('位置:', createRes.position);
          console.log('玩家 ID:', createRes.playerId);
          
          // 添加自动托管玩家凑人数
          console.log('添加 3 个自动托管玩家...');
          socket.emit('agent:command', { cmd: 'add_auto_player' });
          socket.emit('agent:command', { cmd: 'add_auto_player' });
          socket.emit('agent:command', { cmd: 'add_auto_player' });
          
          // 准备并开始游戏
          setTimeout(() => {
            console.log('设置准备状态...');
            socket.emit('agent:command', { cmd: 'ready', ready: true });
            
            setTimeout(() => {
              console.log('等待游戏自动开始...');
            }, 2000);
          }, 1000);
        } else {
          console.log('✗ 创建失败:', createRes.error);
          process.exit(1);
        }
      });
    }
  });
});

// 监听欢迎消息
socket.on('agent:welcome', (data) => {
  console.log('收到欢迎消息，位置:', data.position);
});

// 监听房间更新
socket.on('room:updated', (data) => {
  console.log('房间更新:', data.room.players.map(p => `${p.name}(${p.type})`).join(', '));
});

// 监听游戏事件
socket.on('game:started', () => {
  console.log('🀄 游戏开始！');
});

socket.on('agent:your_turn', (data) => {
  console.log('轮到你打牌了，阶段:', data.phase);
  console.log('手牌:', data.hand.map(t => t.display).join(' '));
  
  // 自动决策：摸牌或打牌
  if (data.phase === 'draw') {
    console.log('决策：摸牌');
    socket.emit('agent:command', { cmd: 'draw' });
  } else if (data.phase === 'discard' && data.hand.length > 0) {
    const tile = data.hand[data.hand.length - 1];
    console.log('决策：打牌', tile.display);
    socket.emit('agent:command', { cmd: 'discard', tileId: tile.id });
  }
});

socket.on('game:actions', (data) => {
  console.log('可用操作:', data.actions.map(a => a.action).join(', '));
  // 简单决策：跳过
  socket.emit('agent:command', { cmd: 'pass' });
});

socket.on('game:ended', (data) => {
  console.log('游戏结束！');
  console.log('赢家:', data.winner);
  console.log('玩家分数:', data.players.map(p => `${p.name}: ${p.score}`).join(', '));
  setTimeout(() => process.exit(0), 2000);
});

// 心跳
setInterval(() => {
  socket.emit('agent:heartbeat', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    timestamp: Date.now()
  });
}, 10000);
