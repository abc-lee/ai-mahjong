/**
 * 快速测试脚本
 * 测试 n8n 与 OpenClaw 的连接
 */

const http = require('http');
const fs = require('path');

const N8N_URL = 'http://192.168.3.19:5678';
const TEST_TOKEN = 'test_token_please_change';

console.log('=== n8n 连接测试 ===\n');
console.log(`n8n 地址: ${N8N_URL}`);
console.log(`时间: ${new Date().toLocaleString()}\n`);

// 测试 1: 检查 n8n 是否可达
console.log('[测试 1] 检查 n8n 连接...');
http.get(N8N_URL, (res) => {
  console.log(`  ✓ n8n 响应状态: ${res.statusCode}`);
  
  // 测试 2: 发送测试消息
  console.log('\n[测试 2] 发送测试消息到 webhook...');
  
  const testMessage = {
    action: 'test',
    content: 'Hello from OpenCode test script',
    timestamp: Date.now()
  };
  
  const url = new URL(`${N8N_URL}/webhook/opencode-send`);
  
  const req = http.request({
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log(`  ✓ 消息发送成功 (${res.statusCode})`);
        console.log(`  响应: ${data}`);
      } else if (res.statusCode === 401) {
        console.log(`  ✗ 认证失败 (${res.statusCode})`);
        console.log('  提示: 需要在 n8n 工作流中配置正确的认证');
      } else if (res.statusCode === 404) {
        console.log(`  ✗ Webhook 不存在 (${res.statusCode})`);
        console.log('  提示: 需要在 n8n 中导入并激活工作流');
      } else {
        console.log(`  ? 未知响应 (${res.statusCode})`);
        console.log(`  响应: ${data}`);
      }
      
      console.log('\n=== 测试完成 ===');
      console.log('\n下一步:');
      console.log('1. 在 n8n 中导入 workflows/opencode-to-openclaw.json');
      console.log('2. 配置 Header Auth 凭证');
      console.log('3. 激活工作流');
      console.log('4. 在 OpenClaw 端安装 n8n-bridge skill');
    });
  });
  
  req.on('error', (e) => {
    console.log(`  ✗ 请求失败: ${e.message}`);
  });
  
  req.write(JSON.stringify(testMessage));
  req.end();
  
}).on('error', (e) => {
  console.log(`  ✗ 无法连接 n8n: ${e.message}`);
  console.log('  请检查:');
  console.log('  1. n8n 是否正在运行');
  console.log('  2. IP 地址是否正确');
  console.log('  3. 网络是否通畅');
});
