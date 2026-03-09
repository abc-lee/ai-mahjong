# Chat Bridge 完整实现文档

## 一、这是什么

**Chat Bridge** 是一个让 OpenCode 会话能够与 OpenClaw (紫璃) 进行实时对话的桥梁服务。

```
OpenCode (你这端) <--HTTP/WebSocket--> Chat Bridge (localhost:3100) <--WebSocket--> OpenClaw Gateway (192.168.3.19:18789)
```

---

## 二、为什么能工作（核心原理）

### 问题背景

OpenClaw 有多个回复路由渠道（iMessage、Telegram 等）。当 Chat Bridge 发消息时，OpenClaw 默认把回复路由到 `lastChannel`（上次使用的渠道，比如 iMessage）。

### 解决方案

让 OpenClaw 认为这是 **webchat 内部对话**，回复通过 `agent` 事件返回，而不是路由到外部渠道。

### 关键源码逻辑

在 `dispatch-from-config.ts` 中：

```javascript
// 第 218-221 行：判断是否是 webchat 内部对话
const isInternalWebchatTurn =
  currentSurface === INTERNAL_MESSAGE_CHANNEL &&  // 当前是 webchat
  (surfaceChannel === INTERNAL_MESSAGE_CHANNEL || !surfaceChannel) &&
  ctx.ExplicitDeliverRoute !== true;  // 关键！不能有 deliver: true

// 第 222-227 行：决定回复路由
const shouldRouteToOriginating = Boolean(
  !isInternalWebchatTurn &&  // 如果是 webchat 内部对话，这里是 false
  isRoutableChannel(originatingChannel) &&
  originatingTo &&
  originatingChannel !== currentSurface,
);

// 第 476-478 行：根据 shouldRouteToOriginating 决定发送方式
if (shouldRouteToOriginating) {
  await sendPayloadAsync(...);  // 发送到外部渠道（iMessage）
} else {
  dispatcher.sendFinalReply(...);  // 发送 agent 事件（Chat Bridge 收到）
}
```

### 成功条件

| 条件 | 值 | 说明 |
|------|-----|------|
| `sessionKey` | `agent:main:dm:chatbridge` | 包含 `dm`，被识别为 direct 类型 |
| `deliver` | **不传** | 让 `ExplicitDeliverRoute = false` |
| `Origin` | `http://192.168.3.19:5678` | Gateway 允许的 Origin |

---

## 三、代码实现详解

### 1. Gateway 连接 (server.js)

```javascript
// 连接 Gateway
this.ws = new WebSocket('ws://192.168.3.19:18789', {
  headers: { 'Origin': 'http://192.168.3.19:5678' }
});

// 处理认证 challenge
handleChallenge(payload, connectResolve) {
  // 使用设备密钥签名
  const signature = signPayload(this.keyPair.privateKey, authPayload);
  
  // 发送连接请求
  this.sendRequest('connect', {
    role: 'operator',  // operator 角色
    scopes: ['operator.read', 'operator.write'],
    auth: { token: GATEWAY_TOKEN },  // Token 在下方
    device: { id, nonce, publicKey, signature, signedAt }
  });
}
```

### 2. 发送消息

```javascript
async chatSend(text) {
  return this.sendRequest('chat.send', {
    message: text,
    idempotencyKey: `chatbridge-${Date.now()}-${random}`,
    sessionKey: 'agent:main:dm:chatbridge'
    // 注意：没有 deliver: true！
  });
}
```

### 3. 接收回复

```javascript
handleMessage(msg) {
  if (msg.type === 'event' && msg.event === 'agent') {
    const stream = msg.payload?.stream;
    
    if (stream === 'lifecycle') {
      const phase = msg.payload?.data?.phase;
      if (phase === 'start') this.currentResponse = '';
      if (phase === 'end') {
        // 回复完成，发送完整消息
        this.onMessage({ from: 'OpenClaw', text: this.currentResponse });
      }
    }
    
    if (stream === 'assistant') {
      // 积累回复内容
      const delta = msg.payload?.data?.delta || '';
      const fullText = msg.payload?.data?.text || '';
      if (fullText) this.currentResponse = fullText;
      else if (delta) this.currentResponse += delta;
    }
  }
}
```

