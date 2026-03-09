/**
 * 简单的 AI 玩家连接脚本
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = process.argv[2] || 'mmh2ct7t-z0xywsyno';
const AGENT_ID = process.argv[3] || 'ai-' + Date.now();
const AGENT_NAME = process.argv[4] || 'AI玩家';

const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log(`[${AGENT_NAME}] 连接成功`);
  
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent',
    allowMidGame: true
  }, (res) => {
    if (res.success) {
      console.log(`[${AGENT_NAME}] 加入房间成功，位置: ${res.position}`);
      
      // 自动准备
      setTimeout(() => {
        socket.emit('agent:command', { cmd: 'ready', ready: true }, (r) => {
          console.log(`[${AGENT_NAME}] 已准备`);
        });
      }, 1000);
    } else {
      console.log(`[${AGENT_NAME}] 加入失败: ${res.error}`);
    }
  });
});

socket.on('room:updated', (data) => {
  const players = data.room?.players || [];
  console.log(`[${AGENT_NAME}] 房间更新: ${players.map(p => p.name).join(', ')}`);
  
  // 检查是否4人齐了
  if (players.length === 4) {
    console.log(`[${AGENT_NAME}] 房间已满4人`);
  }
});

socket.on('game:started', () => {
  console.log(`[${AGENT_NAME}] 游戏开始！`);
});

socket.on('agent:your_turn', (data) => {
  console.log(`[${AGENT_NAME}] 轮到我: phase=${data.phase}`);
  
  // 简单决策：摸牌/打牌
  setTimeout(() => {
    if (data.phase === 'draw') {
      socket.emit('agent:command', { cmd: 'draw' }, (r) => {
        console.log(`[${AGENT_NAME}] 摸牌`);
      });
    } else if (data.phase === 'discard') {
      const hand = data.hand || [];
      const tile = hand[0];
      if (tile) {
        socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (r) => {
          console.log(`[${AGENT_NAME}] 打出 ${tile.id}`);
        });
      }
    }
  }, 1000);
});

socket.on('agent:actions', (data) => {
  console.log(`[${AGENT_NAME}] 有操作: ${data.actions?.map(a => a.action).join(',')}`);
  
  // 简单决策
  setTimeout(() => {
    const actions = data.actions || [];
    if (actions.find(a => a.action === 'hu')) {
      socket.emit('agent:command', { cmd: 'action', action: 'hu' }, () => {
        console.log(`[${AGENT_NAME}] 胡牌！`);
      });
    } else if (actions.find(a => a.action === 'gang')) {
      socket.emit('agent:command', { cmd: 'action', action: 'gang' }, () => {
        console.log(`[${AGENT_NAME}] 杠牌`);
      });
    } else if (actions.find(a => a.action === 'peng')) {
      socket.emit('agent:command', { cmd: 'action', action: 'peng' }, () => {
        console.log(`[${AGENT_NAME}] 碰牌`);
      });
    } else {
      socket.emit('agent:command', { cmd: 'pass' }, () => {
        console.log(`[${AGENT_NAME}] 跳过`);
      });
    }
  }, 1000);
});

socket.on('game:ended', (data) => {
  console.log(`[${AGENT_NAME}] 游戏结束! 胜者: ${data.winner}`);
  setTimeout(() => process.exit(0), 3000);
});

socket.on('disconnect', () => {
  console.log(`[${AGENT_NAME}] 断开连接`);
});

console.log(`[${AGENT_NAME}] 启动... 目标房间: ${ROOM_ID}`);
