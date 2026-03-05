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

  // 持续处理轮次
  socket.on('agent:your_turn', (data) => {
    console.log(`[${agent.name}] 轮次: ${data.phase}, 手牌: ${data.hand?.length}张`);
    
    setTimeout(() => {
      if (data.phase === 'draw') {
        // 摸牌
        socket.emit('agent:command', { cmd: 'draw' }, (res) => {
          console.log(`[${agent.name}] 摸牌:`, res.success ? '成功' : res.error);
        });
      } else if (data.phase === 'discard') {
        // 打牌
        if (data.hand && data.hand.length > 0) {
          const tile = data.hand[Math.floor(Math.random() * data.hand.length)];
          console.log(`[${agent.name}] 打出: ${tile.display}`);
          socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
            console.log(`[${agent.name}] 打牌:`, res.success ? '成功' : res.error);
          });
        }
      }
    }, 500 + Math.random() * 1000); // 随机延迟 0.5-1.5 秒
  });

  // 处理吃碰杠胡
  socket.on('game:actions', (data) => {
    console.log(`[${agent.name}] 可用操作:`, data.actions?.map(a => a.action).join(','));
    // 简单策略：有胡就胡，有碰就碰，否则过
    const actions = data.actions || [];
    if (actions.some(a => a.action === 'hu')) {
      socket.emit('agent:command', { cmd: 'action', action: 'hu' });
    } else if (actions.some(a => a.action === 'gang')) {
      socket.emit('agent:command', { cmd: 'action', action: 'gang' });
    } else if (actions.some(a => a.action === 'peng')) {
      socket.emit('agent:command', { cmd: 'action', action: 'peng' });
    } else {
      socket.emit('agent:command', { cmd: 'pass' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[${agent.name}] 断开连接`);
  });
});

console.log(`AI Agent 启动，目标房间: ${ROOM_ID}`);
console.log('按 Ctrl+C 退出');
