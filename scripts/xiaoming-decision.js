/**
 * 小明 AI 决策循环
 * 每 2 秒读取事件文件，根据游戏状态做出决策
 */

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, 'xiaoming-2-events.jsonl');
const DECISION_FILE = path.join(__dirname, 'xiaoming-2-decision.json');

let lastProcessedLine = 0;
let currentHand = [];
let isMyTurn = false;
let availableActions = [];

console.log('🀄 小明 AI 决策循环启动...');
console.log('监听文件:', EVENTS_FILE);

// 主循环 - 每 2 秒检查一次
setInterval(() => {
  processEvents();
  
  // 如果轮到我且还没有决策，做出决策
  if (isMyTurn && availableActions.length > 0) {
    makeDecision();
  }
}, 2000);

// 处理事件文件
function processEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    return;
  }
  
  try {
    const content = fs.readFileSync(EVENTS_FILE, 'utf8');
    const lines = content.trim().split('\n');
    
    // 处理新行
    for (let i = lastProcessedLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const event = JSON.parse(line);
      handleEvent(event);
    }
    
    lastProcessedLine = lines.length;
  } catch (e) {
    // 文件可能正在写入，忽略
  }
}

// 处理单个事件
function handleEvent(event) {
  console.log(`\n📩 事件 [${event.type}]:`, JSON.stringify(event, null, 2));
  
  switch (event.type) {
    case 'your_turn':
      isMyTurn = true;
      currentHand = event.hand || [];
      console.log(`\n🎴 轮到我打牌了！手牌数：${currentHand.length}`);
      if (event.prompt) {
        console.log('\n--- Prompt ---');
        console.log(event.prompt);
        console.log('---\n');
      }
      break;
      
    case 'actions':
      availableActions = event.actions || [];
      console.log(`\n🎯 可用操作：`, availableActions);
      break;
      
    case 'game_started':
      console.log('\n🎮 游戏开始！');
      isMyTurn = false;
      availableActions = [];
      break;
      
    case 'game_ended':
      console.log('\n🏁 游戏结束！');
      console.log('获胜者:', event.winner);
      console.log('手牌:', event.winningHand);
      process.exit(0);
      break;
      
    case 'decision_result':
      console.log('\n✅ 决策结果:', event.success ? '成功' : '失败', event.error || '');
      if (event.success) {
        isMyTurn = false;
        availableActions = [];
      }
      break;
  }
}

// 做出决策
function makeDecision() {
  console.log('\n🤔 小明思考中...');
  
  // 简单决策逻辑
  const action = availableActions.find(a => a.action === 'hu');
  if (action) {
    console.log('🎉 胡牌！');
    writeDecision({ cmd: 'action', action: 'hu' });
    return;
  }
  
  const gangAction = availableActions.find(a => a.action === 'gang');
  if (gangAction) {
    console.log('🀄 杠！');
    writeDecision({ cmd: 'action', action: 'gang' });
    return;
  }
  
  const pengAction = availableActions.find(a => a.action === 'peng');
  if (pengAction) {
    console.log('🀄 碰！');
    writeDecision({ cmd: 'action', action: 'peng' });
    return;
  }
  
  const chiAction = availableActions.find(a => a.action === 'chi');
  if (chiAction) {
    console.log('🀄 吃！');
    writeDecision({ cmd: 'action', action: 'chi' });
    return;
  }
  
  // 打牌逻辑：随机打一张
  if (currentHand.length > 0) {
    const tileIndex = Math.floor(Math.random() * currentHand.length);
    const tile = currentHand[tileIndex];
    console.log(`🃏 打牌：${tile.label || tile.id}`);
    writeDecision({ cmd: 'discard', tileId: tile.id });
    return;
  }
  
  // 摸牌
  console.log('🃏 摸牌');
  writeDecision({ cmd: 'draw' });
}

// 写入决策文件
function writeDecision(decision) {
  try {
    fs.writeFileSync(DECISION_FILE, JSON.stringify(decision, null, 2));
    console.log('✅ 决策已写入:', DECISION_FILE);
    console.log('决策内容:', JSON.stringify(decision));
  } catch (e) {
    console.error('❌ 写入决策失败:', e.message);
  }
}
