/**
 * AI Agent Monitor & Reconnect Script
 * 监控房间状态，游戏结束后自动重连
 */

const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const ROOM_ID = process.argv[2];
const AGENT_ID = process.argv[3];
const AGENT_NAME = process.argv[4];

if (!ROOM_ID || !AGENT_ID || !AGENT_NAME) {
  console.error('用法：node monitor-reconnect.js <roomId> <agentId> <agentName>');
  process.exit(1);
}

console.log(`🀄 监控程序启动`);
console.log(`   房间：${ROOM_ID}`);
console.log(`   Agent: ${AGENT_NAME}(${AGENT_ID})`);
console.log(`   模式：等待游戏结束后重连\n`);

let socket = null;
let reconnectInterval = null;
let monitoringInterval = null;

// 清理旧文件
const EVENTS_FILE = path.join(__dirname, `${AGENT_ID}-events.jsonl`);
const DECISION_FILE = path.join(__dirname, `${AGENT_ID}-decision.json`);
if (fs.existsSync(EVENTS_FILE)) fs.unlinkSync(EVENTS_FILE);
if (fs.existsSync(DECISION_FILE)) fs.unlinkSync(DECISION_FILE);

function output(data) {
  const json = JSON.stringify(data);
  console.log('[EVENT]', json);
  if (fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, json + '\n', { flag: 'a' });
  }
}

function connect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  
  socket = io('http://localhost:3000');
  
  socket.on('connect', () => {
    console.log('✓ 已连接服务器');
    output({ type: 'connected', agentId: AGENT_ID, agentName: AGENT_NAME });
    
    // 尝试加入房间
    socket.emit('room:joinAI', {
      roomId: ROOM_ID,
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
      type: 'ai-agent'
    }, (res) => {
      if (res.success) {
        console.log('✓ 加入房间成功！位置:', res.position);
        output({ type: 'joined', position: res.position });
        
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          monitoringInterval = null;
        }
      } else {
        console.log('✗ 加入失败:', res.error);
        output({ type: 'join_error', error: res.error });
        
        // 如果是因为游戏已开始，等待游戏结束
        if (res.error && res.error.includes('游戏已开始')) {
          console.log('⏳ 游戏进行中，等待结束后重连...');
          startMonitoring();
        } else if (res.error && res.error.includes('房间不存在')) {
          console.log('⏳ 房间不存在，等待创建后重连...');
          startMonitoring();
        } else {
          // 其他错误，5 秒后重试
          console.log('⏳ 5 秒后重试...');
          setTimeout(connect, 5000);
        }
      }
    });
  });
  
  socket.on('room:updated', (data) => {
    const room = data.room;
    const players = room.players.map(p => `${p.name}(${p.type})`).join(', ');
    console.log(`📋 房间更新：${room.state} | 玩家：${players}`);
    output({ type: 'room_updated', room: { state: room.state, players: room.players.map(p => ({ name: p.name, type: p.type })) } });
    
    // 如果游戏结束，尝试重连
    if (room.state === 'finished' && reconnectInterval === null) {
      console.log('🎯 游戏结束！准备重连...');
      startReconnect();
    }
  });
  
  socket.on('game:ended', (data) => {
    console.log('🎉 游戏结束！获胜者:', data.winner?.name || '未知');
    output({ type: 'game_ended', winner: data.winner });
    startReconnect();
  });
  
  socket.on('agent:your_turn', (data) => {
    console.log('🎴 轮到你打牌了！阶段:', data.phase);
    output({ type: 'your_turn', phase: data.phase, hand: data.hand, prompt: data.prompt });
  });
  
  socket.on('game:actions', (data) => {
    output({ type: 'actions', actions: data.actions });
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 断开连接');
    output({ type: 'disconnected' });
    setTimeout(connect, 3000);
  });
  
  socket.on('connect_error', (err) => {
    console.log('❌ 连接错误:', err.message);
    setTimeout(connect, 5000);
  });
}

function startMonitoring() {
  if (monitoringInterval) return;
  
  console.log('🔍 开始监控房间状态...');
  monitoringInterval = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('room:list', null, (rooms) => {
        if (Array.isArray(rooms)) {
          const targetRoom = rooms.find(r => r.id === ROOM_ID);
          if (targetRoom) {
            console.log(`📊 房间状态：${targetRoom.state} | 玩家：${targetRoom.players?.length || 0}/4`);
            if (targetRoom.state === 'finished') {
              console.log('🎯 游戏已结束，准备重连...');
              startReconnect();
            }
          } else {
            console.log('📊 房间不存在，等待创建...');
          }
        }
      });
    }
  }, 5000);
}

function startReconnect() {
  if (reconnectInterval) return;
  
  reconnectInterval = setInterval(() => {
    console.log('🔄 尝试重连...');
    connect();
  }, 3000);
}

// 启动心跳
setInterval(() => {
  if (socket && socket.connected) {
    socket.emit('agent:heartbeat', {
      roomId: ROOM_ID,
      agentId: AGENT_ID,
      timestamp: Date.now()
    });
  }
}, 10000);

// 从决策文件读取并发送
let lastDecisionTime = 0;
setInterval(() => {
  if (fs.existsSync(DECISION_FILE)) {
    try {
      const stat = fs.statSync(DECISION_FILE);
      if (stat.mtimeMs > lastDecisionTime && socket && socket.connected) {
        lastDecisionTime = stat.mtimeMs;
        const decision = fs.readFileSync(DECISION_FILE, 'utf8');
        console.log('📤 发送决策:', decision);
        
        try {
          const decisionObj = JSON.parse(decision);
          socket.emit('agent:command', decisionObj, (res) => {
            console.log('✓ 决策结果:', res?.success ? '成功' : '失败', res?.error || '');
            output({ type: 'decision_result', success: res?.success, error: res?.error });
          });
          fs.unlinkSync(DECISION_FILE);
        } catch (e) {
          console.log('❌ 决策格式错误:', e.message);
        }
      }
    } catch (e) {
      // 文件可能正在写入
    }
  }
}, 500);

// 开始连接
connect();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 退出监控程序');
  output({ type: 'monitor_exit', reason: 'user_interrupt' });
  if (socket) socket.disconnect();
  if (reconnectInterval) clearInterval(reconnectInterval);
  if (monitoringInterval) clearInterval(monitoringInterval);
  process.exit(0);
});
