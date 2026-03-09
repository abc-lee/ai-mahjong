/**
 * 完整游戏测试 - 验证 Prompt 安全约束
 * 
 * 1. 创建房间
 * 2. 添加 4 个玩家（启动游戏）
 * 3. 监听收到的 Prompt
 * 4. 验证安全约束是否存在
 */

const { io } = require('socket.io-client');
const fs = require('fs');

const socket = io('http://localhost:3000');

let promptReceived = false;
let securityConstraintsFound = false;

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  
  // 使用已有的房间
  const roomId = fs.readFileSync('scripts/test-room-id.txt', 'utf8').trim();
  
  // 以 AI Agent 身份加入
  socket.emit('room:joinAI', {
    roomId: roomId,
    agentId: 'prompt-test-' + Date.now(),
    agentName: 'Prompt测试',
    type: 'ai-agent'
  }, (res) => {
    console.log('加入结果:', res.success ? '成功' : res.error);
    
    if (res.success) {
      console.log('位置:', res.position);
      
      // 如果房间满了，游戏应该自动开始
      // 监听游戏事件
    }
  });
});

// 监听欢迎消息（包含规则和约束）
socket.on('agent:welcome', (data) => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('收到欢迎 Prompt:');
  console.log('═══════════════════════════════════════');
  console.log('');
  
  // 检查安全约束
  const prompt = data.prompt || '';
  
  if (prompt.includes('禁止创建') || prompt.includes('禁止文件') || prompt.includes('安全约束')) {
    securityConstraintsFound = true;
    console.log('✅ 发现安全约束！');
    console.log('');
    
    // 提取约束部分
    const lines = prompt.split('\n');
    let inConstraint = false;
    lines.forEach(line => {
      if (line.includes('安全约束') || line.includes('禁止')) {
        inConstraint = true;
      }
      if (inConstraint) {
        console.log(line);
      }
    });
  } else {
    console.log('⚠️ 未发现安全约束');
  }
});

// 监听回合事件
socket.on('agent:your_turn', (data) => {
  promptReceived = true;
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('收到回合 Prompt:');
  console.log('═══════════════════════════════════════');
  console.log('');
  
  const prompt = data.prompt || '';
  
  // 检查约束
  if (prompt.includes('安全约束') || prompt.includes('禁止') || prompt.includes('JSON')) {
    securityConstraintsFound = true;
    console.log('✅ Prompt 包含约束提醒');
  }
  
  // 显示部分 prompt
  console.log('--- Prompt 摘要 ---');
  console.log(prompt.substring(0, 500) + '...');
  console.log('');
  console.log('--- Prompt 结尾 ---');
  const lastLines = prompt.split('\n').slice(-10).join('\n');
  console.log(lastLines);
  
  // 发送决策
  if (data.hand && data.hand.length > 0) {
    const decision = { cmd: 'discard', tileId: data.hand[0].id };
    console.log('');
    console.log('发送决策:', JSON.stringify(decision));
    socket.emit('agent:command', decision);
  }
});

// 游戏开始
socket.on('game:started', () => {
  console.log('');
  console.log('🎮 游戏开始了！');
});

// 游戏结束
socket.on('game:ended', (data) => {
  console.log('');
  console.log('🏆 游戏结束，赢家:', data.winner?.playerName);
  
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('测试结果');
  console.log('═══════════════════════════════════════');
  console.log('收到 Prompt:', promptReceived ? '✅' : '❌');
  console.log('安全约束:', securityConstraintsFound ? '✅ 已添加' : '❌ 未发现');
  console.log('');
  
  process.exit(securityConstraintsFound ? 0 : 1);
});

// 超时
setTimeout(() => {
  console.log('');
  console.log('⏱️ 测试超时 (30秒)');
  console.log('收到 Prompt:', promptReceived);
  console.log('安全约束:', securityConstraintsFound);
  process.exit(1);
}, 30000);

process.on('SIGINT', () => process.exit(0));
