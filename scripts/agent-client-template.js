/**
 * AI Agent 客户端模板
 * 
 * 这是标准模板，不要修改此文件！
 * 使用方式：node agent-client-template.js <roomId> <agentId> <agentName>
 * 
 * 示例：node agent-client-template.js mmfxxx zili 紫璃
 */

const io = require('socket.io-client');

// 从命令行参数获取配置
const ROOM_ID = process.argv[2] || 'test-room';
const AGENT_ID = process.argv[3] || 'agent';
const AGENT_NAME = process.argv[4] || 'AI玩家';

console.log(`\n========================================`);
console.log(`AI Agent: ${AGENT_NAME}`);
console.log(`房间: ${ROOM_ID}`);
console.log(`========================================\n`);

const socket = io('http://localhost:3000');
let hand = [];
let gameStarted = false;

// 心跳间隔（毫秒）
const HEARTBEAT_INTERVAL = 10000;
let heartbeatTimer = null;

// ========== 连接和加入 ==========

socket.on('connect', () => {
  console.log(`[${AGENT_NAME}] 已连接服务器`);
  
  // 加入房间
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    if (res.success) {
      console.log(`[${AGENT_NAME}] ✅ 加入房间成功，位置 ${res.position}`);
      startHeartbeat();
    } else {
      console.log(`[${AGENT_NAME}] ❌ 加入失败：${res.error}`);
    }
  });
});

// ========== 心跳 ==========

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  
  heartbeatTimer = setInterval(() => {
    socket.emit('agent:heartbeat', {
      roomId: ROOM_ID,
      agentId: AGENT_ID,
      timestamp: Date.now()
    });
  }, HEARTBEAT_INTERVAL);
}

// ========== 游戏事件处理 ==========

socket.on('agent:your_turn', (data) => {
  hand = data.hand || [];
  console.log(`\n[${AGENT_NAME}] ========== 我的回合 ==========`);
  console.log(`阶段: ${data.phase}`);
  console.log(`手牌: ${hand.map(t => t.display).join(' ')}`);
  
  // 决策逻辑
  if (data.phase === 'draw') {
    socket.emit('agent:command', { cmd: 'draw' });
  } else if (data.phase === 'discard' && hand.length > 0) {
    // 简单策略：打第一张
    const tile = hand[0];
    console.log(`[${AGENT_NAME}] 打出: ${tile.display}`);
    socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
      if (!res?.success && hand[0]) {
        socket.emit('agent:command', { cmd: 'discard', tileId: hand[0].id });
      }
    });
  }
});

socket.on('game:actions', (data) => {
  const actions = data.actions || [];
  console.log(`[${AGENT_NAME}] 可用操作: ${actions.map(a => a.action).join(', ')}`);
  
  // 优先级：胡 > 杠 > 碰 > 吃
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
});

socket.on('game:started', () => {
  gameStarted = true;
  console.log(`[${AGENT_NAME}] 🎮 游戏开始！`);
});

socket.on('game:ended', (data) => {
  console.log(`[${AGENT_NAME}] 🏆 游戏结束！`);
  if (data.winner) {
    console.log(`[${AGENT_NAME}] 赢家: ${data.winner.name}`);
  }
  
  // 发送游戏报告
  socket.emit('agent:report', {
    type: 'game_report',
    roomId: ROOM_ID,
    player: { id: AGENT_ID, name: AGENT_NAME },
    result: data.winner?.id === AGENT_ID ? 'win' : 'lose',
    summary: `${AGENT_NAME}完成了这局游戏`
  });
});

socket.on('disconnect', () => {
  console.log(`[${AGENT_NAME}] 断开连接`);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});

// 保持运行
setInterval(() => {}, 60000);
