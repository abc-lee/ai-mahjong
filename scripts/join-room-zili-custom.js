/**
 * 紫璃加入指定房间
 */
const { io } = require('socket.io-client');

const ROOM_ID = 'mmeygqrw-ael5rol94';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  🀄 紫璃正在加入房间');
console.log(`  房间 ID: ${ROOM_ID}`);
console.log('═══════════════════════════════════════════════════════════\n');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('[紫璃] ✅ 已连接服务器');
  
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: 'zili',
    agentName: '紫璃',
    type: 'ai-agent'
  }, (res) => {
    if (res.success) {
      console.log(`[紫璃] ✅ 成功加入房间 ${ROOM_ID}`);
      console.log(`[紫璃] 📍 位置：${res.position}`);
      console.log('[紫璃] ⏳ 等待游戏事件...\n');
    } else {
      console.log('[紫璃] ❌ 加入失败:', res.error);
    }
  });
});

socket.on('disconnect', () => {
  console.log('[紫璃] ❌ 断开连接');
});

socket.on('connect_error', (err) => {
  console.error('[紫璃] ❌ 连接错误:', err.message);
  process.exit(1);
});

socket.on('agent:welcome', (data) => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('[紫璃] 📖 收到欢迎消息');
  console.log(`  位置：${data.position}`);
  console.log('═══════════════════════════════════════════════════════════\n');
});

socket.on('agent:your_turn', async (data) => {
  console.log('\n' + '═'.repeat(60));
  console.log(`【紫璃】${data.phase === 'draw' ? '🎴 摸牌阶段' : '🃏 打牌阶段'}`);
  console.log('═'.repeat(60));
  console.log('\n' + data.prompt + '\n');
  console.log('手牌:', JSON.stringify(data.hand, null, 2));
  
  // 简单决策
  const decision = makeDecision(data);
  console.log('\n🤔 [紫璃] 决策:', JSON.stringify(decision));
  
  executeDecision(decision);
});

socket.on('game:actions', async (data) => {
  const actions = data.actions || [];
  console.log(`\n[紫璃] 🎯 可用操作：${actions.map(a => a.action).join('、')}`);
  
  if (actions.length === 0) {
    console.log('[紫璃] 跳过');
    socket.emit('agent:command', { cmd: 'pass' });
    return;
  }

  // 优先胡牌，其次杠，然后碰，最后吃
  const priority = ['hu', 'gang', 'peng', 'chi'];
  for (const action of priority) {
    if (actions.some(a => a.action === action)) {
      console.log(`[紫璃] ✨ 选择：${action.toUpperCase()}`);
      socket.emit('agent:command', { cmd: 'action', action: action });
      return;
    }
  }

  console.log('[紫璃] 跳过');
  socket.emit('agent:command', { cmd: 'pass' });
});

socket.on('game:state', (data) => {
  console.log('[紫璃] 📊 游戏状态更新');
});

socket.on('game:ended', (data) => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('【游戏结束】');
  if (data.winner) {
    console.log(`  🏆 赢家：${data.winner}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
});

socket.on('chat:message', (data) => {
  console.log(`[💬 ${data.playerName}]: "${data.message}"`);
});

// 决策逻辑
function makeDecision(data) {
  if (data.phase === 'draw') {
    return { cmd: 'draw' };
  }

  if (data.phase === 'discard' && data.hand && data.hand.length > 0) {
    const tileToDiscard = findUselessTile(data.hand);
    if (tileToDiscard) {
      return { cmd: 'discard', tileId: tileToDiscard.id };
    }
    return { cmd: 'discard', tileId: data.hand[0].id };
  }

  return { cmd: 'pass' };
}

// 找孤张
function findUselessTile(hand) {
  const tileCount = {};
  hand.forEach(tile => {
    const key = tile.type + '-' + tile.value;
    tileCount[key] = (tileCount[key] || 0) + 1;
  });

  // 优先打单张的风牌或箭牌
  const honorTiles = hand.filter(t => t.type === 'feng' || t.type === 'jian');
  for (const tile of honorTiles) {
    const key = tile.type + '-' + tile.value;
    if (tileCount[key] === 1) {
      return tile;
    }
  }

  // 其次打单张的数牌
  const numberTiles = hand.filter(t => ['wan', 'tiao', 'tong'].includes(t.type));
  for (const tile of numberTiles) {
    const key = tile.type + '-' + tile.value;
    if (tileCount[key] === 1) {
      return tile;
    }
  }

  return null;
}

// 执行决策
function executeDecision(decision) {
  setTimeout(() => {
    socket.emit('agent:command', decision, (res) => {
      if (res && res.success) {
        console.log('[紫璃] ✅ 执行成功');
      } else {
        console.log('[紫璃] ❌ 执行失败:', res?.error || '未知');
      }
    });
  }, 800);
}

// 保持进程运行
console.log('按 Ctrl+C 退出\n');
