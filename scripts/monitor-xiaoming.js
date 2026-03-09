/**
 * 麻将 AI「小明」监控脚本
 * 
 * 运行 bridge.js 并监听事件文件，当需要决策时暂停等待主 Agent 输入
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const ROOM_ID = 'mmg1uucx-a2ossxp2y';
const AGENT_ID = 'xiaoming-5';
const AGENT_NAME = '小明';
const FILE_PREFIX = 'xiaoming-5';

const SCRIPTS_DIR = path.join(__dirname);
const EVENTS_FILE = path.join(SCRIPTS_DIR, `${FILE_PREFIX}-events.jsonl`);
const DECISION_FILE = path.join(SCRIPTS_DIR, `${FILE_PREFIX}-decision.json`);

// 清理旧文件
if (fs.existsSync(EVENTS_FILE)) fs.unlinkSync(EVENTS_FILE);
if (fs.existsSync(DECISION_FILE)) fs.unlinkSync(DECISION_FILE);

console.log(`🀄 麻将 AI「小明」启动`);
console.log(`   房间：${ROOM_ID}`);
console.log(`   Agent ID: ${AGENT_ID}`);
console.log(`   事件文件：${EVENTS_FILE}`);
console.log(`   决策文件：${DECISION_FILE}`);
console.log(`---`);

// 启动 bridge.js
const bridge = spawn('node', [
  path.join(__dirname, 'bridge.js'),
  ROOM_ID,
  AGENT_ID,
  AGENT_NAME,
  '--file',
  FILE_PREFIX
], {
  cwd: SCRIPTS_DIR,
  stdio: ['pipe', 'pipe', 'pipe']
});

// 监听 bridge 输出
bridge.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const event = JSON.parse(line);
        console.log(`📥 [${event.type}]`, JSON.stringify(event, null, 2));
        
        // 检测需要决策的事件
        if (event.type === 'your_turn') {
          console.log(`\n⏸️  等待主 Agent 决策...`);
          console.log(`   请在 ${DECISION_FILE} 中写入决策 JSON`);
          console.log(`   示例：{"cmd": "draw"} 或 {"cmd": "discard", "tileId": "..."}`);
          console.log(`---`);
        }
        
        // 游戏结束
        if (event.type === 'game_ended') {
          console.log(`\n🎉 游戏结束!`);
          console.log(`   获胜者：${event.winner?.name || '未知'}`);
          if (event.winningHand) {
            console.log(`   胡牌牌型：`, JSON.stringify(event.winningHand, null, 2));
          }
        }
      } catch (e) {
        console.log(`[原始输出]`, line);
      }
    }
  });
});

bridge.stderr.on('data', (data) => {
  console.error(`❌ ${data.toString()}`);
});

bridge.on('close', (code) => {
  console.log(`\n🏁 Bridge 进程退出，代码：${code}`);
  process.exit(code);
});

// 监听主 Agent 的决策输入（通过 stdin）
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  const trimmed = input.trim();
  if (trimmed) {
    try {
      // 验证 JSON 格式
      const decision = JSON.parse(trimmed);
      
      // 写入决策文件
      fs.writeFileSync(DECISION_FILE, trimmed, 'utf8');
      console.log(`✅ 决策已写入：${trimmed}`);
      console.log(`---`);
    } catch (e) {
      console.log(`❌ 无效的决策格式：${e.message}`);
    }
  }
});

console.log(`\n💡 提示：`);
console.log(`   - 事件会输出到控制台和 ${EVENTS_FILE}`);
console.log(`   - 输入决策 JSON 并按回车，会自动写入 ${DECISION_FILE}`);
console.log(`   - 游戏结束后自动退出`);
console.log(`---\n`);
