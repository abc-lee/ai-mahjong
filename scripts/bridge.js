/**
 * AI Agent Bridge - 文件轮询版本
 * 
 * 这个脚本支持两种模式：
 * 1. stdin/stdout 模式（生产环境 - OpenClaw）
 * 2. 文件轮询模式（开发环境 - OpenCode/Windows）
 * 
 * 使用方式：
 *   stdin/stdout 模式：
 *     node bridge.js <roomId> <agentId> <agentName>
 * 
 *   文件轮询模式：
 *     node bridge.js <roomId> <agentId> <agentName> --file <filePrefix>
 * 
 * 示例：
 *   node bridge.js mmfxxx zili 紫璃 --file zili
 *   会生成 zili-events.jsonl 和监听 zili-decision.json
 */

const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

// 从命令行参数获取配置
const ROOM_ID = process.argv[2];
const AGENT_ID = process.argv[3];
const AGENT_NAME = process.argv[4];

// 检查是否启用文件模式
const fileModeIndex = process.argv.indexOf('--file');
const FILE_MODE = fileModeIndex !== -1;
const FILE_PREFIX = FILE_MODE ? process.argv[fileModeIndex + 1] : null;

if (!ROOM_ID || !AGENT_ID || !AGENT_NAME) {
  console.error('用法: node bridge.js <roomId> <agentId> <agentName> [--file <prefix>]');
  process.exit(1);
}

// 文件路径
const EVENTS_FILE = FILE_PREFIX ? path.join(__dirname, `${FILE_PREFIX}-events.jsonl`) : null;
const DECISION_FILE = FILE_PREFIX ? path.join(__dirname, `${FILE_PREFIX}-decision.json`) : null;
const SPEECH_FILE = FILE_PREFIX ? path.join(__dirname, `${FILE_PREFIX}-speech.json`) : null;

// 清理旧事件文件（保留决策文件，让之前的决策能被读取）
if (FILE_MODE) {
  if (fs.existsSync(EVENTS_FILE)) fs.unlinkSync(EVENTS_FILE);
}

// 连接游戏服务器
const socket = io('http://localhost:3000');

// ========== 连接和加入 ==========

socket.on('connect', () => {
  output({ type: 'connected', agentId: AGENT_ID, agentName: AGENT_NAME });
  
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent',
    allowMidGame: true  // 允许游戏中途加入（重连场景）
  }, (res) => {
    if (res.success) {
      output({ type: 'joined', position: res.position });
    } else {
      // 如果游戏已开始，尝试作为观察者继续监听
      output({ type: 'warning', message: res.error || '加入失败，尝试观察模式' });
      
      // 尝试请求游戏状态（即使没有加入成功）
      setTimeout(() => {
        socket.emit('agent:requestState', (stateRes) => {
          if (stateRes.prompt) {
            output({ type: 'state_received', phase: stateRes.phase });
          }
        });
      }, 500);
    }
  });
});

// ========== 心跳 ==========

setInterval(() => {
  socket.emit('agent:heartbeat', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    timestamp: Date.now()
  });
}, 10000);

// ========== 游戏事件 → 输出 ==========

socket.on('agent:your_turn', (data) => {
  output({
    type: 'game:action',
    phase: data.phase,
    hand: data.hand,
    lastDrawnTile: data.lastDrawnTile,
    prompt: data.prompt
  });
});

// 监听 AI 可用操作（碰/杠/胡）
socket.on('agent:actions', (data) => {
  output({
    type: 'game:actions',
    actions: data.actions,
    hand: data.hand,
    gameState: data.gameState
  });
});

socket.on('game:actions', (data) => {
  output({
    type: 'actions',
    actions: data.actions
  });
});

socket.on('game:started', () => {
  output({ type: 'game_started' });
});

socket.on('game:ended', (data) => {
  output({
    type: 'game_ended',
    winner: data.winner,
    winningHand: data.winningHand
  });
  
  // 游戏结束后，延迟退出（让决策有时间发送）
  setTimeout(() => {
    output({ type: 'bridge_exit', reason: 'game_ended' });
    process.exit(0);
  }, 2000);
});

