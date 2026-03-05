/**
 * 调试版 AI Agent - 打印所有收到的消息
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = process.argv[2];

const agents = [
  { id: 'zili', name: '紫璃' },
  { id: 'baize', name: '白泽' },
  { id: 'litong', name: '李瞳' },
];

agents.forEach((agent) => {
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    console.log(`[${agent.name}] 已连接，socket.id=${socket.id}`);
    
    setTimeout(() => {
      socket.emit('room:joinAI', {
        roomId: ROOM_ID,
        agentId: agent.id,
        agentName: agent.name,
        type: 'ai-agent'
      }, (res) => {
        console.log(`[${agent.name}] 加入结果:`, JSON.stringify(res));
      });
    }, 500);
  });

  // 监听所有事件
  socket.onAny((eventName, ...args) => {
    console.log(`[${agent.name}] 收到事件: ${eventName}`, JSON.stringify(args).slice(0, 200));
  });

  socket.on('agent:your_turn', (data) => {
    console.log(`[${agent.name}] ★ agent:your_turn, phase=${data.phase}, hand=${data.hand?.length}张`);
    if (data.phase === 'discard' && data.hand?.length > 0) {
      const tile = data.hand[0];
      console.log(`[${agent.name}] 打出: ${tile.display}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
        console.log(`[${agent.name}] 打牌结果:`, res);
      });
    }
  });

  socket.on('game:state', (data) => {
    console.log(`[${agent.name}] ★ game:state, yourTurn=${data.yourTurn}, phase=${data.turnPhase}, hand=${data.yourHand?.length}张`);
    if (data.yourTurn && data.turnPhase === 'discard' && data.yourHand?.length > 0) {
      const tile = data.yourHand[0];
      console.log(`[${agent.name}] 打出: ${tile.display}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
        console.log(`[${agent.name}] 打牌结果:`, res);
      });
    }
  });
});

console.log(`调试模式，房间: ${ROOM_ID}`);
