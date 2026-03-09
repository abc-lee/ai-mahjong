const { io } = require('socket.io-client');

const agents = [
  { id: 'qingluan', name: '青鸾' },
  { id: 'yanhua', name: '烟华' }
];

// 使用全局变量共享房间 ID
global.createdRoomId = null;

// 先启动第一个 Agent（房主）
const socket0 = io('http://localhost:3000');
const agent0 = agents[0];

socket0.on('connect', () => {
  console.log('[' + agent0.name + '] 已连接');
  console.log('[' + agent0.name + '] 创建房间...');
  socket0.emit('room:createAI', {
    agentId: agent0.id,
    agentName: agent0.name,
    type: 'ai-agent'
  }, (res) => {
    if (res.roomId) {
      global.createdRoomId = res.roomId;
      console.log('[' + agent0.name + '] 创建房间成功:', global.createdRoomId);
      console.log('[' + agent0.name + '] 等待其他 Agent 加入...');
      
      // 5 秒后自动开始游戏（如果没有其他玩家加入）
      setTimeout(() => {
        console.log('[' + agent0.name + '] 发送准备信号...');
        socket0.emit('agent:command', { cmd: 'ready', ready: true });
      }, 1000);
    } else {
      console.error('[' + agent0.name + '] 创建房间失败:', res.message);
    }
  });
});

socket0.on('room:updated', (data) => {
  if (data.room) {
    console.log('[' + agent0.name + '] 房间更新:', data.room.id, '玩家数:', data.room.players.length);
    
    // 如果只有 2 个玩家，添加自动托管玩家
    if (data.room.players.length === 2 && data.room.state === 'waiting') {
      console.log('[' + agent0.name + '] 添加自动托管玩家...');
      socket0.emit('agent:command', { cmd: 'add_auto_player' });
    }
  }
});

socket0.on('game:started', () => {
  console.log('[' + agent0.name + '] 游戏开始!');
});

socket0.on('agent:your_turn', (data) => {
  console.log('[' + agent0.name + '] 轮到我了，阶段:', data.phase, '手牌:', (data.hand || []).length);
  setTimeout(() => {
    if (data.phase === 'draw') {
      socket0.emit('agent:command', { cmd: 'draw' });
      console.log('[' + agent0.name + '] 摸牌');
    } else if (data.phase === 'discard' && data.hand && data.hand.length > 0) {
      const tile = data.hand[Math.floor(Math.random() * data.hand.length)];
      socket0.emit('agent:command', { cmd: 'discard', tileId: tile.id });
      console.log('[' + agent0.name + '] 打牌');
    }
  }, 800);
});

socket0.on('game:actions', (data) => {
  const actions = data.actions || [];
  console.log('[' + agent0.name + '] 可以动作:', actions.map(a => a.action).join(', '));
  setTimeout(() => {
    if (actions.some(a => a.action === 'hu')) {
      socket0.emit('agent:command', { cmd: 'action', action: 'hu' });
      console.log('[' + agent0.name + '] 胡!');
    } else if (actions.some(a => a.action === 'peng')) {
      socket0.emit('agent:command', { cmd: 'action', action: 'peng' });
      console.log('[' + agent0.name + '] 碰!');
    } else if (actions.some(a => a.action === 'chi')) {
      socket0.emit('agent:command', { cmd: 'action', action: 'chi' });
      console.log('[' + agent0.name + '] 吃!');
    } else {
      socket0.emit('agent:command', { cmd: 'pass' });
      console.log('[' + agent0.name + '] 过');
    }
  }, 500);
});

socket0.on('disconnect', () => {
  console.log('[' + agent0.name + '] 断开连接');
});

// 延迟 2 秒后启动第二个 Agent
setTimeout(() => {
  const socket1 = io('http://localhost:3000');
  const agent1 = agents[1];
  
  socket1.on('connect', () => {
    console.log('[' + agent1.name + '] 已连接');
    
    if (global.createdRoomId) {
      console.log('[' + agent1.name + '] 加入房间:', global.createdRoomId);
      socket1.emit('room:joinAI', {
        roomId: global.createdRoomId,
        agentId: agent1.id,
        agentName: agent1.name,
        type: 'ai-agent'
      }, (res) => {
        if (res.success) {
          console.log('[' + agent1.name + '] 加入成功，位置:', res.position);
          // 自动准备
          setTimeout(() => {
            console.log('[' + agent1.name + '] 发送准备信号...');
            socket1.emit('agent:command', { cmd: 'ready', ready: true });
          }, 500);
        } else {
          console.error('[' + agent1.name + '] 加入失败:', res.error);
        }
      });
    } else {
      console.error('[' + agent1.name + '] 还没有可用的房间 ID');
    }
  });
  
  socket1.on('room:updated', (data) => {
    if (data.room) {
      console.log('[' + agent1.name + '] 房间更新:', data.room.id, '玩家数:', data.room.players.length);
    }
  });
  
  socket1.on('game:started', () => {
    console.log('[' + agent1.name + '] 游戏开始!');
  });
  
  socket1.on('agent:your_turn', (data) => {
    console.log('[' + agent1.name + '] 轮到我了，阶段:', data.phase, '手牌:', (data.hand || []).length);
    setTimeout(() => {
      if (data.phase === 'draw') {
        socket1.emit('agent:command', { cmd: 'draw' });
        console.log('[' + agent1.name + '] 摸牌');
      } else if (data.phase === 'discard' && data.hand && data.hand.length > 0) {
        const tile = data.hand[Math.floor(Math.random() * data.hand.length)];
        socket1.emit('agent:command', { cmd: 'discard', tileId: tile.id });
        console.log('[' + agent1.name + '] 打牌');
      }
    }, 800);
  });
  
  socket1.on('game:actions', (data) => {
    const actions = data.actions || [];
    console.log('[' + agent1.name + '] 可以动作:', actions.map(a => a.action).join(', '));
    setTimeout(() => {
      if (actions.some(a => a.action === 'hu')) {
        socket1.emit('agent:command', { cmd: 'action', action: 'hu' });
        console.log('[' + agent1.name + '] 胡!');
      } else if (actions.some(a => a.action === 'peng')) {
        socket1.emit('agent:command', { cmd: 'action', action: 'peng' });
        console.log('[' + agent1.name + '] 碰!');
      } else if (actions.some(a => a.action === 'chi')) {
        socket1.emit('agent:command', { cmd: 'action', action: 'chi' });
        console.log('[' + agent1.name + '] 吃!');
      } else {
        socket1.emit('agent:command', { cmd: 'pass' });
        console.log('[' + agent1.name + '] 过');
      }
    }, 500);
  });
  
  socket1.on('disconnect', () => {
    console.log('[' + agent1.name + '] 断开连接');
  });
  
  socket1.on('connect_error', (err) => {
    console.error('[' + agent1.name + '] 连接错误:', err.message);
  });
  
}, 2000);

console.log('AI Agents 启动中...\n');
