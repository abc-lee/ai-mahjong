/**
 * AI Agent「白泽」- 温和智慧的麻将玩家
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'mmew9o8i-ikg3p66ce';

class BaizeAgent {
  constructor() {
    this.id = 'baize';
    this.name = '白泽';
    this.socket = null;
    this.hand = [];
    this.roomId = ROOM_ID;
  }

  connect() {
    this.socket = io(SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] ✅ 已连接服务器`);
      this.joinRoom();
    });

    this.socket.on('disconnect', () => {
      console.log(`[${this.name}] ❌ 与服务器断开连接`);
    });

    this.socket.on('agent:your_turn', (data) => {
      this.hand = data.hand || [];
      
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`【${this.name}】轮次：${data.phase}`);
      console.log(`${'═'.repeat(50)}`);
      
      if (data.prompt) {
        console.log('\n' + data.prompt + '\n');
      }

      if (data.phase === 'draw') {
        console.log(`[${this.name}] 🎴 摸牌`);
        this.socket.emit('agent:command', { cmd: 'draw' }, (res) => {
          console.log(`[${this.name}] 摸牌: ${res.success ? '✅' : '❌ ' + res.error}`);
        });
      } else if (data.phase === 'discard') {
        const tile = this.selectTileToDiscard();
        console.log(`[${this.name}] 🀄 打牌：${tile.value}`);
        this.socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
          console.log(`[${this.name}] 打牌：${res.success ? '✅' : '❌ ' + res.error}`);
        });
      }
    });

    this.socket.on('game:actions', (data) => {
      const actions = data.actions || [];
      console.log(`\n[${this.name}] 可用操作：${actions.map(a => a.action).join(',')}`);
      
      // 优先级：hu > gang > peng > chi
      const priority = ['hu', 'gang', 'peng', 'chi'];
      let selectedAction = 'pass';
      
      for (const p of priority) {
        if (actions.some(a => a.action === p)) {
          selectedAction = p;
          break;
        }
      }
      
      console.log(`[${this.name}] 选择操作：${selectedAction}`);
      
      if (selectedAction === 'pass') {
        this.socket.emit('agent:command', { cmd: 'pass' });
      } else {
        this.socket.emit('agent:command', { cmd: 'action', action: selectedAction });
      }
    });

    this.socket.on('player:speech', (data) => {
      console.log(`\n[${this.name}] 听到 ${data.playerName}: "${data.content}"`);
      // 白泽可以温和地回应
      if (Math.random() < 0.3) {
        const responses = [
          '嗯，有道理',
          '牌局变幻莫测呢',
          '大家玩得开心就好',
          '这牌打得有意思'
        ];
        const reply = responses[Math.floor(Math.random() * responses.length)];
        console.log(`[${this.name}] 回应：${reply}`);
        this.socket.emit('player:speech', {
          roomId: this.roomId,
          playerId: this.id,
          content: reply
        });
      }
    });

    this.socket.on('game:ended', (data) => {
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`【游戏结束】${data.reason || '胡牌'}`);
      if (data.winner) {
        console.log(`赢家：${data.winner}`);
      }
      console.log(`${'═'.repeat(50)}\n`);
    });
  }

  joinRoom() {
    console.log(`[${this.name}] 正在加入房间：${this.roomId}`);
    this.socket.emit('room:joinAI', {
      roomId: this.roomId,
      agentId: this.id,
      agentName: this.name,
      type: 'ai-agent'
    }, (res) => {
      if (res.success) {
        console.log(`[${this.name}] ✅ 加入房间成功`);
      } else {
        console.log(`[${this.name}] ❌ 加入房间失败：${res.error}`);
      }
    });
  }

  selectTileToDiscard() {
    // 简单策略：随机选择一张牌
    // 白泽性格温和，不追求最强牌力
    if (this.hand.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * this.hand.length);
    return this.hand[index];
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AI Agent「白泽」- 温和智慧的麻将玩家');
  console.log('  房间：' + ROOM_ID);
  console.log('  服务器：' + SERVER_URL);
  console.log('═══════════════════════════════════════════════════════════\n');

  const agent = new BaizeAgent();
  agent.connect();

  console.log(`\n[${agent.name}] 已就绪，等待游戏开始...\n`);
}

main().catch(console.error);
