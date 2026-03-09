/**
 * Chat Bridge Server
 * 
 * 连接三方对话：
 * 1. OpenClaw (通过 Gateway WebSocket)
 * 2. 人类用户 (通过浏览器 Socket.IO)
 * 3. OpenCode Agent (通过 HTTP API)
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = 3100;
const GATEWAY_URL = 'ws://192.168.3.19:18789';
const GATEWAY_TOKEN = 'd6ef3364247383e8c8388dce1930bbed9a3a2767bcecfb79';

// ============ Gateway 客户端 (从 openclaw-gateway-client.js 简化) ============

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function derivePublicKeyRaw(publicKeyPemOrDer) {
  let spki;
  if (Buffer.isBuffer(publicKeyPemOrDer)) {
    spki = publicKeyPemOrDer;
  } else {
    const key = crypto.createPublicKey(publicKeyPemOrDer);
    spki = key.export({ type: 'spki', format: 'der' });
  }
  if (spki.length === ED25519_SPKI_PREFIX.length + 32 &&
      spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPemOrDer) {
  const raw = derivePublicKeyRaw(publicKeyPemOrDer);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function base64UrlEncode(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildDeviceAuthPayload(params) {
  const scopes = params.scopes.join(',');
  return [
    'v3', params.deviceId, params.clientId, params.clientMode,
    params.role, scopes, String(params.signedAtMs), params.token,
    params.nonce, params.platform, params.deviceFamily
  ].join('|');
}

function signPayload(privateKeyPem, payload) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);
  return base64UrlEncode(signature);
}

function loadKeyPair() {
  const keyPath = path.join(__dirname, '../scripts/.openclaw-device-key.json');
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  }
  throw new Error('设备密钥不存在，请先运行 openclaw-gateway-client.js');
}

// ============ Gateway 连接类 ============

class GatewayClient {
  constructor(onMessage) {
    this.ws = null;
    this.keyPair = null;
    this.deviceToken = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.onMessage = onMessage;
    this.connected = false;
    this.currentResponse = '';  // 积累当前回复
    this.currentRunId = null;   // 当前 runId
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.keyPair = loadKeyPair();
      console.log('[Gateway] 设备ID:', this.keyPair.deviceId);

      this.ws = new WebSocket(GATEWAY_URL, {
        headers: {
          'Origin': 'http://192.168.3.19:5678'
        }
      });

      this.ws.on('open', () => {
        console.log('[Gateway] WebSocket 已连接');
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          // 详细日志只打印关键信息
          if (msg.type === 'event' && msg.event === 'agent') {
            const p = msg.payload;
            if (p?.stream === 'assistant') {
              const txt = p?.data?.delta || p?.data?.text || '';
              if (txt) console.log('[Gateway] assistant:', txt.substring(0, 60));
            } else if (p?.stream === 'lifecycle') {
              console.log('[Gateway] lifecycle:', p?.data?.phase);
            }
          } else if (msg.type !== 'event') {
            console.log('[Gateway] 收到:', msg.type, JSON.stringify(msg).substring(0, 150));
          }
          this.handleMessage(msg, resolve);
        } catch (e) {
          console.error('[Gateway] 解析消息失败:', e.message);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[Gateway] 错误:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('[Gateway] 连接关闭');
        this.connected = false;
      });
    });
  }

  handleMessage(msg, connectResolve) {
    // 处理 challenge
    if (msg.type === 'challenge' || (msg.type === 'event' && msg.event === 'connect.challenge')) {
      this.handleChallenge(msg.payload, connectResolve);
    } else if (msg.type === 'res') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.ok) {
          pending.resolve(msg.payload);
        } else {
          pending.reject(new Error(msg.error?.message || '请求失败'));
        }
      }
    } else if (msg.type === 'event') {
      const event = msg.event;
      const payload = msg.payload;
      
      if (event === 'agent') {
        const stream = payload?.stream;
        const runId = payload?.runId;
        
        // 生命周期事件
        if (stream === 'lifecycle') {
          const phase = payload?.data?.phase;
          
          if (phase === 'start') {
            // 新回复开始
            this.currentResponse = '';
            this.currentRunId = runId;
            console.log('[Gateway] 开始新回复, runId:', runId?.substring(0, 8));
          } 
          else if (phase === 'end') {
            // 回复结束，发送完整消息
            if (this.currentResponse.trim()) {
              console.log('[Gateway] 回复完成, 长度:', this.currentResponse.length);
              this.onMessage({
                from: 'OpenClaw',
                text: this.currentResponse.trim(),
                timestamp: payload?.ts || Date.now(),
                state: 'complete'
              });
            }
            this.currentResponse = '';
            this.currentRunId = null;
          }
        }
        // assistant 流 - 积累文本
        else if (stream === 'assistant') {
          const delta = payload?.data?.delta || '';
          const fullText = payload?.data?.text || '';
          
          if (fullText) {
            // 完整文本，直接使用
            this.currentResponse = fullText;
          } else if (delta) {
            // 增量文本，积累
            this.currentResponse += delta;
          }
        }
      }
      else if (event === 'chat') {
        // dmScope = main 模式下，回复通过 chat 事件广播
        const state = payload?.state;
        const sessionKey = payload?.sessionKey;
        
        // 详细日志
        console.log('[Gateway] chat event:', JSON.stringify(payload).substring(0, 300));
        
        const message = payload?.message;
        const text = message?.content?.[0]?.text || '';
        
        console.log('[Gateway] chat:', state, sessionKey?.substring(0, 25), 'hasMessage:', !!message, 'textLen:', text.length);
        
        // 只处理主 session 的消息
        if (sessionKey?.startsWith('agent:main:')) {
          if (state === 'delta' && text) {
            this.currentResponse = text;
          } 
          else if (state === 'final' && text) {
            console.log('[Gateway] 收到最终回复, 长度:', text.length);
            this.onMessage({
              from: 'OpenClaw',
              text: text.trim(),
              timestamp: message?.timestamp || Date.now(),
              state: 'complete'
            });
          }
        }
      }
    }
  }

  handleChallenge(payload, connectResolve) {
    const { nonce } = payload;
    const signedAt = Date.now();

    const authPayload = buildDeviceAuthPayload({
      deviceId: this.keyPair.deviceId,
      clientId: 'cli',
      clientMode: 'cli',  // 改成 cli 模式，不走 webchat 外部 fallback
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      signedAtMs: signedAt,
      token: GATEWAY_TOKEN,
      nonce: nonce,
      platform: 'macos',
      deviceFamily: ''
    });

    const signature = signPayload(this.keyPair.privateKey, authPayload);

    this.sendRequest('connect', {
      minProtocol: 3, maxProtocol: 3,
      // 使用 cli 模式，不走 webchat 外部 fallback
      client: { 
        id: 'cli',
        displayName: 'OpenCode',  // 显示名称
        version: '1.0.0', 
        platform: 'macos', 
        mode: 'cli'  // 改成 cli 模式
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      caps: [], commands: [], permissions: {},
      auth: { token: GATEWAY_TOKEN },
      locale: 'zh-CN',
      userAgent: 'chat-bridge/1.0.0',
      device: {
        id: this.keyPair.deviceId,
        nonce: nonce,
        publicKey: this.keyPair.publicKey,
        signature: signature,
        signedAt: signedAt
      }
    }).then(response => {
      console.log('[Gateway] 连接成功！');
      this.deviceToken = response.deviceToken;
      this.connected = true;
      connectResolve(response);
    }).catch(err => {
      console.error('[Gateway] 连接失败:', err.message);
    });
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++this.requestId);
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }

  async chatSend(text) {
    // 使用主 session，dmScope = main 模式
    // 所有对话都进入主 session，主 Agent 能看到历史
    return this.sendRequest('chat.send', {
      message: text,
      idempotencyKey: `chatbridge-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      sessionKey: 'agent:main:main'  // 主 session
    });
  }
}

// ============ Express + Socket.IO 服务器 ============

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// 消息历史
const messageHistory = [];
const MAX_HISTORY = 100;

// Gateway 客户端
let gatewayClient = null;

// 存储等待回复的 Promise（会话模式）
const pendingReplies = new Map();

// 处理会话模式的回复
function handleSessionMessage(msg) {
  if (msg.from === 'OpenClaw' && msg.state === 'complete') {
    const sessionId = 'current';
    const pending = pendingReplies.get(sessionId);
    if (pending) {
      pendingReplies.delete(sessionId);
      pending.resolve(msg.text);
    }
  }
}

// 添加消息到历史
function addMessage(msg) {
  messageHistory.push(msg);
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }
  // 广播给所有浏览器客户端
  io.emit('message', msg);
  // 处理会话模式的回复
  handleSessionMessage(msg);
}

// 初始化 Gateway 连接
async function initGateway() {
  gatewayClient = new GatewayClient((msg) => {
    // 收到 OpenClaw 的消息
    addMessage(msg);
  });

  try {
    await gatewayClient.connect();
    console.log('[Server] Gateway 连接成功');
  } catch (err) {
    console.error('[Server] Gateway 连接失败:', err.message);
  }
}

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// API: 获取历史消息
app.get('/api/history', (req, res) => {
  res.json(messageHistory);
});

// API: OpenCode Agent 发送消息
app.use(express.json());
app.post('/api/send', async (req, res) => {
  const { text, from = 'OpenCode' } = req.body;
  if (!text) {
    return res.status(400).json({ error: '缺少 text 参数' });
  }

  const msg = { from, text, timestamp: Date.now() };
  addMessage(msg);

  // 发送给 OpenClaw
  if (gatewayClient && gatewayClient.connected) {
    try {
      await gatewayClient.chatSend(`[${from}] ${text}`);
    } catch (err) {
      console.error('[Server] 发送到 Gateway 失败:', err.message);
    }
  }

  res.json({ success: true });
});

// ============ 会话模式 API ============
// 用于 OpenCode Agent 的阻塞式对话

// API: 开始会话并发送消息（阻塞等待回复）
app.post('/api/session/chat', async (req, res) => {
  const { text, timeout = 60000 } = req.body;
  if (!text) {
    return res.status(400).json({ error: '缺少 text 参数' });
  }

  if (!gatewayClient?.connected) {
    return res.status(503).json({ error: 'Gateway 未连接' });
  }

  const sessionId = 'current';
  
  // 创建等待回复的 Promise
  const replyPromise = new Promise((resolve, reject) => {
    pendingReplies.set(sessionId, { resolve, reject });
    
    // 超时处理
    setTimeout(() => {
      if (pendingReplies.has(sessionId)) {
        pendingReplies.delete(sessionId);
        reject(new Error('等待回复超时'));
      }
    }, timeout);
  });

  // 发送消息
  try {
    const msg = { from: 'OpenCode', text, timestamp: Date.now() };
    addMessage(msg);
    await gatewayClient.chatSend(`[OpenCode] ${text}`);  // 添加前缀，与 /api/send 一致
    console.log('[Session] 发送消息:', text.substring(0, 50));
  } catch (err) {
    pendingReplies.delete(sessionId);
    return res.status(500).json({ error: '发送失败: ' + err.message });
  }

  // 等待回复
  try {
    const reply = await replyPromise;
    console.log('[Session] 收到回复:', reply.substring(0, 50));
    res.json({ 
      success: true, 
      reply: reply,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(504).json({ error: err.message });
  }
});

// API: 结束会话
app.post('/api/session/end', (req, res) => {
  pendingReplies.clear();
  res.json({ success: true, message: '会话已结束' });
});

// Socket.IO 连接
io.on('connection', (socket) => {
  console.log('[Server] 浏览器客户端连接');
  
  // 发送历史消息
  socket.emit('history', messageHistory);

  socket.on('send', async (data) => {
    const { text } = data;
    if (!text) return;

    const msg = { from: 'User', text, timestamp: Date.now() };
    addMessage(msg);

    // 发送给 OpenClaw
    if (gatewayClient && gatewayClient.connected) {
      try {
        await gatewayClient.chatSend(`[User] ${text}`);
      } catch (err) {
        console.error('[Server] 发送到 Gateway 失败:', err.message);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('[Server] 浏览器客户端断开');
  });
});

// 启动服务器
httpServer.listen(PORT, async () => {
  console.log(`[Server] Chat Bridge 运行在 http://localhost:${PORT}`);
  console.log('[Server] 正在连接 Gateway...');
  await initGateway();
});
