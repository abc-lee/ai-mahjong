# Chat Bridge - OpenCode ↔ OpenClaw 协作通道

> 让 OpenCode 会话能够与 OpenClaw (紫璃) 进行实时对话协作

---

## 我是 OpenCode，我怎么连接？

### 第一步：检查 Chat Bridge 是否运行

```bash
curl -s http://localhost:3100/api/history
```

- **返回 JSON 数组** → 已运行，跳到第三步
- **连接失败** → 需要启动，继续第二步

### 第二步：启动 Chat Bridge

```bash
# 后台启动
cd E:\game\ai-mahjong\n8n\chat-bridge
start /b node server.js

# 等待 3 秒后确认
ping -n 4 127.0.0.1 >nul && curl -s http://localhost:3100/api/history
```

### 第三步：与 OpenClaw 对话

```bash
curl -X POST http://localhost:3100/api/session/chat \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"你好 OpenClaw\",\"timeout\":30000}"
```

**返回示例**：
```json
{"success":true,"reply":"你好！有什么可以帮你的？","timestamp":1234567890}
```

---

## 我是 AI，我推荐用 Node.js 调用

直接用 Node.js 发 HTTP 请求，更可靠：

```javascript
// 调用 Chat Bridge 与 OpenClaw 对话
function chatWithOpenClaw(text, timeout = 60000) {
  const http = require('http');
  const data = JSON.stringify({ text, timeout });
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3100,
      path: '/api/session/chat',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const result = JSON.parse(body);
        result.success ? resolve(result.reply) : reject(new Error(result.error));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 使用
chatWithOpenClaw('帮我查一下当前目录').then(console.log);
```

---

## 前置条件

**OpenClaw (紫璃) 必须在运行**：
- OpenClaw 是一台电脑上的 24 小时在线 AI 助手
- 位置：`192.168.3.19:18789`
- 如果 OpenClaw 没运行，Chat Bridge 会连接失败

---

## 注意事项

1. **Chat Bridge 需要先启动** - 在与 OpenClaw 对话前确认服务运行
2. **OpenClaw 在 192.168.3.19** - 是你同一台电脑上的另一个 AI
3. **超时设置** - 复杂任务（搜索、执行命令）需要更长的 timeout
4. **不要全局杀 node 进程** - 会把 OpenClaw 也杀掉

---

## 文件位置

```
E:\game\ai-mahjong\n8n\chat-bridge\
├── server.js      # 后端服务
├── README.md      # 本文档
└── public/        # 前端界面（浏览器访问 http://localhost:3100）
```

---

## 详细文档

完整技术文档见：`../HANDOFF.md`

---

*给 OpenCode 会话的协作指南*
