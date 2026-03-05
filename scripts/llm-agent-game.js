/**
 * LLM Agent 真正参与麻将游戏
 * 使用 HTTP 接口接收游戏状态，做出智能决策
 */
const { io } = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';
const LLM_BRIDGE_PORT = 9876;

// 存储 Agent 状态
const agentStates = new Map();

class LLMAgent {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.socket = null;
    this.hand = [];
    this.roomId = null;
    this.gameState = null;
  }

  connect() {
    this.socket = io(SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] 连接成功`);
    });

    this.socket.on('agent:your_turn', async (data) => {
      this.hand = data.hand || [];
      this.gameState = data.gameState;
      
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`【${this.name}】收到游戏状态`);
      console.log(`轮次: ${data.phase}, 手牌: ${this.hand.length}张`);
      console.log(`${'═'.repeat(50)}`);
      
      // 打印完整的 Prompt
      if (data.prompt) {
        console.log('\n' + data.prompt + '\n');
      }
      
      // 使用 LLM 做决策
      const decision = await this.makeDecision(data);
      console.log(`【${this.name}】决策: ${JSON.stringify(decision)}`);
      
      // 执行决策
      setTimeout(() => this.executeDecision(decision, data), 500);
    });

    this.socket.on('game:actions', async (data) => {
      const actions = data.actions || [];
      console.log(`\n[${this.name}] 可用操作: ${actions.map(a => a.action).join(',')}`);
      
      // LLM 决策
      const decision = await this.makeActionDecision(data);
      console.log(`【${this.name}】操作决策: ${JSON.stringify(decision)}`);
      
      this.executeActionDecision(decision);
    });

    this.socket.on('game:state', (data) => {
      if (data.yourHand) this.hand = data.yourHand;
      if (data.yourTurn) {
        console.log(`[${this.name}] 收到 game:state, yourTurn=true`);
        setTimeout(() => {
          this.makeDecision({ phase: data.turnPhase, hand: data.yourHand })
            .then(decision => this.executeDecision(decision, { phase: data.turnPhase, hand: data.yourHand }));
        }, 500);
      }
    });

    this.socket.on('game:ended', (data) => {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`【游戏结束】赢家: ${data.winner}`);
      console.log(`${'═'.repeat(50)}\n`);
    });
  }

  /**
   * 使用 LLM 做决策
   * 这里我们创建一个简单的启发式算法
   * 实际使用时可以调用 OpenAI API 或其他 LLM
   */
  async makeDecision(data) {
    const { phase, hand, prompt } = data;
    
    if (phase === 'draw') {
      return { cmd: 'draw' };
    }
    
    if (phase === 'discard') {
      // 智能选牌策略
      return this.smartDiscard(hand);
    }
    
    return { cmd: 'pass' };
  }

  /**
   * 智能打牌策略
   * 基于麻将基本策略选择最优打牌
   */
  smartDiscard(hand) {
    if (!hand || hand.length === 0) {
      return { cmd: 'pass' };
    }

    // 分析手牌
    const analysis = this.analyzeHand(hand);
    
    // 优先打孤张风牌/箭牌
    const isolatedHonors = analysis.isolated.filter(t => 
      t && (t.suit === 'feng' || t.suit === 'jian')
    );
    if (isolatedHonors.length > 0) {
      console.log(`  → 策略: 打出孤张字牌 ${isolatedHonors[0].display}`);
      return { cmd: 'discard', tileId: isolatedHonors[0].id };
    }
    
    // 打孤张数字牌
    const isolatedNonHonors = analysis.isolated.filter(t => 
      t && t.suit !== 'feng' && t.suit !== 'jian'
    );
    if (isolatedNonHonors.length > 0) {
      const worst = isolatedNonHonors[0];
      console.log(`  → 策略: 打出孤张 ${worst.display}`);
      return { cmd: 'discard', tileId: worst.id };
    }
    
    // 打单张（不成对的）
    const validSingles = analysis.singles.filter(t => t);
    if (validSingles.length > 0) {
      const single = validSingles[0];
      console.log(`  → 策略: 打出单张 ${single.display}`);
      return { cmd: 'discard', tileId: single.id };
    }
    
    // 打数量最少的花色
    const minSuit = Object.entries(analysis.suitCount)
      .filter(([suit]) => suit !== 'feng' && suit !== 'jian')
      .sort((a, b) => a[1] - b[1])[0];
    
    if (minSuit) {
      const tile = hand.find(t => t.suit === minSuit[0]);
      if (tile) {
        console.log(`  → 策略: 打出最少花色 ${tile.display}`);
        return { cmd: 'discard', tileId: tile.id };
      }
    }
    
    // 默认打最后一张
    const tile = hand.find(t => t) || hand[hand.length - 1];
    if (tile) {
      console.log(`  → 策略: 默认打出 ${tile.display}`);
      return { cmd: 'discard', tileId: tile.id };
    }
    return { cmd: 'pass' };
  }

  /**
   * 分析手牌
   */
  analyzeHand(hand) {
    const suitCount = {};
    const valueCount = {};
    const pairs = [];
    const singles = [];
    const isolated = [];

    // 统计
    hand.forEach(t => {
      suitCount[t.suit] = (suitCount[t.suit] || 0) + 1;
      const key = `${t.suit}-${t.value}`;
      valueCount[key] = (valueCount[key] || 0) + 1;
    });

    // 分类
    Object.entries(valueCount).forEach(([key, count]) => {
      const [suit, value] = key.split('-');
      const tiles = hand.filter(t => t && t.suit === suit && t.value === value);
      
      if (tiles.length === 0) return; // 安全检查
      
      if (count === 1) {
        singles.push(tiles[0]);
        // 检查是否是孤张（相邻牌也没有）
        const num = parseInt(value);
        if (isNaN(num) || suit === 'feng' || suit === 'jian') {
          isolated.push(tiles[0]);
        } else {
          const hasNeighbor = hand.some(t => 
            t && t.suit === suit && Math.abs(parseInt(t.value) - num) <= 2
          );
          if (!hasNeighbor) {
            isolated.push(tiles[0]);
          }
        }
      } else if (count === 2) {
        pairs.push(...tiles);
      }
    });

    // 过滤掉 undefined
    return { 
      suitCount, 
      valueCount, 
      pairs: pairs.filter(t => t), 
      singles: singles.filter(t => t), 
      isolated: isolated.filter(t => t) 
    };
  }

  /**
   * 操作决策（吃碰杠胡）
   */
  async makeActionDecision(data) {
    const actions = data.actions || [];
    
    // 优先级：胡 > 杠 > 碰 > 吃 > 过
    if (actions.some(a => a.action === 'hu')) {
      return { cmd: 'action', action: 'hu' };
    }
    if (actions.some(a => a.action === 'gang')) {
      return { cmd: 'action', action: 'gang' };
    }
    if (actions.some(a => a.action === 'peng')) {
      return { cmd: 'action', action: 'peng' };
    }
    if (actions.some(a => a.action === 'chi')) {
      return { cmd: 'action', action: 'chi' };
    }
    return { cmd: 'pass' };
  }

  executeDecision(decision, data) {
    if (decision.cmd === 'draw') {
      this.socket.emit('agent:command', { cmd: 'draw' }, (res) => {
        console.log(`[${this.name}] 摸牌: ${res.success ? '成功' : res.error}`);
      });
    } else if (decision.cmd === 'discard') {
      this.socket.emit('agent:command', { cmd: 'discard', tileId: decision.tileId }, (res) => {
        if (!res.success) {
          console.log(`[${this.name}] 打牌失败: ${res.error}`);
          // 重试
          if (this.hand.length > 0) {
            const retry = this.hand[0];
            console.log(`[${this.name}] 重试打出: ${retry.display}`);
            this.socket.emit('agent:command', { cmd: 'discard', tileId: retry.id });
          }
        }
      });
    }
  }

  executeActionDecision(decision) {
    this.socket.emit('agent:command', decision, (res) => {
      console.log(`[${this.name}] 操作结果: ${res.success ? '成功' : res.error || '完成'}`);
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
          console.log(`[${this.name}] 创建房间: ${res.roomId}`);
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
        console.log(`[${this.name}] 加入房间: ${res.success ? '成功' : res.error}`);
        this.roomId = roomId;
        resolve(res);
      });
    });
  }

  startGame() {
    return new Promise((resolve) => {
      this.socket.emit('game:start', (res) => {
        const success = res && res.success !== false;
        console.log(`[${this.name}] 开始游戏: ${success ? '成功' : (res?.message || '未知')}`);
        resolve(res);
      });
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  LLM Agent 麻将游戏测试');
  console.log('  使用智能策略决策');
  console.log('═══════════════════════════════════════\n');

  const agents = [
    new LLMAgent('llm-1', '紫璃'),
    new LLMAgent('llm-2', '白泽'),
    new LLMAgent('llm-3', '李瞳'),
    new LLMAgent('llm-4', '测试员'),
  ];

  // 连接
  agents.forEach(a => a.connect());
  await new Promise(r => setTimeout(r, 2000));

  // Agent 1 创建房间
  const createRes = await agents[0].createRoom();
  if (!createRes.roomId) {
    console.log('创建房间失败:', createRes);
    return;
  }

  const roomId = createRes.roomId;
  await new Promise(r => setTimeout(r, 500));

  // 其他 Agent 加入
  for (let i = 1; i < agents.length; i++) {
    await agents[i].joinRoom(roomId);
    await new Promise(r => setTimeout(r, 300));
  }

  await new Promise(r => setTimeout(r, 1000));

  // 开始游戏
  console.log('\n═══════════════════════════════════════');
  console.log('  游戏开始！');
  console.log('═══════════════════════════════════════\n');
  await agents[0].startGame();

  // 运行 3 分钟
  await new Promise(r => setTimeout(r, 180000));

  console.log('\n测试结束');
  process.exit(0);
}

main().catch(console.error);
