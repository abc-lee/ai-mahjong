/**
 * 加入指定房间
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'mmdbswrm-0qfm00w5m';

// 创建 3 个 AI Agent
const agents = [
  { id: 'zili', name: '紫璃', socket: null },
  { id: 'baize', name: '白泽', socket: null },
  { id: 'litong', name: '李瞳', socket: null },
];

agents.forEach((agent, index) => {
  const socket = io(SERVER_URL, {
    auth: { type: 'ai-agent', agentId: agent.id, agentName: agent.name }
  });

  socket.on('connect', () => {
    console.log(`[${agent.name}] 已连接`);
    
    // 加入房间
    setTimeout(() => {
      socket.emit('room:joinAI', {
        roomId: ROOM_ID,
        agentId: agent.id,
        agentName: agent.name,
        type: 'ai-agent'
      }, (res) => {
        console.log(`[${agent.name}] 加入房间:`, res.success ? '成功' : res.error);
      });
    }, 500 * (index + 1));
  });

  // 处理轮次
  socket.on('agent:your_turn', (data) => {
    console.log(`[${agent.name}] 轮次: ${data.phase}`);
    
    if (data.phase === 'draw') {
      socket.emit('agent:command', { cmd: 'draw' });
    } else if (data.phase === 'discard' && data.hand?.length > 0) {
      const tile = data.hand[Math.floor(Math.random() * data.hand.length)];
      console.log(`[${agent.name}] 打出: ${tile.display}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: tile.id });
    }
  });
  
  // 处理游戏状态（作为"人类"玩家）
  socket.on('game:state', (data) => {
    if (data.yourTurn) {
      console.log(`[${agent.name}] 收到 game:state, yourTurn=true`);
      if (data.turnPhase === 'draw') {
        socket.emit('game:draw');
      } else if (data.turnPhase === 'discard' && data.yourHand?.length > 0) {
        const tile = data.yourHand[Math.floor(Math.random() * data.yourHand.length)];
        console.log(`[${agent.name}] 打出: ${tile.display}`);
        socket.emit('game:discard', { tileId: tile.id });
      }
    }
  });

  // 处理操作
  socket.on('game:actions', (data) => {
    const actions = data.actions || [];
    if (actions.some(a => a.action === 'hu')) {
      socket.emit('game:action', { action: 'hu' });
    } else if (actions.some(a => a.action === 'gang')) {
      socket.emit('game:action', { action: 'gang' });
    } else if (actions.some(a => a.action === 'peng')) {
      socket.emit('game:action', { action: 'peng' });
    } else {
      socket.emit('game:pass');
    }
  });

  agent.socket = socket;
});

console.log(`正在连接房间 ${ROOM_ID}...`);
setTimeout(() => process.exit(0), 300000);
