#!/bin/bash
# OpenClaw 端轮询脚本
# 用于定期检查来自 OpenCode 的消息

# 配置
N8N_URL="http://192.168.3.19:5678"
AUTH_TOKEN="openclaw_secret_token_change_me"
LAST_TIMESTAMP_FILE="/tmp/openclaw_last_timestamp"

# 获取上次的时间戳
if [ -f "$LAST_TIMESTAMP_FILE" ]; then
  SINCE=$(cat "$LAST_TIMESTAMP_FILE")
else
  SINCE=0
fi

# 轮询消息
echo "轮询 n8n 消息 (since: $SINCE)..."
RESPONSE=$(curl -s -X GET "${N8N_URL}/webhook/openclaw-poll?since=${SINCE}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json")

echo "响应: $RESPONSE"

# 解析响应 (需要 jq)
if command -v jq &> /dev/null; then
  COUNT=$(echo "$RESPONSE" | jq -r '.count // 0')
  TIMESTAMP=$(echo "$RESPONSE" | jq -r '.timestamp // 0')
  
  if [ "$COUNT" -gt 0 ]; then
    echo "收到 $COUNT 条新消息"
    echo "$RESPONSE" | jq -r '.messages[]'
    
    # 更新时间戳
    echo "$TIMESTAMP" > "$LAST_TIMESTAMP_FILE"
  else
    echo "无新消息"
  fi
else
  echo "请安装 jq 以解析 JSON"
fi
