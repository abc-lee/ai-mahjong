/**
 * OpenCode 端发送消息脚本
 * 用于向 OpenClaw 发送任务和消息
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 加载配置
const configPath = path.join(__dirname, '..', 'config', 'settings.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('无法加载配置文件，使用默认配置');
  config = {
    network: { n8n: { baseUrl: 'http://192.168.3.19:5678' } },
    auth: { opencodeToken: 'opencode_secret_token_change_me' }
  };
}

const N8N_BASE_URL = config.network.n8n.baseUrl;
const AUTH_TOKEN = config.auth.opencodeToken;

/**
 * 发送消息到 n8n
 * @param {Object} message - 消息内容
 * @returns {Promise<Object>} - 响应结果
 */
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_BASE_URL}/webhook/opencode-send`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(message));
    req.end();
  });
}

/**
 * 获取 OpenClaw 的响应结果
 * @param {number} since - 时间戳，获取此时间之后的结果
 * @returns {Promise<Object>} - 结果列表
 */
async function getResults(since = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${N8N_BASE_URL}/webhook/opencode-result`);
    url.searchParams.set('since', since.toString());
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 发送代码审查请求
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {string} instruction - 审查指令
 */
async function requestCodeReview(filePath, content, instruction = '') {
  return sendMessage({
    action: 'code_review',
    content: instruction || `请审查文件 ${filePath}`,
    files: [{ path: filePath, content: content }],
    priority: 'normal'
  });
}

/**
 * 发送文件编辑请求
 * @param {string} filePath - 文件路径
 * @param {string} instruction - 编辑指令
 */
async function requestFileEdit(filePath, instruction) {
  return sendMessage({
    action: 'file_edit',
    content: instruction,
    files: [{ path: filePath, action: 'write' }],
    priority: 'normal'
  });
}

/**
 * 发送问题
 * @param {string} question - 问题内容
 */
async function askQuestion(question) {
  return sendMessage({
    action: 'question',
    content: question,
    priority: 'normal'
  });
}

/**
 * 发送命令
 * @param {string} command - 命令内容
 */
async function sendCommand(command) {
  return sendMessage({
    action: 'command',
    content: command,
    priority: 'high'
  });
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    console.log('发送测试消息...');
    sendMessage({ action: 'test', content: 'Hello from OpenCode!' })
      .then(result => {
        console.log('发送成功:', result);
        return getResults(0);
      })
      .then(results => {
        console.log('当前结果:', results);
      })
      .catch(err => {
        console.error('发送失败:', err.message);
      });
  } else if (args.includes('--poll')) {
    console.log('轮询结果...');
    getResults(0)
      .then(results => {
        console.log('结果:', JSON.stringify(results, null, 2));
      })
      .catch(err => {
        console.error('轮询失败:', err.message);
      });
  } else if (args.length > 0) {
    // 直接发送消息
    const message = args.join(' ');
    console.log(`发送消息: ${message}`);
    sendMessage({ action: 'message', content: message })
      .then(result => console.log('结果:', result))
      .catch(err => console.error('错误:', err.message));
  } else {
    console.log(`
用法:
  node send-message.js --test         发送测试消息
  node send-message.js --poll         轮询获取结果
  node send-message.js <消息内容>      发送自定义消息

示例:
  node send-message.js --test
  node send-message.js "请帮我检查代码"
`);
  }
}

module.exports = {
  sendMessage,
  getResults,
  requestCodeReview,
  requestFileEdit,
  askQuestion,
  sendCommand
};
