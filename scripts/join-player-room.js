/**
 * 派发 AI 加入玩家房间
 * 保持连接直到游戏结束
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

// 从命令行参数获取房间ID
const ROOM_ID = process.argv[2];
if (!ROOM_ID) {
  console.error('用法: node join-player-room.js <roomId>');
  process.exit(1);
}

const agents = [
  { id: 'agent-zi', name: '紫璃' },
  { id: 'agent-bai', name: '白泽' },
  { id: 'agent-li', name: '李瞳' }
];

const sockets = [];

agents.forEach(agent => {
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true
  });
  
  sockets.push(socket);
  
  socket.on('connect', () => {
    console.log(`[${agent.name}] 连接成功`);
    socket.emit('room:joinAI', {
      roomId: ROOM_ID,
      agentId: agent.id,
      agentName: agent.name,
      type: 'ai-agent'
    }, (res) => {
      if (res.success) {
        console.log(`[${agent.name}] 加入成功, 位置: ${res.position}`);
      } else {
        console.log(`[${agent.name}] 加入失败: ${res.error}`);
      }
    });
  });
  
  // 监听轮次事件
  socket.on('agent:your_turn', (data) => {
    console.log(`[${agent.name}] 轮次: ${data.phase}`);
    
    setTimeout(() => {
      if (data.phase === 'draw') {
        socket.emit('agent:command', { cmd: 'draw' }, (res) => {
          console.log(`[${agent.name}] 摸牌: ${res.success ? '成功' : res.error}`);
        });
      } else if (data.phase === 'discard' && data.hand && data.hand.length > 0) {
        const tile = data.hand[Math.floor(Math.random() * data.hand.length)];
        console.log(`[${agent.name}] 打出: ${tile.display}`);
        socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
          if (!res?.success) {
            // 重试打第一张
            const retry = data.hand[0];
            socket.emit('agent:command', { cmd: 'discard', tileId: retry.id });
          }
        });
      } else if (data.phase === 'action' && data.actions && data.actions.length > 0) {
        // 处理吃碰杠胡
        const actions = data.actions;
        console.log(`[${agent.name}] 可用操作: ${actions.map(a => a.action).join(',')}`);
        
        if (actions.some(a => a.action === 'hu')) {
          console.log(`[${agent.name}] 胡!`);
          socket.emit('agent:command', { cmd: 'action', action: 'hu' });
        } else if (actions.some(a => a.action === 'gang')) {
          console.log(`[${agent.name}] 杠`);
          socket.emit('agent:command', { cmd: 'action', action: 'gang' });
        } else if (actions.some(a => a.action === 'peng')) {
          console.log(`[${agent.name}] 碰`);
          socket.emit('agent:command', { cmd: 'action', action: 'peng' });
        } else if (actions.some(a => a.action === 'chi')) {
          console.log(`[${agent.name}] 吃`);
          socket.emit('agent:command', { cmd: 'action', action: 'chi' });
        } else {
          console.log(`[${agent.name}] 过`);
          socket.emit('agent:command', { cmd: 'pass' });
        }
      }
    }, 800);
  });
  
  // 监听可用操作
  socket.on('game:actions', (data) => {
    const actions = data.actions || [];
    console.log(`[${agent.name}] 可用操作: ${actions.map(a => a.action).join(',')}`);
    
    setTimeout(() => {
      if (actions.some(a => a.action === 'hu')) {
        socket.emit('agent:command', { cmd: 'action', action: 'hu' });
      } else if (actions.some(a => a.action === 'gang')) {
        socket.emit('agent:command', { cmd: 'action', action: 'gang' });
      } else if (actions.some(a => a.action === 'peng')) {
        socket.emit('agent:command', { cmd: 'action', action: 'peng' });
      } else {
        socket.emit('agent:command', { cmd: 'pass' });
      }
    }, 500);
  });
  
  // 监听游戏结束
  socket.on('game:ended', (data) => {
    console.log(`[${agent.name}] 游戏结束, 赢家: ${data.winner}`);
  });
  
  // 监听新一局开始
  socket.on('game:started', () => {
    console.log(`[${agent.name}] 新一局开始`);
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`[${agent.name}] 断开连接: ${reason}`);
  });
  
  socket.on('reconnect', () => {
    console.log(`[${agent.name}] 重新连接`);
  });
});

// 保持进程运行，每30秒检查一次连接状态
setInterval(() => {
  const connectedCount = sockets.filter(s => s.connected).length;
  if (connectedCount === 0) {
    console.log('所有 AI 已断开，退出脚本');
    process.exit(0);
  }
}, 30000);

console.log(`正在派发 3 个 AI 加入房间: ${ROOM_ID}`);
console.log('AI 将保持连接直到所有断开');
