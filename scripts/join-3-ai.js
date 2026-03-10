/**
 * 派发3个AI加入当前游戏
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

const agents = [
  { id: 'ai-1', name: '紫璃', type: 'ai-agent' },
  { id: 'ai-2', name: '白泽', type: 'ai-agent' },
  { id: 'ai-3', name: '李瞳', type: 'ai-agent' },
];

const sockets = [];

// 先获取房间列表
const listSocket = io(SERVER_URL);
listSocket.on('connect', () => {
  console.log('获取房间列表...');
  listSocket.emit('room:list', (res) => {
    console.log('可用房间:', res.rooms);
    
    if (res.rooms && res.rooms.length > 0) {
      // 找到等待中的房间
      const waitingRoom = res.rooms.find(r => r.state === 'waiting');
      if (waitingRoom) {
        console.log('加入房间:', waitingRoom.id);
        joinRoom(waitingRoom.id);
      } else {
        console.log('没有等待中的房间');
        process.exit(0);
      }
    } else {
      console.log('没有可用房间');
      process.exit(0);
    }
    listSocket.disconnect();
  });
});

function joinRoom(roomId) {
  agents.forEach((agent, index) => {
    setTimeout(() => {
      const socket = io(SERVER_URL);
      
      socket.on('connect', () => {
        console.log(`[${agent.name}] 连接成功`);
        
        socket.emit('room:joinAI', {
          roomId,
          agentId: agent.id,
          agentName: agent.name,
          type: agent.type
        }, (res) => {
          if (res.success) {
            console.log(`[${agent.name}] 加入成功，位置: ${res.position}`);
          } else {
            console.log(`[${agent.name}] 加入失败:`, res.error);
          }
        });
      });
      
      // 简单AI逻辑
      socket.on('agent:your_turn', (data) => {
        setTimeout(() => {
          if (data.phase === 'draw') {
            socket.emit('agent:command', { cmd: 'draw' });
          } else if (data.phase === 'discard' && data.hand?.length > 0) {
            const tile = data.hand[Math.floor(Math.random() * data.hand.length)];
            socket.emit('agent:command', { cmd: 'discard', tileId: tile.id });
          }
        }, 500);
      });
      
      socket.on('game:actions', (data) => {
        setTimeout(() => {
          socket.emit('agent:command', { cmd: 'pass' });
        }, 300);
      });
      
      sockets.push(socket);
    }, index * 500);
  });
}
