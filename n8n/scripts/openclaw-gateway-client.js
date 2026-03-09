/**
 * OpenClaw Gateway WebSocket 客户端
 * 支持设备签名认证
 */

const WebSocket = require('ws');
const crypto = require('crypto');

const GATEWAY_URL = 'ws://192.168.3.19:18789';
const GATEWAY_TOKEN = 'd6ef3364247383e8c8388dce1930bbed9a3a2767bcecfb79';

// ED25519 公钥在 SPKI DER 格式中的固定前缀 (12 字节)
// 格式: 30 2a 30 05 06 03 2b 65 70 03 21 00 + 32字节原始公钥
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * 从 SPKI DER 格式中提取 ED25519 公钥的原始 32 字节
 * 参考: OpenClaw src/infra/device-identity.ts derivePublicKeyRaw()
 */
function derivePublicKeyRaw(publicKeyPemOrDer) {
  let spki;
  if (Buffer.isBuffer(publicKeyPemOrDer)) {
    spki = publicKeyPemOrDer;
  } else {
    // PEM 格式，需要转换为 DER
    const key = crypto.createPublicKey(publicKeyPemOrDer);
    spki = key.export({ type: 'spki', format: 'der' });
  }
  
  // 检查是否是 ED25519 SPKI 格式
  if (spki.length === ED25519_SPKI_PREFIX.length + 32 &&
      spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    // 提取原始 32 字节公钥
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  
  // 不是标准格式，返回整个 DER
  console.warn('警告: 公钥格式不符合 ED25519 SPKI 标准');
  return spki;
}

/**
 * 计算公钥指纹 (设备 ID)
 * 参考: OpenClaw src/infra/device-identity.ts fingerprintPublicKey()
 */
function fingerprintPublicKey(publicKeyPemOrDer) {
  const raw = derivePublicKeyRaw(publicKeyPemOrDer);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Base64URL 编码 (参考 OpenClaw 源码)
function base64UrlEncode(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// 生成或加载设备密钥对
function getOrCreateKeyPair() {
  const fs = require('fs');
  const path = require('path');
  const keyPath = path.join(__dirname, '.openclaw-device-key.json');
  
  if (fs.existsSync(keyPath)) {
    const existing = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    // 重新计算设备 ID 以确保正确 - 注意：不需要 'device:' 前缀！
    const correctDeviceId = fingerprintPublicKey(existing.publicKey);
    
    if (existing.deviceId !== correctDeviceId) {
      console.log('修正设备 ID:', existing.deviceId, '->', correctDeviceId);
      existing.deviceId = correctDeviceId;
      fs.writeFileSync(keyPath, JSON.stringify(existing, null, 2));
    }
    
    console.log('加载已有设备密钥对, deviceId:', existing.deviceId);
    return existing;
  }
  
  // 生成新的 Ed25519 密钥对
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  
  // 从公钥派生设备 ID（指纹）- 使用原始 32 字节，不需要前缀
  const deviceId = fingerprintPublicKey(publicKeyPem);
  
  const keyPair = {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    deviceId: deviceId
  };
  
  fs.writeFileSync(keyPath, JSON.stringify(keyPair, null, 2));
  console.log('生成新设备密钥对');
  console.log('  deviceId:', deviceId);
  
  return keyPair;
}

// 构建设备认证 payload (参考 OpenClaw buildDeviceAuthPayloadV3)
function buildDeviceAuthPayload(params) {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = params.platform ?? '';
  const deviceFamily = params.deviceFamily ?? '';
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');
}

// 签名 payload - 使用 base64url 编码 (参考 OpenClaw signDevicePayload)
function signPayload(privateKeyPem, payload) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);
  return base64UrlEncode(signature);
}

class OpenClawGateway {
  constructor() {
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.keyPair = getOrCreateKeyPair();
  }

  connect() {
    return new Promise((resolve, reject) => {
      // 添加 origin header
      this.ws = new WebSocket(GATEWAY_URL, {
        headers: {
          'Origin': 'http://192.168.3.19:5678'
        }
      });
      this.connectResolve = resolve;
      this.connectReject = reject;
      
      this.ws.on('open', () => {
        console.log('WebSocket 连接已建立，等待 challenge...');
      });
      
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (e) {
          console.error('解析消息失败:', e);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket 错误:', error.message);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('WebSocket 连接已关闭');
      });
    });
  }
  
  handleChallenge(challengePayload) {
    const { nonce, ts } = challengePayload;
    console.log('收到 challenge，nonce:', nonce);
    
    const signedAt = Date.now();
    
    // 构建设备认证 payload (V3 格式)
    const authPayload = buildDeviceAuthPayload({
      deviceId: this.keyPair.deviceId,
      clientId: 'cli',
      clientMode: 'webchat',
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      signedAtMs: signedAt,
      token: GATEWAY_TOKEN,
      nonce: nonce,
      platform: 'macos',
      deviceFamily: ''
    });
    
    // 签名 payload
    const signature = signPayload(this.keyPair.privateKey, authPayload);
    
    console.log('设备 ID:', this.keyPair.deviceId);
    console.log('Auth Payload:', authPayload);
    console.log('签名已生成');
    
    this.sendRequest('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'cli',
        version: '1.0.0',
        platform: 'macos',
        mode: 'webchat'
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      caps: [],
      commands: [],
      permissions: {},
      auth: { token: GATEWAY_TOKEN },
      locale: 'zh-CN',
      userAgent: 'openclaw-cli/1.0.0',
      device: {
        id: this.keyPair.deviceId,
        nonce: nonce,
        publicKey: this.keyPair.publicKey,
        signature: signature,
        signedAt: signedAt
      }
    }).then(response => {
      console.log('连接成功:', JSON.stringify(response, null, 2));
      if (this.connectResolve) {
        this.connectResolve(response);
      }
    }).catch(err => {
      console.error('连接失败:', err.message);
      if (this.connectReject) {
        this.connectReject(err);
      }
    });
  }

  handleMessage(msg) {
    if (msg.type === 'res' && msg.id) {
      const callback = this.pendingRequests.get(msg.id);
      if (callback) {
        this.pendingRequests.delete(msg.id);
        if (msg.ok) {
          callback.resolve(msg.payload);
        } else {
          callback.reject(new Error(JSON.stringify(msg.error) || '请求失败'));
        }
      }
    } else if (msg.type === 'event') {
      console.log('收到事件:', msg.event);
      
      if (msg.event === 'connect.challenge') {
        this.handleChallenge(msg.payload);
      }
    }
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = `req_${++this.requestId}`;
      const request = {
        type: 'req',
        id: id,
        method: method,
        params: params
      };
      
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(request));
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('请求超时'));
        }
      }, 30000);
    });
  }

  async   chatSend(text, sessionKey = 'main') {
    return this.sendRequest('chat.send', {
      message: text,
      idempotencyKey: `openclaw-cli-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      sessionKey: sessionKey
    });
  }

  async chatHistory(sessionKey = 'main', limit = 50) {
    return this.sendRequest('chat.history', {
      sessionKey: sessionKey,
      limit: limit
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 测试
async function test() {
  const client = new OpenClawGateway();
  
  try {
    console.log('正在连接 OpenClaw Gateway...');
    await client.connect();
    
    console.log('\n发送测试消息...');
    const sendResult = await client.chatSend('你好 OpenClaw！我是 OpenCode，通过 Gateway WebSocket 连接测试。收到请回复！');
    console.log('发送结果:', JSON.stringify(sendResult, null, 2));
    
    console.log('\n等待 3 秒后获取历史...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('\n获取聊天历史...');
    const history = await client.chatHistory();
    console.log('历史消息:', JSON.stringify(history, null, 2));
    
  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    client.close();
  }
}

if (require.main === module) {
  test();
}

module.exports = OpenClawGateway;
