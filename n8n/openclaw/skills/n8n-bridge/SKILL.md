---
name: n8n-bridge
description: 与 OpenCode 通过 n8n 进行协作通信
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["curl"] },
        "user-invocable": true
      }
  }
---

# n8n Bridge Skill

这个 Skill 让 OpenClaw 能够与 OpenCode 通过 n8n 中转站进行协作通信。

## 配置

在 `~/.openclaw/openclaw.json` 中添加以下配置：

```json5
{
  skills: {
    entries: {
      "n8n-bridge": {
        enabled: true,
        config: {
          n8nUrl: "http://192.168.1.xxx:5678",
          authToken: "YOUR_AUTH_TOKEN_HERE"
        }
      }
    }
  }
}
```

## 可用操作

### 1. 轮询获取消息

定期检查来自 OpenCode 的消息：

```bash
# 使用 curl 轮询
curl -X GET "http://<n8n-ip>:5678/webhook/openclaw-poll?since=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. 发送响应

处理完消息后，发送结果回 n8n：

```bash
curl -X POST "http://<n8n-ip>:5678/webhook/openclaw-response" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "msg_xxx",
    "data": {
      "status": "completed",
      "result": "任务执行结果..."
    }
  }'
```

### 3. 主动发送消息

向 OpenCode 发送消息：

```bash
curl -X POST "http://<n8n-ip>:567n/webhook/openclaw-message" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "question",
    "content": "需要确认的问题..."
  }'
```

## 文件传输

### 接收文件

如果消息包含文件路径，从共享文件夹获取：

```
共享路径: \\<n8n-ip>\n8nshare
```

### 发送文件

将文件放入共享文件夹，然后在消息中引用路径。

## 消息格式

### 来自 OpenCode 的消息格式

```json
{
  "id": "msg_xxx",
  "timestamp": 1234567890,
  "data": {
    "action": "code_review | file_edit | question | command",
    "content": "具体内容",
    "files": [
      {
        "path": "相对路径",
        "action": "read | write | delete"
      }
    ],
    "priority": "high | normal | low"
  }
}
```

### OpenClaw 响应格式

```json
{
  "messageId": "msg_xxx",
  "data": {
    "status": "completed | failed | need_info",
    "result": "执行结果",
    "files": [
      {
        "path": "生成的文件路径"
      }
    ],
    "questions": ["需要确认的问题"]
  }
}
```

## 定时任务

可以在 OpenClaw 中配置定时轮询：

```json5
{
  automation: {
    cron: {
      "n8n-poll": {
        enabled: true,
        schedule: "*/30 * * * * *",  // 每30秒
        action: "poll_n8n"
      }
    }
  }
}
```

## 故障处理

1. **连接失败**: 检查网络连接和 IP 地址
2. **认证失败**: 检查 Token 是否正确
3. **消息丢失**: 检查 n8n 工作流是否正常运行
