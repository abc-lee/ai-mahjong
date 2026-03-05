# 快速启动指南

## 当前配置

| 服务 | IP | 端口 | 说明 |
|------|-----|------|------|
| n8n | 192.168.3.19 | 5678 | 已确认可访问 |
| OpenClaw | 192.168.3.19 | 18789 | 与 n8n 同一台电脑 |
| OpenCode | 本机 | - | 按需访问 n8n |

## 步骤 1: 在 n8n 中导入工作流

1. 打开浏览器访问 http://192.168.3.19:5678
2. 点击右上角 **Add workflow** 或打开现有工作流
3. 点击菜单 → **Import from File**
4. 选择文件: `n8n/workflows/opencode-to-openclaw.json`
5. 创建认证凭证:
   - 点击任意 Webhook 节点
   - 在 **Authentication** 下选择 **Header Auth**
   - 创建两个凭证:
     - `OpenCode Auth`: Header Name = `Authorization`, Value = `Bearer opencode_secret_token_change_me`
     - `OpenClaw Auth`: Header Name = `Authorization`, Value = `Bearer openclaw_secret_token_change_me`
6. 点击 **Save** 保存工作流
7. 点击右上角开关 **Activate** 激活工作流

## 步骤 2: 在 OpenClaw 中安装 Skill

在 192.168.3.19 电脑上执行:

```bash
# 复制 Skill 到 OpenClaw 的 skills 目录
cp -r n8n/openclaw/skills/n8n-bridge ~/.openclaw/skills/

# 或者在 OpenClaw 中配置
# 编辑 ~/.openclaw/openclaw.json
# 添加 n8n/openclaw/config-example.json 中的内容
```

## 步骤 3: 测试连接

### 从 OpenCode 端测试 (我这端)

```bash
cd E:\game\ai-mahjong\n8n

# 运行测试脚本
node scripts/test-connection.js
```

### 从 OpenClaw 端测试 (192.168.3.19)

```bash
# 测试 n8n webhook 是否正常
curl -X GET "http://127.0.0.1:5678/webhook/openclaw-poll?since=0" \
  -H "Authorization: Bearer openclaw_secret_token_change_me"
```

## 步骤 4: 开始使用

### OpenCode 发送任务

```javascript
const { sendMessage, getResults } = require('./scripts/send-message');

// 发送代码审查请求
await sendMessage({
  action: 'code_review',
  content: '请审查 src/main.ts 的逻辑',
  files: [{ path: 'src/main.ts' }],
  priority: 'high'
});

// 获取结果
const results = await getResults(Date.now() - 60000); // 获取最近1分钟的结果
```

### OpenClaw 处理任务

OpenClaw 会自动轮询 n8n 获取消息，或者通过 webhook 触发。

## 常见问题

### Q: n8n webhook 返回 404

**A**: 工作流未激活或路径错误。检查:
1. 工作流是否已激活 (右上角开关是绿色)
2. webhook 路径是否正确 (`/webhook/opencode-send`)

### Q: 认证失败 (401)

**A**: Token 不匹配。确保:
1. n8n 中的 Header Auth 凭证配置正确
2. 请求头中的 Token 与凭证一致

### Q: 消息没有被 OpenClaw 接收

**A**: 检查:
1. OpenClaw 是否在运行
2. 轮询任务是否启用
3. 手动触发一次轮询测试

## 下一步优化

1. **启用 HTTPS**: 为 n8n 配置 SSL 证书
2. **共享文件夹**: 设置 SMB 共享方便文件传输
3. **监控告警**: 添加连接状态监控