socket.on('room:updated', (data) => {
  output({
    type: 'room_updated',
    players: data.room?.players?.map(p => ({ name: p.name, type: p.type }))
  });
});

// 监听群聊消息（用户和其他 AI 的消息）
socket.on('room:chat', (data) => {
  const msg = data.message || data;
  // 忽略自己发的消息（用名字匹配）
  if (msg.sender?.name === AGENT_NAME) {
    return;
  }
  output({
    type: 'chat_message',
    sender: msg.sender,
    content: msg.content,
    timestamp: msg.timestamp
  });
});

// 监听发言气泡（其他 AI 的发言）
socket.on('player:speech', (data) => {
  // 忽略自己的发言（用名字匹配）
  if (data.playerName === AGENT_NAME) {
    return;
  }
  output({
    type: 'player_speech',
    playerId: data.playerId,
    playerName: data.playerName,
    content: data.content,
    emotion: data.emotion
  });
});

socket.on('disconnect', () => {
  output({ type: 'disconnected' });
});

// ========== 决策输入 ==========

// stdin 模式：从主 Agent 接收决策
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  handleDecision(input.trim());
});

// 文件模式：轮询决策文件
if (FILE_MODE) {
  let lastDecisionTime = 0;
  let lastSpeechTime = 0;
  
  setInterval(() => {
    // 检查决策文件
    if (fs.existsSync(DECISION_FILE)) {
      try {
        const stat = fs.statSync(DECISION_FILE);
        if (stat.mtimeMs > lastDecisionTime) {
          lastDecisionTime = stat.mtimeMs;
          const decision = fs.readFileSync(DECISION_FILE, 'utf8');
          handleDecision(decision);
          // 发送后删除决策文件
          fs.unlinkSync(DECISION_FILE);
        }
      } catch (e) {
        // 文件可能正在写入，忽略
      }
    }
    
    // 检查发言文件
    if (fs.existsSync(SPEECH_FILE)) {
      try {
        const stat = fs.statSync(SPEECH_FILE);
        if (stat.mtimeMs > lastSpeechTime) {
          lastSpeechTime = stat.mtimeMs;
          const speechData = fs.readFileSync(SPEECH_FILE, 'utf8');
          handleSpeech(speechData);
          // 发送后删除发言文件
          fs.unlinkSync(SPEECH_FILE);
        }
      } catch (e) {
        // 文件可能正在写入，忽略
      }
    }
  }, 200); // 200ms 轮询间隔
}

// 处理决策
function handleDecision(input) {
  try {
    const decision = JSON.parse(input);
    
    socket.emit('agent:command', decision, (res) => {
      output({
        type: 'decision_result',
        success: res?.success,
        error: res?.error,
        decision: decision
      });
    });
  } catch (e) {
    output({ type: 'error', message: '无效的决策格式: ' + input });
  }
}

// 处理发官
function handleSpeech(input) {
  try {
    const speech = JSON.parse(input);
    
    socket.emit('agent:speak', {
      content: speech.message || speech.content,  // 兼容两种格式
      emotion: speech.emotion || 'neutral'
    }, (res) => {
      output({
        type: 'speech_result',
        success: res?.success,
        error: res?.error,
        message: speech.message || speech.content
      });
    });
  } catch (e) {
    output({ type: 'error', message: '无效的发言格式: ' + input });
  }
}

// ========== 辅助函数 ==========

function output(data) {
  const json = JSON.stringify(data);
  
  // stdout 输出
  console.log(json);
  
  // 文件输出（追加）
  if (FILE_MODE && EVENTS_FILE) {
    fs.writeFileSync(EVENTS_FILE, json + '\n', { flag: 'a' });
  }
}

// 通知主 Agent Bridge 已就绪
output({ type: 'bridge_ready', roomId: ROOM_ID, agentId: AGENT_ID, agentName: AGENT_NAME, fileMode: FILE_MODE });
