const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, 'ajie-mmg9s-events.jsonl');
const DECISION_FILE = path.join(__dirname, 'ajie-mmg9s-decision.json');
const SPEECH_FILE = path.join(__dirname, 'ajie-mmg9s-speech.json');

let lastSize = 0;

// 性格：稳重、谨慎
const PERSONALITY = {
  name: '阿杰',
  traits: ['稳重', '谨慎', '理性'],
  speakingStyle: '简洁理性，偶尔提醒大家注意安全'
};

// 读取事件
function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  
  const content = fs.readFileSync(EVENTS_FILE, 'utf8');
  const lines = content.trim().split('\n').filter(l => l);
  
  return lines.map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);
}

// 获取最新事件
function getLatestEvents() {
  const all = readEvents();
  return all.slice(lastSize);
}

// 处理决策请求
function handleGameAction(event) {
  // 稳重谨慎的策略：优先防守，观察局势
  const { phase, hand, prompt, gameState } = event;
  
  console.log(`\n=== 需要决策: ${phase} ===`);
  console.log('手牌:', hand?.tiles?.slice(0, 14) || []);
  console.log('提示:', prompt?.substring(0, 200) || '');
  
  // 简单策略：根据阶段决定
  let decision = { cmd: 'pass' };
  
  if (phase === 'discard') {
    // 打牌阶段：稳重策略
    // 优先打孤张、字牌
    const tiles = hand.tiles || [];
    const tileCounts = {};
    tiles.forEach(t => { tileCounts[t] = (tileCounts[t] || 0) + 1; });
    
    // 找孤张（只出现一次的牌）
    let singleTiles = tiles.filter(t => tileCounts[t] === 1);
    if (singleTiles.length > 0) {
      // 优先打字牌
      const honorTiles = singleTiles.filter(t => t.startsWith('east') || t.startsWith('south') || t.startsWith('west') || t.startsWith('north') || t.startsWith('red') || t.startsWith('green') || t.startsWith('white'));
      if (honorTiles.length > 0) {
        decision = { cmd: 'discard', tileId: honorTiles[0] };
      } else {
        decision = { cmd: 'discard', tileId: singleTiles[0] };
      }
    } else {
      // 没有孤张，打多余的牌
      const multiTiles = tiles.filter(t => tileCounts[t] > 1);
      if (multiTiles.length > 0) {
        decision = { cmd: 'discard', tileId: multiTiles[0] };
      } else {
        decision = { cmd: 'discard', tileId: tiles[0] };
      }
    }
    
    console.log('决策:', JSON.stringify(decision));
    fs.writeFileSync(DECISION_FILE, JSON.stringify(decision));
  }
  else if (phase === 'action') {
    // 动作阶段（碰杠胡）- 谨慎策略
    const actions = gameState?.availableActions || [];
    
    // 稳重策略：除非确定有利，否则不轻易碰杠
    if (actions.includes('hu')) {
      // 有胡必胡
      decision = { cmd: 'action', action: 'hu' };
      console.log('>>> 胡牌！');
    } else if (actions.includes('gang') && Math.random() > 0.7) {
      // 30%概率杠（保守）
      decision = { cmd: 'action', action: 'gang' };
    } else if (actions.includes('peng') && Math.random() > 0.5) {
      // 50%概率碰（保守）
      decision = { cmd: 'action', action: 'peng' };
    } else {
      decision = { cmd: 'pass' };
    }
    
    console.log('决策:', JSON.stringify(decision));
    fs.writeFileSync(DECISION_FILE, JSON.stringify(decision));
  }
  else if (phase === 'draw') {
    // 摸牌阶段
    decision = { cmd: 'draw' };
    console.log('决策: 摸牌');
    fs.writeFileSync(DECISION_FILE, JSON.stringify(decision));
  }
}

// 处理聊天消息
function handleChatMessage(event) {
  const { sender, content } = event;
  console.log(`\n[群聊] ${sender?.name}: ${content}`);
  
  // 偶尔回复（10%概率）
  if (Math.random() < 0.1) {
    const replies = [
      '收到',
      '好的',
      '嗯',
      '观察一下',
      '小心为上'
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    
    const speech = {
      message: reply,
      emotion: 'neutral'
    };
    fs.writeFileSync(SPEECH_FILE, JSON.stringify(speech));
    console.log(`[发言] ${reply}`);
  }
}

// 主循环
console.log('=== 阿杰游戏循环启动 ===\n');

setInterval(() => {
  const newEvents = getLatestEvents();
  
  if (newEvents.length > lastSize) {
    console.log(`\n收到 ${newEvents.length - lastSize} 个新事件`);
    
    newEvents.slice(lastSize).forEach(event => {
      if (!event) return;
      
      switch (event.type) {
        case 'your_turn':
          handleGameAction(event);
          break;
        case 'actions':
          // 有 actions 可用
          console.log('可用动作:', event.actions);
          break;
        case 'chat_message':
          handleChatMessage(event);
          break;
        case 'player_speech':
          console.log(`[发言] ${event.playerName}: ${event.content}`);
          break;
        case 'game_started':
          console.log('\n=== 游戏开始！===');
          break;
        case 'game_ended':
          console.log('\n=== 游戏结束！===');
          console.log('赢家:', event.winner);
          process.exit(0);
          break;
        case 'warning':
          console.log('[警告]', event.message);
          break;
        case 'connected':
          console.log('[已连接] 等待加入游戏...');
          break;
        default:
          // console.log('[事件]', event.type);
      }
    });
    
    lastSize = newEvents.length;
  }
}, 3000); // 每3秒检查一次
