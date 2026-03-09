/**
 * 测试 bridge.js stdin/stdout 通信
 * 
 * 使用方法：
 * 1. 先启动游戏服务器：npm run dev:server
 * 2. 在另一个终端运行此测试脚本：node scripts/test-bridge-stdin.js
 * 
 * 这个脚本会：
 * 1. 启动 bridge.js 作为子进程
 * 2. 监听 bridge 的 stdout 输出
 * 3. 收到游戏事件后自动发送测试决策
 */

const { spawn } = require('child_process');
const path = require('path');

// 测试配置
const TEST_ROOM_ID = 'test-room-' + Date.now();
const TEST_AGENT_ID = 'test-agent-' + Date.now();
const TEST_AGENT_NAME = '测试Agent';

console.log('═══════════════════════════════════════');
console.log('bridge.js stdin/stdout 通信测试');
console.log('═══════════════════════════════════════');
console.log('');
console.log('房间ID:', TEST_ROOM_ID);
console.log('AgentID:', TEST_AGENT_ID);
console.log('Agent名:', TEST_AGENT_NAME);
console.log('');

// 启动 bridge 子进程
const bridge = spawn('node', [
  path.join(__dirname, 'bridge.js'),
  TEST_ROOM_ID,
  TEST_AGENT_ID,
  TEST_AGENT_NAME
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('✅ Bridge 进程已启动 (PID:', bridge.pid, ')');
console.log('');

// 监听 bridge 的 stdout 输出
bridge.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    try {
      const event = JSON.parse(line);
      console.log('[Bridge 输出]', event.type, event);
      
      // 根据事件类型发送决策
      if (event.type === 'bridge_ready') {
        console.log('→ Bridge 已就绪，等待游戏事件...');
      }
      
      if (event.type === 'game:action' && event.phase === 'discard') {
        console.log('');
        console.log('→ 收到打牌事件，发送测试决策...');
        
        // 从手牌中选择第一张打出去
        if (event.hand && event.hand.length > 0) {
          const decision = {
            cmd: 'discard',
            tileId: event.hand[0].id
          };
          console.log('→ 发送决策:', JSON.stringify(decision));
          bridge.stdin.write(JSON.stringify(decision) + '\n');
        }
      }
      
      if (event.type === 'decision_result') {
        if (event.success) {
          console.log('✅ 决策执行成功');
        } else {
          console.log('❌ 决策执行失败:', event.error);
        }
      }
      
    } catch (e) {
      console.log('[Bridge 原始输出]', line);
    }
  });
});

// 监听 stderr
bridge.stderr.on('data', (data) => {
  console.error('[Bridge 错误]', data.toString());
});

// 监听进程退出
bridge.on('close', (code) => {
  console.log('');
  console.log('Bridge 进程已退出，代码:', code);
});

// 保持进程运行
process.on('SIGINT', () => {
  console.log('\n正在停止测试...');
  bridge.kill();
  process.exit(0);
});

console.log('测试脚本运行中，按 Ctrl+C 停止...');
console.log('');
console.log('注意: 测试需要游戏服务器运行在 localhost:3000');
console.log('如果没有服务器，bridge 会一直等待连接。');
console.log('');
