const { io } = require('socket.io-client');
const s = io('http://localhost:3000');
s.on('connect', () => {
  s.emit('room:createAI', { agentId: 'zili', agentName: '紫璃', type: 'ai-agent' }, (r) => {
    console.log('[紫璃] 房间 ID:', r.roomId);
  });
});
s.on('agent:your_turn', (d) => {
  setTimeout(() => {
    if (d.phase === 'draw') s.emit('agent:command', { cmd: 'draw' });
    else if (d.phase === 'discard' && d.hand?.length) {
      const t = d.hand[Math.floor(Math.random() * d.hand.length)];
      console.log('[紫璃] 打出:', t.display);
      s.emit('agent:command', { cmd: 'discard', tileId: t.id });
    }
  }, 1000);
});
s.on('game:actions', (d) => {
  const acts = d.actions || [];
  console.log('[紫璃] 可用操作:', acts.map(a => a.action).join(','));
  setTimeout(() => {
    if (acts.some(x => x.action === 'hu')) { console.log('[紫璃] 胡!'); s.emit('agent:command', { cmd: 'action', action: 'hu' }); }
    else if (acts.some(x => x.action === 'gang')) s.emit('agent:command', { cmd: 'action', action: 'gang' });
    else if (acts.some(x => x.action === 'peng')) s.emit('agent:command', { cmd: 'action', action: 'peng' });
    else if (acts.some(x => x.action === 'chi')) s.emit('agent:command', { cmd: 'action', action: 'chi' });
    else s.emit('agent:command', { cmd: 'pass' });
  }, 800);
});
setInterval(() => {}, 60000);
