const { io } = require('socket.io-client');
const roomId = 'mmeqyd1h-cgxpqqjtj';

// 青鸾
const s1 = io('http://localhost:3000');
s1.on('connect', () => {
  s1.emit('room:joinAI', { roomId, agentId: 'qingluan', agentName: '青鸾', type: 'ai-agent' }, (r) => {
    console.log('青鸾:', r.success ? '成功' : r.message);
  });
});
s1.on('agent:your_turn', (d) => handleTurn(s1, d));
s1.on('game:actions', (d) => handleActions(s1, d));

// 烟华
const s2 = io('http://localhost:3000');
s2.on('connect', () => {
  s2.emit('room:joinAI', { roomId, agentId: 'yanhua', agentName: '烟华', type: 'ai-agent' }, (r) => {
    console.log('烟华:', r.success ? '成功' : r.message);
  });
});
s2.on('agent:your_turn', (d) => handleTurn(s2, d));
s2.on('game:actions', (d) => handleActions(s2, d));

function handleTurn(s, d) {
  setTimeout(() => {
    if (d.phase === 'draw') s.emit('agent:command', { cmd: 'draw' });
    else if (d.phase === 'discard' && d.hand?.length) {
      const t = d.hand[Math.floor(Math.random() * d.hand.length)];
      s.emit('agent:command', { cmd: 'discard', tileId: t.id });
    }
  }, 800);
}

function handleActions(s, d) {
  const acts = d.actions || [];
  setTimeout(() => {
    if (acts.some(x => x.action === 'hu')) s.emit('agent:command', { cmd: 'action', action: 'hu' });
    else if (acts.some(x => x.action === 'peng')) s.emit('agent:command', { cmd: 'action', action: 'peng' });
    else if (acts.some(x => x.action === 'chi')) s.emit('agent:command', { cmd: 'action', action: 'chi' });
    else s.emit('agent:command', { cmd: 'pass' });
  }, 500);
}

console.log('AI 玩家已启动');
setInterval(() => {}, 60000);
