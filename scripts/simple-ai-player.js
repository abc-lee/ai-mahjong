/**
 * 简单 AI 玩家 - 直接连接游戏服务器并自动打牌
 * 不需要外部 LLM，自己决策
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

class SimpleAIPlayer {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.socket = null;
    this.hand = [];
    this.roomId = null;
  }

  connect() {
    this.socket = io(SERVER_URL);

    this.socket.on('connect', () => {
      console.log(`[${this.name}] ✅ 连接到服务器`);
      
      // 创建房间
      this.socket.emit('room:createAI', {
        agentId: this.id,
        agentName: this.name,
        type: 'ai-agent'
      }, (res) => {
        if (res.roomId) {
          this.roomId = res.roomId;
          console.log(`\n${'═'.repeat(60)}`);
          console.log(`🏠 房间 ID: ${res.roomId}`);
          console.log(`人类玩家可以加入这个房间`);
          console.log(`${'═'.repeat(60)}\n`);
        } else {
          console.log(`[${this.name}] ❌ 创建房间失败:`, res);
        }
      });
    });

    // 处理回合
    this.socket.on('agent:your_turn', (data) => {
      this.hand = data.hand || [];
      
      console.log(`\n${'─'.repeat(40)}`);
      console.log(`【${this.name}】${data.phase === 'draw' ? '🎴 摸牌阶段' : '🀄 打牌阶段'}`);
      console.log(`${'─'.repeat(40)}`);
      
      if (data.prompt) {
        console.log(data.prompt);
      }
      
      // 简单决策逻辑
      setTimeout(() => {
        if (data.phase === 'draw') {
          console.log(`[${this.name}] 决策：摸牌`);
          this.socket.emit('agent:command', { cmd: 'draw' });
        } else if (data.phase === 'discard') {
          // 随机打出一张牌
          const tileIndex = Math.floor(Math.random() * this.hand.length);
          const tile = this.hand[tileIndex];
          console.log(`[${this.name}] 决策：打出 ${tile.displayName || tile.id}`);
          this.socket.emit('agent:command', { cmd: 'discard', tileId: tile.id });
        }
      }, 1000);
    });

    // 处理吃碰杠胡
    this.socket.on('game:actions', (data) => {
      const actions = data.actions || [];
      console.log(`\n【${this.name}】可用操作：${actions.map(a => a.action).join(', ') || '无'}`);
      
      // 简单策略：有胡就胡，否则过
      setTimeout(() => {
        const huAction = actions.find(a => a.action === 'hu');
        if (huAction) {
          console.log(`[${this.name}] 决策：胡！`);
          this.socket.emit('agent:command', { cmd: 'action', action: 'hu' });
        } else if (actions.length > 0) {
          console.log(`[${this.name}] 决策：过`);
          this.socket.emit('agent:command', { cmd: 'pass' });
        }
      }, 500);
    });

    // 游戏结束
    this.socket.on('game:ended', (data) => {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`【游戏结束】`);
      if (data.winner) {
        console.log(`🏆 赢家：${data.winner}`);
      }
      console.log(`${'═'.repeat(60)}\n`);
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error(`[${this.name}] ❌ 连接错误:`, error.message);
      console.log(`[${this.name}] 5 秒后重试...`);
      setTimeout(() => {
        this.socket.connect();
      }, 5000);
    });

    // 断开连接
    this.socket.on('disconnect', () => {
      console.log(`[${this.name}] ⚠️  断开连接`);
    });
  }
}

// 启动
console.log('═══════════════════════════════════════════════════════════════');
console.log('  简单 AI 玩家 - 自动麻将');
console.log('  服务器：' + SERVER_URL);
console.log('═══════════════════════════════════════════════════════════════\n');

const aiPlayer = new SimpleAIPlayer('simple-ai', '紫璃');
aiPlayer.connect();

// 保持进程运行
console.log('\n✅ AI 玩家已启动，保持连接中...\n');
setInterval(() => {
  // 心跳保持
}, 60000);
