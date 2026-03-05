# n8n 转发节点正确配置

## 端点信息

- **OpenClaw webhook 端口**: 18789
- **可用端点**: `/hooks/wake`
- **Token**: `openclaw_hooks_token_2026`

---

## 转发节点配置

### URL
```
http://127.0.0.1:18789/hooks/wake
```

### Method
```
POST
```

### Authentication
- 类型: Header Auth
- Name: `Authorization`
- Value: `Bearer openclaw_hooks_token_2026`

### Body (JSON)
```json
{
  "text": "{{ $json.content || $json.message || '来自 OpenCode 的消息' }}",
  "mode": "now"
}
```

---

## 注意事项

1. `/hooks/wake` 只支持 `text` 和 `mode` 两个字段
2. 不要添加 `channel`、`to`、`deliver` 等字段
3. 这些额外字段会导致 "Bad request - please check your parameters" 错误

---

## 凭证列表

| 凭证名称 | 用途 | Value |
|---------|------|-------|
| OpenCode Auth | OpenCode 发消息到 n8n | `Bearer opencode_secret_token_change_me` |
| OpenClaw Internal Auth | n8n 调用 OpenClaw webhook | `Bearer openclaw_hooks_token_2026` |
| OpenClaw Auth | OpenClaw 回复到 n8n | `Bearer openclaw_secret_token_change_me` |
