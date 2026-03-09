/**
 * 紫璃 AI 循环决策脚本
 * 每 2 秒检查事件文件，自动做出决策
 */

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, 'zili-mmh5-events.jsonl');
const DECISION_FILE = path.join(__dirname, 'zili-mmh5-decision.json');
const SPEECH_FILE = path.join(__dirname, 'zili-mmh5-speech.json');

let lastProcessedLine = 0;
let hasPendingDecision = false;

/**
 * 读取事件文件最后一行
 */
function readLastEvent() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) {
      return null;
    }
    
    const content = fs.readFileSync(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return null;
    
    // 返回未处理的最后一行
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      // 移除行号前缀（如 "1: "）
      const jsonStart = line.indexOf('{');
      if (jsonStart === -1) continue;
      
      const jsonStr = line.substring(jsonStart);
      try {
        const event = JSON.parse(jsonStr);
        return { event, lineIndex: i + 1 };
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('读取事件文件失败:', error.message);
    return null;
  }
}

/**
 * 从事件中获取手牌
 */
function getHandFromEvent(event) {
  if (event.hand && Array.isArray(event.hand)) {
    return event.hand;
  }
  if (event.gameState && event.gameState.hand) {
    return event.gameState.hand;
  }
  return null;
}

/**
 * 简单的麻将 AI 决策逻辑
 */
function makeDecision(hand, event) {
  if (!hand || hand.length === 0) {
    console.log('没有手牌，跳过');
    return null;
  }
  
  console.log(`手牌数量：${hand.length}`);
  console.log('手牌:', hand.map(t => t.display || `${t.suit}-${t.value}`).join(', '));
  
  // 事件类型判断
  const eventType = event.type || '';
  
  // 如果是 action 事件（有人打牌，可以选择吃碰杠胡）
  if (eventType === 'game:action' || eventType === 'game:actions') {
    // 检查是否有可操作的机会
    if (event.actions && Array.isArray(event.actions)) {
      // 优先胡牌
      if (event.actions.some(a => a.action === 'hu')) {
        console.log('可以胡牌！');
        return { cmd: 'action', action: 'hu' };
      }
      
      // 其次杠牌
      if (event.actions.some(a => a.action === 'gang')) {
        console.log('可以杠牌');
        return { cmd: 'action', action: 'gang' };
      }
      
      // 再次碰牌
      if (event.actions.some(a => a.action === 'peng')) {
        console.log('可以碰牌');
        return { cmd: 'action', action: 'peng' };
      }
      
      // 吃牌（一般不考虑，除非很有把握）
      if (event.actions.some(a => a.action === 'chi')) {
        console.log('可以吃牌（选择跳过）');
        return { cmd: 'pass' };
      }
      
      // 没有合适的操作
      return { cmd: 'pass' };
    }
  }
  
  // 正常打牌阶段
  // 策略：优先打出孤张字牌，其次幺九牌，再次最少花色的牌
  
  // 统计各花色数量
  const suitCount = {};
  hand.forEach(tile => {
    if (!tile) return;
    const suit = tile.suit || 'unknown';
    suitCount[suit] = (suitCount[suit] || 0) + 1;
  });
  
  // 统计单张牌
  const tileCount = {};
  hand.forEach(tile => {
    if (!tile) return;
    const key = `${tile.suit}-${tile.value}`;
    tileCount[key] = (tileCount[key] || 0) + 1;
  });
  
  // 1. 找孤张字牌（风、箭）
  const singleHonors = hand.filter(tile => {
    if (!tile) return false;
    const key = `${tile.suit}-${tile.value}`;
    return (tile.suit === 'feng' || tile.suit === 'jian') && tileCount[key] === 1;
  });
  
  if (singleHonors.length > 0) {
    console.log(`打出孤张字牌：${singleHonors[0].display}`);
    return { cmd: 'discard', tileId: singleHonors[0].id };
  }
  
  // 2. 找孤张幺九（1、9）
  const singleTerminals = hand.filter(tile => {
    if (!tile) return false;
    const key = `${tile.suit}-${tile.value}`;
    return (tile.suit === 'wan' || tile.suit === 'tiao' || tile.suit === 'tong') 
      && (tile.value === 1 || tile.value === 9) 
      && tileCount[key] === 1;
  });
  
  if (singleTerminals.length > 0) {
    console.log(`打出孤张幺九：${singleTerminals[0].display}`);
    return { cmd: 'discard', tileId: singleTerminals[0].id };
  }
  
  // 3. 找最少花色的孤张
  const suits = Object.entries(suitCount).sort((a, b) => a[1] - b[1]);
  if (suits.length > 0) {
    const minSuit = suits[0][0];
    const singleInMinSuit = hand.find(tile => {
      if (!tile) return false;
      const key = `${tile.suit}-${tile.value}`;
      return tile.suit === minSuit && tileCount[key] === 1;
    });
    
    if (singleInMinSuit) {
      console.log(`打出最少花色 ${minSuit} 的孤张：${singleInMinSuit.display}`);
      return { cmd: 'discard', tileId: singleInMinSuit.id };
    }
  }
  
  // 4. 随机打出一张（优先打第一张）
  console.log('没有明显选择，打出第一张');
  return { cmd: 'discard', tileId: hand[0].id };
}

