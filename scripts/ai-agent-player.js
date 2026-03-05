/**
 * 持续运行的 AI Agent
 * 自动加入房间并持续打牌
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

// 从命令行获取房间号
const ROOM_ID = process.argv[2] || 'mmd14i9q-gb9ax291w';

const agents = [
  { id: 'zili', name: '紫璃' },
  { id: 'baize', name: '白泽' },
  { id: 'litong', name: '李瞳' },
];

agents.forEach((agent, index) => {
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log(`[${agent.name}] 已连接`);
    
    // 延迟加入房间
    setTimeout(() => {
      socket.emit('room:joinAI', {
        roomId: ROOM_ID,
        agentId: agent.id,
        agentName: agent.name,
        type: 'ai-agent'
      }, (res) => {
        console.log(`[${agent.name}] 加入房间:`, res.success ? `成功 position=${res.position}` : res.error);
      });
    }, 1000 * (index + 1));
  });

  // 持续处理轮次（agent:your_turn 事件 - AI Agent 专用）
  socket.on('agent:your_turn', (data) => {
    console.log(`[${agent.name}] 收到 agent:your_turn, phase: ${data.phase}, 手牌: ${data.hand?.length}张`);
    handleTurn(socket, agent.name, data);
  });

  // 也监听 game:state（紫璃作为"人类"玩家时会收到这个）
  socket.on('game:state', (data) => {
    // 打印收到的数据以便调试
    console.log(`[${agent.name}] 收到 game:state, yourTurn=${data.yourTurn}, phase=${data.turnPhase}, hand=${data.yourHand?.length}张`);
    
    if (data.yourHand) {
      agent.hand = data.yourHand;
    }
    if (data.yourTurn) {
      console.log(`[${agent.name}] ★★★ 轮到我了！phase=${data.turnPhase}`);
      handleTurn(socket, agent.name, { phase: data.turnPhase, hand: data.yourHand });
    }
  });

  // 处理吃碰杠胡
  socket.on('game:actions', (data) => {
    console.log(`[${agent.name}] 收到 game:actions:`, data.actions?.map(a => a.action).join(','));
    handleActions(socket, data.actions || []);
  });

  socket.on('disconnect', () => {
    console.log(`[${agent.name}] 断开连接`);
  });
});

function handleTurn(socket, name, data) {
  setTimeout(() => {
    if (data.phase === 'draw') {
      console.log(`[${name}] 执行摸牌`);
      socket.emit('agent:command', { cmd: 'draw' }, (res) => {
        console.log(`[${name}] 摸牌结果:`, res);
      });
    } else if (data.phase === 'discard') {
      const hand = data.hand || [];
      if (hand.length > 0) {
        const tile = hand[Math.floor(Math.random() * hand.length)];
        console.log(`[${name}] 打出: ${tile.display} (id: ${tile.id})`);
        socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
          console.log(`[${name}] 打牌结果:`, res);
        });
      } else {
        console.log(`[${name}] 没有手牌！`);
      }
    }
  }, 500);
}

function handleActions(socket, actions) {
  // 简单策略：有胡就胡，有碰就碰，否则过
  if (actions.some(a => a.action === 'hu')) {
    socket.emit('agent:command', { cmd: 'action', action: 'hu' });
  } else if (actions.some(a => a.action === 'gang')) {
    socket.emit('agent:command', { cmd: 'action', action: 'gang' });
  } else if (actions.some(a => a.action === 'peng')) {
    socket.emit('agent:command', { cmd: 'action', action: 'peng' });
  } else if (actions.some(a => a.action === 'chi')) {
    socket.emit('agent:command', { cmd: 'action', action: 'chi' });
  } else {
    socket.emit('agent:command', { cmd: 'pass' });
  }
}

console.log(`AI Agent 启动，目标房间: ${ROOM_ID}`);
console.log('按 Ctrl+C 退出');