### 4. 会话模式 API

```javascript
// 阻塞式等待回复
app.post('/api/session/chat', async (req, res) => {
  const { text, timeout = 60000 } = req.body;
  
  // 创建等待 Promise
  const replyPromise = new Promise((resolve, reject) => {
    pendingReplies.set('current', { resolve, reject });
    setTimeout(() => reject(new Error('超时')), timeout);
  });
  
  // 发送消息
  await gatewayClient.chatSend(text);
  
  // 等待回复
  const reply = await replyPromise;
  res.json({ success: true, reply });
});

// 当收到 OpenClaw 完整回复时，resolve Promise
function handleSessionMessage(msg) {
  if (msg.from === 'OpenClaw' && msg.state === 'complete') {
    const pending = pendingReplies.get('current');
    if (pending) {
      pending.resolve(msg.text);
    }
  }
}
```

---

## 四、配置信息

### Gateway 连接
```
URL: ws://192.168.3.19:18789
Token: d6ef3364247383e8c8388dce1930bbed9a3a2767bcecfb79
Origin: http://192.168.3.19:5678
```

### 设备密钥
```
位置: n8n/scripts/.openclaw-device-key.json
```

### Chat Bridge 服务
```
端口: 3100
前端: http://localhost:3100
API: http://localhost:3100/api/session/chat
```

---

## 五、文件结构

```
E:\game\ai-mahjong\n8n\
├── chat-bridge\
│   ├── server.js        # 后端服务（核心实现）
│   ├── package.json     # 依赖：express, socket.io, ws
│   ├── README.md        # 快速指南
│   └── public\
│       └── index.html   # 前端界面
│
├── scripts\
│   └── .openclaw-device-key.json  # 设备密钥
│
├── openclaw-src\        # OpenClaw 源码（参考）
│   └── src\
│       ├── auto-reply\reply\
│       │   ├── dispatch-from-config.ts  # 回复路由逻辑
│       │   └── session-delivery.ts      # session channel 解析
│       ├── gateway\
│       │   └── server-methods\chat.ts   # chat.send 处理
│       └── sessions\
│           └── session-key-utils.ts     # sessionKey 解析
│
└── HANDOFF.md           # 本文档
```

---

## 六、使用方法

### 启动 Chat Bridge
```bash
cd E:\game\ai-mahjong\n8n\chat-bridge
node server.js
```

### 会话模式 API
```bash
curl -X POST http://localhost:3100/api/session/chat \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"你好 OpenClaw\",\"timeout\":30000}"
```

### 浏览器界面
打开 http://localhost:3100

---

## 七、常见问题

### Q: 回复去了 iMessage 而不是 Chat Bridge？
A: 检查 `sessionKey` 是否包含 `dm`，并且没有传 `deliver: true`。

### Q: Gateway 连接被拒绝？
A: 检查 `Origin` header 是否正确（`http://192.168.3.19:5678`）。

### Q: 收到 lifecycle 但没有 assistant？
A: OpenClaw 的 `runCliAgent` 返回了空内容，可能是 OpenClaw 端的问题。

### Q: 超时？
A: 增加 `timeout` 参数（默认 60000ms）。

---

## 八、关键点总结

1. **sessionKey 必须包含 `dm`** → 被识别为 direct 类型
2. **不能传 `deliver: true`** → 让 `ExplicitDeliverRoute = false`
3. **Origin 必须正确** → Gateway 允许的 Origin
4. **监听 agent 事件** → 通过 `assistant` stream 接收回复
5. **积累 delta** → 回复是流式的，需要积累

---

*文档版本: v2.0*
*更新时间: 2026-03-06*
*状态: ✅ 工作正常*
