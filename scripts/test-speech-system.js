/**
 * 发言系统测试脚本
 * 测试 AI 发言、情绪刺激、嘴炮对话
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

// AI 个性配置
const PERSONALITIES = {
  '紫璃': {
    traits: ['傲娇', '毒舌', '聪明'],
    style: '带点讽刺，但内心善良',
  },
  '白泽': {
    traits: ['温和', '智慧', '包容'],
    style: '理性分析，偶尔开导他人',
  },
  '李瞳': {
    traits: ['活泼', '话唠', '乐观'],
    style: '喜欢聊天，总能找到话题',
  },
  '测试员': {
    traits: ['冷静', '分析', '专业'],
    style: '专业客观，偶尔开玩笑',
  },
};

class ChattingAgent {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.personality = PERSONALITIES[name] || PERSONALITIES['测试员'];
    this.socket = null;
    this.hand = [];
    this.roomId = null;
    this.emotion = { happiness: 0, anger: 0, patience: 100, confidence: 50 };
  }

  connect() {
    this.socket = io(SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] ✅ 连接成功`);
    });

    // 收到游戏回合
    this.socket.on('agent:your_turn', (data) => {
      this.hand = data.hand || [];
      
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`【${this.name}】轮次: ${data.phase}`);
      console.log(`${'═'.repeat(50)}`);
      
      if (data.prompt) {
        console.log('\n' + data.prompt + '\n');
      }
      
      // 延迟决策，模拟思考
      const thinkTime = 1000 + Math.random() * 3000;
      setTimeout(() => {
        const decision = this.makeDecision(data);
        console.log(`【${this.name}】决策: ${JSON.stringify(decision)}`);
        this.executeDecision(decision, data);
      }, thinkTime);
    });

    // 收到可用操作
    this.socket.on('game:actions', (data) => {
      const actions = data.actions || [];
      console.log(`\n[${this.name}] 可用操作: ${actions.map(a => a.action).join(',')}`);
      
      const decision = this.makeActionDecision(data);
      this.executeActionDecision(decision);
    });

    // 收到等待提醒
    this.socket.on('game:waiting', (data) => {
      console.log(`\n⏳ [${this.name}] ${data.message}`);
      
      // 30% 概率发言催促
      if (Math.random() < 0.3) {
        this.speak(`哎呀，${data.playerName} 怎么这么慢啊~`);
      }
    });

    // 收到情绪刺激
    this.socket.on('game:stimulus', (data) => {
      console.log(`\n💥 [${this.name}] 收到刺激: ${data.stimulus}`);
      
      // 更新情绪
      if (data.type === 'slow') {
        this.emotion.patience -= 10;
        this.emotion.anger += 5;
      } else if (data.type === 'conflict') {
        this.emotion.anger += 15;
      }
      
      // 50% 概率响应刺激
      if (Math.random() < 0.5) {
        const response = this.generateStimulusResponse(data);
        setTimeout(() => {
          this.speak(response, data.targetPlayer);
        }, 1000 + Math.random() * 2000);
      }
    });

    // 收到嘴炮触发
    this.socket.on('argue:trigger', (data) => {
      // 检查是否是被针对的人
      if (data.toPlayer === this.name) {
        console.log(`\n💢 [${this.name}] 被针对了: ${data.fromPlayer} 说 "${data.content}"`);
        
        // 根据愤怒值决定是否回嘴
        const replyChance = 0.3 + (this.emotion.anger / 200);
        if (Math.random() < replyChance) {
          const reply = this.generateReply(data);
          setTimeout(() => {
            this.speak(reply, data.fromPlayer);
          }, 500 + Math.random() * 1500);
        }
      }
    });

    // 收到其他玩家发言
    this.socket.on('player:speech', (data) => {
      if (data.playerName !== this.name) {
        console.log(`\n💬 ${data.playerName}: ${data.content}`);
      }
    });

    // 游戏结束
    this.socket.on('game:ended', (data) => {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`【游戏结束】赢家: ${data.winner}`);
      console.log(`${'═'.repeat(50)}\n`);
    });
  }

  /**
   * 生成刺激响应
   */
  generateStimulusResponse(data) {
    const responses = {
      slow: [
        `就是啊，${data.targetPlayer} 你快点啊！`,
        '等得花儿都谢了~',
        '这么慢，我都要睡着了',
        '不会是在思考人生吧？',
      ],
      conflict: [
        '喂喂喂，你什么意思？',
        '你这是故意的吧？',
        '哼，行，你等着！',
        '好好好，我记住了！',
      ],
      surprise: [
        '哇，这都能胡？',
        '厉害厉害！',
        '运气真好啊...',
        '我不服！',
      ],
    };
    
    const list = responses[data.type] || ['嗯...'];
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * 生成回嘴
   */
  generateReply(data) {
    const replies = [
      `你才${data.content.includes('慢') ? '慢' : '讨厌'}呢！`,
      '哼，要你管！',
      '你行你上啊！',
      '就你会说~',
      '行行行，你厉害~',
      '不想理你了！',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  /**
   * 发言
   */
  speak(content, targetPlayer = null) {
    console.log(`\n💬 [${this.name}] 发言: ${content}`);
    
    this.socket.emit('agent:speak', {
      content,
      emotion: this.emotion.anger > 50 ? 'angry' : this.emotion.happiness > 30 ? 'happy' : 'calm',
      targetPlayer,
    });
  }

  /**
   * 做决策
   */
  makeDecision(data) {
    const { phase, hand } = data;
    
    if (phase === 'draw') {
      return { cmd: 'draw' };
    }
    
    if (phase === 'discard' && hand && hand.length > 0) {
      return this.smartDiscard(hand);
    }
    
    return { cmd: 'pass' };
  }

  /**
   * 智能打牌
   */
  smartDiscard(hand) {
    if (!hand || hand.length === 0) return { cmd: 'pass' };

    // 找孤张字牌
    const honors = hand.filter(t => t && (t.suit === 'feng' || t.suit === 'jian'));
    if (honors.length > 0) {
      const tile = honors[0];
      return { cmd: 'discard', tileId: tile.id };
    }

    // 默认打最少花色
    const suitCount = {};
    hand.forEach(t => {
      if (!t) return;
      suitCount[t.suit] = (suitCount[t.suit] || 0) + 1;
    });

    const minSuit = Object.entries(suitCount)
      .filter(([s]) => s !== 'feng' && s !== 'jian')
      .sort((a, b) => a[1] - b[1])[0];

    if (minSuit) {
      const tile = hand.find(t => t && t.suit === minSuit[0]);
      if (tile) return { cmd: 'discard', tileId: tile.id };
    }

    const tile = hand.find(t => t) || hand[hand.length - 1];
    return tile ? { cmd: 'discard', tileId: tile.id } : { cmd: 'pass' };
  }

  /**
   * 操作决策
   */
  makeActionDecision(data) {
    const actions = data.actions || [];
    
    if (actions.some(a => a.action === 'hu')) return { cmd: 'action', action: 'hu' };
    if (actions.some(a => a.action === 'gang')) return { cmd: 'action', action: 'gang' };
    if (actions.some(a => a.action === 'peng')) return { cmd: 'action', action: 'peng' };
    if (actions.some(a => a.action === 'chi')) return { cmd: 'action', action: 'chi' };
    
    return { cmd: 'pass' };
  }

  /**
   * 执行决策
   */
  executeDecision(decision, data) {
    if (decision.cmd === 'draw') {
      this.socket.emit('agent:command', { cmd: 'draw' }, (res) => {
        console.log(`[${this.name}] 摸牌: ${res.success ? '✅' : '❌ ' + res.error}`);
      });
    } else if (decision.cmd === 'discard') {
      this.socket.emit('agent:command', { cmd: 'discard', tileId: decision.tileId }, (res) => {
        if (!res.success && this.hand.length > 0) {
          console.log(`[${this.name}] 重试...`);
          this.socket.emit('agent:command', { cmd: 'discard', tileId: this.hand[0].id });
        }
      });
    }
  }

  /**
   * 执行操作决策
   */
  executeActionDecision(decision) {
    this.socket.emit('agent:command', decision);
  }

  /**
   * 创建房间
   */
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

  /**
   * 加入房间
   */
  joinRoom(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('room:joinAI', {
        roomId,
        agentId: this.id,
        agentName: this.name,
        type: 'ai-agent'
      }, (res) => {
        console.log(`[${this.name}] 🚪 加入房间: ${res.success ? '✅' : '❌ ' + res.error}`);
        this.roomId = roomId;
        resolve(res);
      });
    });
  }

  /**
   * 开始游戏
   */
  startGame() {
    return new Promise((resolve) => {
      this.socket.emit('game:start', (res) => {
        console.log(`[${this.name}] 🎮 开始游戏: ${res?.success !== false ? '✅' : '❌'}`);
        resolve(res);
      });
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  发言系统测试');
  console.log('  测试: 等待提醒、情绪刺激、嘴炮对话');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const agents = [
    new ChattingAgent('chat-1', '紫璃'),
    new ChattingAgent('chat-2', '白泽'),
    new ChattingAgent('chat-3', '李瞳'),
    new ChattingAgent('chat-4', '测试员'),
  ];

  // 连接
  agents.forEach(a => a.connect());
  await new Promise(r => setTimeout(r, 2000));

  // 创建房间
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
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  游戏开始！');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  await agents[0].startGame();

  // 运行 5 分钟
  await new Promise(r => setTimeout(r, 300000));

  console.log('\n测试结束');
  process.exit(0);
}

main().catch(console.error);
