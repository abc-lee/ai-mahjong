# OpenClaw Webhook 端点说明

## 两个端点的区别

### /hooks/wake - 唤醒端点
- 只是触发 heartbeat
- 不直接执行任务
- 返回 `{"ok":true,"mode":"now"}`

### /hooks/agent - Agent 执行端点
- 创建独立的 agent 会话
- 执行消息中的指令
- 需要不同的消息格式

## /hooks/agent 请求格式

```
POST http://127.0.0.1:18789/hooks/agent
Authorization: Bearer openclaw_hooks_token_2026
Content-Type: application/json

{
  "message": "你要执行的任务内容",
  "name": "任务名称",
  "wakeMode": "now"
}
```

## 测试命令

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H "Authorization: Bearer openclaw_hooks_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"message":"测试消息","name":"test","wakeMode":"now"}'
```
