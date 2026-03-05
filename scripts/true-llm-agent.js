/**
 * 真正的 LLM Agent 参与麻将游戏
 * 
 * 工作流程：
 * 1. Agent 连接游戏服务器
 * 2. 收到游戏状态后写入 pending-state.json
 * 3. 等待 decision.json 被写入
 * 4. 执行决策
 * 
 * 外部 LLM Agent 需要：
 * 1. 监控 pending-state.json
 * 2. 分析游戏状态
 * 3. 写入决策到 decision.json
 */
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const STATE_FILE = path.join(__dirname, 'pending-state.json');
const DECISION_FILE = path.join(__dirname, 'decision.json');

class TrueLLMAgent {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.socket = null;
    this.hand = [];
    this.roomId = null;
    this.waitingForDecision = false;
    this.decisionTimeout = null;
  }

  connect() {
    this.socket = io(SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] ✅ 连接成功`);
    });

    this.socket.on('agent:your_turn', async (data) => {
      this.hand = data.hand || [];
      
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`【${this.name}】轮次: ${data.phase}`);
      console.log(`${'═'.repeat(60)}`);
      
      if (data.prompt) {
        console.log('\n' + data.prompt + '\n');
      }
      
      // 写入状态文件，等待外部 LLM 决策
      const state = {
        agentId: this.id,
        agentName: this.name,
        timestamp: Date.now(),
        phase: data.phase,
        hand: data.hand,
        gameState: data.gameState,
        prompt: data.prompt
      };
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      console.log(`📤 [${this.name}] 状态已写入 pending-state.json，等待 LLM 决策...`);
      
      // 等待外部 LLM 写入决策
      const decision = await this.waitForDecision();
      console.log(`📥 [${this.name}] 收到决策: ${JSON.stringify(decision)}`);
      
      // 执行决策
      this.executeDecision(decision, data);
    });

    this.socket.on('game:actions', async (data) => {
      const actions = data.actions || [];
      console.log(`\n[${this.name}] 可用操作: ${actions.map(a => a.action).join(',')}`);
      
      // 写入状态
      const state = {
        agentId: this.id,
        agentName: this.name,
        timestamp: Date.now(),
        phase: 'action',
        actions: actions,
        lastDiscard: data.lastDiscard,
        hand: this.hand
      };
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      console.log(`📤 [${this.name}] 操作状态已写入，等待 LLM 决策...`);
      
      const decision = await this.waitForDecision();
      console.log(`📥 [${this.name}] 操作决策: ${JSON.stringify(decision)}`);
      
      this.executeActionDecision(decision);
    });

    this.socket.on('game:ended', (data) => {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`【游戏结束】赢家: ${data.winner}`);
      console.log(`${'═'.repeat(60)}\n`);
      
      // 清理状态文件
      try {
        fs.unlinkSync(STATE_FILE);
        fs.unlinkSync(DECISION_FILE);
      } catch (e) {}
    });
  }

  /**
   * 等待外部 LLM 写入决策
   * 超时后使用默认策略
   */
  async waitForDecision() {
    return new Promise((resolve) => {
      // 清理旧决策文件
      try { fs.unlinkSync(DECISION_FILE); } catch (e) {}
      
      // 检查决策文件的间隔
      const checkInterval = setInterval(() => {
        try {
          if (fs.existsSync(DECISION_FILE)) {
            const content = fs.readFileSync(DECISION_FILE, 'utf-8');
            const decision = JSON.parse(content);
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve(decision);
          }
        } catch (e) {
          // 文件可能正在写入
        }
      }, 500);
      
      // 30 秒超时，使用默认策略
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        console.log(`⏰ [${this.name}] 等待超时，使用默认策略`);
        resolve(this.defaultStrategy());
      }, 30000);
    });
  }

  /**
   * 默认策略（当 LLM 没有响应时）
   */
  defaultStrategy() {
    if (this.hand.length > 0) {
      return { cmd: 'discard', tileId: this.hand[0].id };
    }
    return { cmd: 'pass' };
  }

  executeDecision(decision, data) {
    if (decision.cmd === 'draw') {
      this.socket.emit('agent:command', { cmd: 'draw' }, (res) => {
        console.log(`[${this.name}] 摸牌: ${res.success ? '✅ 成功' : '❌ ' + res.error}`);
      });
    } else if (decision.cmd === 'discard') {
      this.socket.emit('agent:command', { cmd: 'discard', tileId: decision.tileId }, (res) => {
        if (!res.success) {
          console.log(`[${this.name}] ❌ 打牌失败: ${res.error}`);
          if (this.hand.length > 0) {
            console.log(`[${this.name}] 重试打出第一张...`);
            this.socket.emit('agent:command', { cmd: 'discard', tileId: this.hand[0].id });
          }
        }
      });
    }
  }

  executeActionDecision(decision) {
    this.socket.emit('agent:command', decision, (res) => {
      console.log(`[${this.name}] 操作: ${res.success ? '✅ 成功' : '❌ ' + res.error || '完成'}`);
    });
  }

  createRoom() {
    return new Promise((resolve) => {
      this.socket.emit('room:createAI', {
        agentId: this.id,
        agentName: this.name,
        type: 'ai-agent'
      }, (res) => {
        if (res.roomId) {
          this.roomId = res.roomId;
          console.log(`[${this.name}] 🏠 创建房间: ${res.roomId}`);
        }
        resolve(res);
      });
    });
  }

  joinRoom(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('room:joinAI', {
        roomId,
        agentId: this.id,
        agentName: this.name,
        type: 'ai-agent'
      }, (res) => {
        console.log(`[${this.name}] 🚪 加入房间: ${res.success ? '✅ 成功' : '❌ ' + res.error}`);
        this.roomId = roomId;
        resolve(res);
      });
    });
  }

  startGame() {
    return new Promise((resolve) => {
      this.socket.emit('game:start', (res) => {
        const success = res && res.success !== false;
        console.log(`[${this.name}] 🎮 开始游戏: ${success ? '✅' : '❌ ' + (res?.message || '未知')}`);
        resolve(res);
      });
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  真正的 LLM Agent 麻将游戏');
  console.log('  状态文件: scripts/pending-state.json');
  console.log('  决策文件: scripts/decision.json');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 只启动一个 Agent，方便测试
  const agent = new TrueLLMAgent('llm-main', '紫璃');

  agent.connect();
  await new Promise(r => setTimeout(r, 1500));

  const createRes = await agent.createRoom();
  if (!createRes.roomId) {
    console.log('创建房间失败:', createRes);
    return;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Agent 已就绪，等待游戏状态...');
  console.log('  LLM Agent 需要监控 pending-state.json 并写入 decision.json');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 添加 3 个简单 Agent 来凑局
  const { io } = require('socket.io-client');
  for (let i = 1; i <= 3; i++) {
    const socket = io(SERVER_URL);
    socket.on('connect', () => {
      console.log(`[NPC-${i}] 连接成功`);
    });
    
    // 简单 NPC 逻辑
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
    
    setTimeout(() => {
      socket.emit('room:joinAI', {
        roomId: createRes.roomId,
        agentId: `npc-${i}`,
        agentName: `NPC-${i}`,
        type: 'ai-auto'
      });
    }, 500 * i);
  }

  await new Promise(r => setTimeout(r, 3000));
  await agent.startGame();

  // 运行 5 分钟
  await new Promise(r => setTimeout(r, 300000));

  console.log('\n测试结束');
  process.exit(0);
}

main().catch(console.error);
