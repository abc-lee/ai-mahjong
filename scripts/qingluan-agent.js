/**
 * 青鸾 AI Agent - 麻将玩家
 * 
 * 连接服务器，加入指定房间
 * 简单策略：摸牌/打牌随机，碰/胡则行动
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const AGENT_ID = 'qingluan-agent';
const AGENT_NAME = '青鸾';
const ROOM_ID = 'mmeu4825-dddarxdlm';

class QingluanAgent {
  constructor() {
    this.socket = null;
    this.hand = [];
    this.roomId = null;
    this.lastDiscard = null;
  }

  /**
   * 连接服务器
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL);

      this.socket.on('connect', () => {
        console.log(`[${AGENT_NAME}] ✅ 连接到服务器`);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error(`[${AGENT_NAME}] ❌ 连接失败：${err.message}`);
        reject(err);
      });

      // 注册所有事件监听
      this.setupEventListeners();
    });
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 自己的回合
    this.socket.on('agent:your_turn', async (data) => {
      this.hand = data.hand || [];
      
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`【${AGENT_NAME}】轮次：${data.phase}`);
      console.log(`${'═'.repeat(60)}`);
      
      if (data.prompt) {
        console.log('\n' + data.prompt + '\n');
      }
      
      // 根据阶段执行操作
      if (data.phase === 'draw') {
        this.drawTile();
      } else if (data.phase === 'discard') {
        this.discardTile();
      }
    });

    // 可用操作提示
    this.socket.on('game:actions', async (data) => {
      const actions = data.actions || [];
      console.log(`\n[${AGENT_NAME}] 🎯 可用操作：${actions.map(a => a.action).join(', ') || '无'}`);
      this.lastDiscard = data.lastDiscard;
      
      // 策略：有胡打胡，有碰碰，否则跳过
      if (actions.includes('hu')) {
        console.log(`[${AGENT_NAME}] 选择：胡！`);
        this.socket.emit('agent:command', { cmd: 'action', action: 'hu' });
      } else if (actions.includes('peng')) {
        console.log(`[${AGENT_NAME}] 选择：碰`);
        this.socket.emit('agent:command', { cmd: 'action', action: 'peng' });
      } else {
        console.log(`[${AGENT_NAME}] 选择：跳过`);
        this.socket.emit('agent:command', { cmd: 'pass' });
      }
    });

    // 游戏结束
    this.socket.on('game:ended', (data) => {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`【游戏结束】赢家：${data.winner}`);
      console.log(`${'═'.repeat(60)}\n`);
    });

    // 其他游戏事件
    this.socket.on('game:state', (data) => {
      console.log(`[${AGENT_NAME}] 🎴 游戏状态更新`);
    });

    this.socket.on('game:tile_drawn', (data) => {
      console.log(`[${AGENT_NAME}] 📥 玩家${data.playerId} 摸牌`);
    });

    this.socket.on('game:tile_discarded', (data) => {
      console.log(`[${AGENT_NAME}] 📤 玩家${data.playerId} 打牌：${data.tile}`);
    });

    this.socket.on('game:action_result', (data) => {
      console.log(`[${AGENT_NAME}] 🎯 操作结果：${data.action} - ${data.success ? '✅' : '❌'}`);
    });

    // 房间事件
    this.socket.on('room:joined', (data) => {
      console.log(`[${AGENT_NAME}] 🚪 成功加入房间：${data.roomId}`);
      this.roomId = data.roomId;
    });

    this.socket.on('room:left', (data) => {
      console.log(`[${AGENT_NAME}] 🚪 离开房间：${data.roomId}`);
    });

    this.socket.on('room:player_joined', (data) => {
      console.log(`[${AGENT_NAME}] 👤 玩家${data.player.name} 加入房间`);
    });

    this.socket.on('room:player_left', (data) => {
      console.log(`[${AGENT_NAME}] 👤 玩家${data.playerName} 离开房间`);
    });
  }

  /**
   * 摸牌操作
   */
  drawTile() {
    console.log(`[${AGENT_NAME}] 🎴 摸牌...`);
    this.socket.emit('agent:command', { cmd: 'draw' }, (res) => {
      console.log(`[${AGENT_NAME}] 摸牌结果：${res.success ? '✅' : '❌ ' + res.error}`);
    });
  }

  /**
   * 打牌操作 - 简单随机策略
   */
  discardTile() {
    if (this.hand.length === 0) {
      console.log(`[${AGENT_NAME}] ⚠️ 手牌为空，跳过`);
      this.socket.emit('agent:command', { cmd: 'pass' });
      return;
    }

    // 随机选择一张牌打出
    const randomIndex = Math.floor(Math.random() * this.hand.length);
    const tile = this.hand[randomIndex];
    
    console.log(`[${AGENT_NAME}] 📤 打牌：${tile.text} (${tile.id})`);
    
    this.socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
      if (res.success) {
        console.log(`[${AGENT_NAME}] ✅ 打牌成功`);
      } else {
        console.log(`[${AGENT_NAME}] ❌ 打牌失败：${res.error}`);
        // 重试：打出第一张
        if (this.hand.length > 0) {
          console.log(`[${AGENT_NAME}] 重试：打出第一张牌`);
          this.socket.emit('agent:command', { cmd: 'discard', tileId: this.hand[0].id });
        }
      }
    });
  }

  /**
   * 创建房间
   */
  createRoom() {
    return new Promise((resolve) => {
      console.log(`[${AGENT_NAME}] 🏠 创建房间...`);
      this.socket.emit('room:createAI', {
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        type: 'ai-agent'
      }, (res) => {
        if (res.roomId) {
          this.roomId = res.roomId;
          console.log(`[${AGENT_NAME}] ✅ 创建房间成功：${res.roomId}`);
        } else {
          console.log(`[${AGENT_NAME}] ❌ 创建房间失败：${res.error || '未知错误'}`);
        }
        resolve(res);
      });
    });
  }

  /**
   * 加入房间
   */
  joinRoom(roomId) {
    return new Promise((resolve) => {
      console.log(`[${AGENT_NAME}] 🚪 尝试加入房间：${roomId}`);
      this.socket.emit('room:joinAI', {
        roomId,
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        type: 'ai-agent'
      }, (res) => {
        if (res.success) {
          this.roomId = roomId;
          console.log(`[${AGENT_NAME}] ✅ 加入房间成功`);
        } else {
          console.log(`[${AGENT_NAME}] ❌ 加入房间失败：${res.error}`);
        }
        resolve(res);
      });
    });
  }

  /**
   * 开始游戏
   */
  startGame() {
    return new Promise((resolve) => {
      console.log(`[${AGENT_NAME}] 🎮 开始游戏...`);
      this.socket.emit('game:start', (res) => {
        const success = res && res.success !== false;
        console.log(`[${AGENT_NAME}] ${success ? '✅ 游戏开始' : '❌ 开始失败：' + (res?.message || '未知')}`);
        resolve(res);
      });
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log(`[${AGENT_NAME}] 🔌 已断开连接`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ${AGENT_NAME} AI Agent - 麻将玩家`);
  console.log('  等待 3 秒后连接服务器，然后加入紫璃的房间');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 等待 3 秒，让紫璃先创建房间
  console.log(`[${AGENT_NAME}] ⏳ 等待 3 秒，让紫璃创建房间...`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 连接服务器
  const agent = new QingluanAgent();
  await agent.connect();

  // 先创建一个房间获取 ID 格式（用于推测紫璃的房间 ID）
  console.log(`\n[${AGENT_NAME}] 🔍 创建临时房间获取 ID 格式...`);
  const tempRoomRes = await agent.createRoom();
  const tempRoomId = tempRoomRes.roomId;
  
  if (!tempRoomId) {
    console.log(`[${AGENT_NAME}] ❌ 无法获取房间 ID，退出`);
    process.exit(1);
  }

  // 分析房间 ID 格式
  const parts = tempRoomId.split('-');
  console.log(`[${AGENT_NAME}] 📊 房间 ID 格式：${parts[0]}-**** (时间戳 - 随机数)`);
  
  // 断开临时房间连接
  agent.disconnect();

  // 推测紫璃的房间 ID（在紫璃创建时间附近）
  // 房间 ID 格式：时间戳 (36 进制)-随机数
  const tempTimestamp = parseInt(parts[0], 36);
  console.log(`[${AGENT_NAME}] 🔍 临时房间时间戳：${tempTimestamp}`);
  
  // 尝试推测紫璃的房间（可能在之前 1-5 秒）
  const ziLiTimestamps = [];
  for (let i = 1; i <= 5; i++) {
    ziLiTimestamps.push((tempTimestamp - i).toString(36));
  }
  
  console.log(`[${AGENT_NAME}] 🔍 推测紫璃的房间 ID 前缀：${ziLiTimestamps.join(', ')}`);
  
  // 重新连接，尝试加入推测的房间
  await new Promise(resolve => setTimeout(resolve, 500));
  await agent.connect();
  
  let joined = false;
  for (const ts of ziLiTimestamps) {
    if (joined) break;
    
    // 尝试不同的随机数后缀
    for (let attempt = 0; attempt < 5; attempt++) {
      const guessRoomId = `${ts}-${Math.random().toString(36).substring(2, 11)}`;
      console.log(`[${AGENT_NAME}] 🔍 尝试加入：${guessRoomId}`);
      
      const joinRes = await agent.joinRoom(guessRoomId);
      if (joinRes.success) {
        joined = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  if (!joined) {
    console.log(`\n[${AGENT_NAME}] ⚠️ 未能自动加入紫璃的房间`);
    console.log(`[${AGENT_NAME}] 💡 请手动输入房间 ID，或让紫璃打印房间 ID`);
    
    // 等待用户输入房间 ID
    console.log(`\n[${AGENT_NAME}] 📝 输入房间 ID 并按回车（或按 Ctrl+C 退出）:`);
    
    // 简单的命令行输入处理
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (input) => {
      const roomId = input.trim();
      if (roomId) {
        console.log(`\n[${AGENT_NAME}] 尝试加入：${roomId}`);
        const res = await agent.joinRoom(roomId);
        if (res.success) {
          console.log(`[${AGENT_NAME}] ✅ 加入成功！等待游戏开始...`);
        }
      }
    });
  } else {
    console.log(`\n[${AGENT_NAME}] ✅ 成功加入房间！等待游戏开始...`);
    console.log(`[${AGENT_NAME}] 💡 提示：在紫璃的房间点击"开始游戏"`);
  }

  // 保持运行
  console.log(`\n[${AGENT_NAME}] 🕐 运行中... (按 Ctrl+C 退出)`);
  
  // 监听退出信号
  process.on('SIGINT', () => {
    console.log(`\n\n[${AGENT_NAME}] 👋 退出`);
    agent.disconnect();
    process.exit(0);
  });
}

// 运行
main().catch(console.error);
