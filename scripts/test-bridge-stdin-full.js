/**
 * 完整测试 bridge.js stdin/stdout 通信
 * 
 * 测试内容：
 * 1. 启动 bridge.js 作为子进程
 * 2. 监听 stdout 输出
 * 3. 通过 stdin 发送决策
 * 4. 验证通信成功
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 读取房间ID
const ROOM_ID = fs.readFileSync(path.join(__dirname, 'test-room-id.txt'), 'utf8').trim();
const AGENT_ID = 'test-stdin-' + Date.now();
const AGENT_NAME = 'STDIN测试';

console.log('═══════════════════════════════════════');
console.log('bridge.js stdin/stdout 通信测试');
console.log('═══════════════════════════════════════');
console.log('');
console.log('房间ID:', ROOM_ID);
console.log('AgentID:', AGENT_ID);
console.log('Agent名:', AGENT_NAME);
console.log('');

// 测试状态
let testPassed = {
  bridgeReady: false,
  connected: false,
  joined: false,
  stdinSent: false,
  decisionResult: false
};

// 启动 bridge 子进程
const bridge = spawn('node', [
  path.join(__dirname, 'bridge.js'),
  ROOM_ID,
  AGENT_ID,
  AGENT_NAME
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
      console.log('[收到]', event.type, JSON.stringify(event).substring(0, 100));
      
      if (event.type === 'bridge_ready') {
        testPassed.bridgeReady = true;
        console.log('   ✅ Bridge 就绪');
      }
      
      if (event.type === 'connected') {
        testPassed.connected = true;
        console.log('   ✅ 已连接服务器');
      }
      
      if (event.type === 'joined') {
        testPassed.joined = true;
        console.log('   ✅ 已加入房间，位置:', event.position);
        
        // 发送测试决策
        setTimeout(() => {
          const testDecision = { cmd: 'draw' };  // 测试摸牌命令
          console.log('');
          console.log('[发送] 通过 stdin 发送决策:', JSON.stringify(testDecision));
          bridge.stdin.write(JSON.stringify(testDecision) + '\n');
          testPassed.stdinSent = true;
        }, 1000);
      }
      
      if (event.type === 'decision_result') {
        testPassed.decisionResult = true;
        console.log('   ✅ 决策执行结果:', event.success ? '成功' : '失败');
        if (event.error) {
          console.log('   ⚠️ 错误:', event.error);
        }
        
        // 测试完成，输出结果
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('测试结果');
        console.log('═══════════════════════════════════════');
        console.log('');
        console.log('Bridge 就绪:', testPassed.bridgeReady ? '✅' : '❌');
        console.log('连接服务器:', testPassed.connected ? '✅' : '❌');
        console.log('加入房间:', testPassed.joined ? '✅' : '❌');
        console.log('stdin 发送:', testPassed.stdinSent ? '✅' : '❌');
        console.log('决策结果:', testPassed.decisionResult ? '✅' : '❌');
        console.log('');
        
        const allPassed = Object.values(testPassed).every(v => v);
        if (allPassed) {
          console.log('🎉 所有测试通过！stdin/stdout 通信正常！');
        } else {
          console.log('⚠️ 部分测试未通过');
        }
        
        console.log('');
        bridge.kill();
        process.exit(allPassed ? 0 : 1);
      }
      
    } catch (e) {
      console.log('[原始]', line);
    }
  });
});

// 监听 stderr
bridge.stderr.on('data', (data) => {
  console.error('[错误]', data.toString());
});

// 监听进程退出
bridge.on('close', (code) => {
  if (code !== 0) {
    console.log('');
    console.log('Bridge 进程退出，代码:', code);
  }
});

// 超时处理
setTimeout(() => {
  console.log('');
  console.log('⏱️ 测试超时 (15秒)');
  console.log('');
  console.log('当前状态:');
  console.log(JSON.stringify(testPassed, null, 2));
  bridge.kill();
  process.exit(1);
}, 15000);

// 保持进程运行
process.on('SIGINT', () => {
  bridge.kill();
  process.exit(0);
});
