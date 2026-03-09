/**
 * 监听小明的事件并等待决策
 */
const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, 'xiaoming-9-events.jsonl');
const DECISION_FILE = path.join(__dirname, 'xiaoming-9-decision.json');

console.log('🔍 监听事件文件:', EVENTS_FILE);
console.log('📝 决策文件:', DECISION_FILE);
console.log('按 Ctrl+C 停止\n');

let lastLine = 0;
let waitingForDecision = false;

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return;
  
  const content = fs.readFileSync(EVENTS_FILE, 'utf8').trim();
  if (!content) return;
  
  const lines = content.split('\n');
  
  // 只处理新行
  for (let i = lastLine; i < lines.length; i++) {
    try {
      const evt = JSON.parse(lines[i]);
      console.log(`[${evt.type}]`, JSON.stringify(evt, null, 2));
      
      if (evt.type === 'your_turn') {
        console.log('\n🀄 轮到你出牌了！');
        console.log('   阶段:', evt.phase);
        console.log('   手牌:', evt.hand?.length, '张');
        waitingForDecision = true;
      }
      
      if (evt.type === 'game_ended') {
        console.log('\n🏁 游戏结束');
        process.exit(0);
      }
      
      if (evt.type === 'decision_result') {
        console.log('\n✅ 决策已发送:', evt.success ? '成功' : '失败');
        waitingForDecision = false;
      }
    } catch (e) {
      console.error('解析错误:', e.message, lines[i]);
    }
  }
  
  lastLine = lines.length;
}

// 初始读取
readEvents();

// 持续轮询
setInterval(readEvents, 500);

// 检查是否有决策文件需要处理
setInterval(() => {
  if (waitingForDecision && fs.existsSync(DECISION_FILE)) {
    const decision = fs.readFileSync(DECISION_FILE, 'utf8');
    console.log('\n📤 检测到决策:', decision);
  }
}, 1000);