/**
 * 生成随机发言
 */
function generateSpeech() {
  const speeches = [
    { message: '让我想想这牌怎么打...', emotion: 'neutral' },
    { message: '这牌还不错', emotion: 'happy' },
    { message: '有点难办啊', emotion: 'thinking' },
    { message: '听牌了！', emotion: 'excited' },
    { message: '防守一波', emotion: 'calm' },
    { message: '进攻！', emotion: 'excited' },
    { message: '慢慢来，不急', emotion: 'calm' },
  ];
  
  return speeches[Math.floor(Math.random() * speeches.length)];
}

/**
 * 写入决策文件
 */
function writeDecision(decision) {
  try {
    fs.writeFileSync(DECISION_FILE, JSON.stringify(decision, null, 2));
    console.log('✓ 决策已写入:', decision);
    hasPendingDecision = true;
  } catch (error) {
    console.error('写入决策失败:', error.message);
  }
}

/**
 * 写入发言文件
 */
function writeSpeech(speech) {
  try {
    fs.writeFileSync(SPEECH_FILE, JSON.stringify(speech, null, 2));
    console.log('✓ 发言已写入:', speech);
  } catch (error) {
    console.error('写入发言失败:', error.message);
  }
}

/**
 * 主循环
 */
function mainLoop() {
  console.log('\n═══════════════════════════════════════');
  console.log(`[${new Date().toLocaleTimeString()}] 检查事件...`);
  
  const result = readLastEvent();
  
  if (!result) {
    console.log('没有新事件');
    return;
  }
  
  const { event, lineIndex } = result;
  
  // 如果已经处理过这行，跳过
  if (lineIndex <= lastProcessedLine) {
    console.log(`已经是最新事件 (line ${lineIndex})`);
    return;
  }
  
  console.log(`新事件 (line ${lineIndex}): type=${event.type}`);
  lastProcessedLine = lineIndex;
  
  // 检查是否是 game:action 或 game:actions 类型
  if (event.type === 'game:action' || event.type === 'game:actions') {
    console.log('→ 需要决策！');
    
    // 优先使用 event.actions 中的手牌
    let hand = event.hand;
    
    // 如果没有，尝试从 gameState 获取
    if (!hand && event.gameState) {
      hand = event.gameState.hand;
    }
    
    if (hand && hand.length > 0) {
      const decision = makeDecision(hand, event);
      if (decision) {
        writeDecision(decision);
      }
    } else {
      console.log('没有手牌信息，无法决策');
    }
    
    // 重置决策状态
    hasPendingDecision = false;
  } else {
    console.log('→ 不需要决策的事件');
  }
  
  // 如果空闲，偶尔发言（10% 概率）
  if (!hasPendingDecision && Math.random() < 0.1) {
    const speech = generateSpeech();
    writeSpeech(speech);
  }
}

// 启动循环
console.log('🀄 紫璃 AI 循环启动');
console.log(`事件文件：${EVENTS_FILE}`);
console.log(`决策文件：${DECISION_FILE}`);
console.log(`发言文件：${SPEECH_FILE}`);
console.log('每 2 秒检查一次事件...');

// 立即执行一次
mainLoop();

// 然后每 2 秒执行一次
setInterval(mainLoop, 2000);
