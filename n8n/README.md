# N8N 与 OpenClaw 协作桥接方案

## 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                    192.168.3.19 (同一台电脑)                      │
│  ┌─────────────────────┐          ┌─────────────────────┐        │
│  │     OpenClaw        │◄────────►│        n8n          │        │
│  │   (24h 在线)         │  本地连接 │     (中转站)        │        │
│  │   Port: 18789       │          │  Port: 5678         │        │
│  └─────────────────────┘          └──────────┬──────────┘        │
└──────────────────────────────────────────────│───────────────────┘
                                               │
                                               │ 局域网 HTTP
                                               │
                                      ┌────────▼──────────┐
                                      │     OpenCode      │
                                      │    (我这端)        │
                                      │   按需发起请求     │
                                      │   IP: 本机        │
                                      └───────────────────┘
```

## 通信流程

### 场景 1: OpenCode 发送任务给 OpenClaw

```
1. OpenCode → n8n (POST /webhook/opencode-send)
2. n8n 存储消息到队列
3. OpenClaw 轮询 n8n (GET /webhook/openclaw-poll)
4. OpenClaw 执行任务
5. OpenClaw → n8n (POST /webhook/openclaw-response)
6. n8n 存储结果
7. OpenCode 获取结果 (GET /webhook/opencode-result)
```

### 场景 2: OpenClaw 主动汇报

```
1. OpenClaw → n8n (POST /webhook/openclaw-message)
2. n8n 存储消息
3. OpenCode 获取消息 (GET /webhook/opencode-receive)
```

## 目录结构

```
n8n/
├── README.md                    # 本文档
├── config/
│   └── settings.json.example    # 配置模板
├── workflows/
│   ├── opencode-to-openclaw.json    # 工作流: OpenCode → OpenClaw
│   ├── openclaw-to-opencode.json    # 工作流: OpenClaw → OpenCode
│   └── file-transfer.json           # 工作流: 文件传输
├── openclaw/
│   ├── skills/
│   │   └── n8n-bridge/          # OpenClaw Skill
│   │       └── SKILL.md
│   └── config-example.json      # OpenClaw 配置示例
└── scripts/
    ├── send-message.js          # 发送消息脚本
    └── get-messages.js          # 获取消息脚本
```

## 快速开始

### 步骤 1: 配置 n8n

1. 导入工作流 JSON 到 n8n
2. 配置认证 Token
3. 激活工作流

### 步骤 2: 配置 OpenClaw

1. 将 `openclaw/skills/n8n-bridge` 复制到 OpenClaw 的 skills 目录
2. 修改 OpenClaw 配置文件，添加 webhook
3. 重启 OpenClaw

### 步骤 3: 测试连接

```bash
# 从 OpenCode 端发送测试消息
node scripts/send-message.js --test
```

## 文件传输方案

由于在同一局域网，推荐使用共享文件夹方式：

### 方案 A: SMB 共享 (推荐)

```bash
# Windows 创建共享文件夹
net share n8nshare=E:\game\ai-mahjong\n8n\shared /grant:everyone,full

# OpenClaw 端访问
\\<n8n-ip>\n8nshare
```

### 方案 B: n8n 临时存储

小文件通过 Base64 编码直接传输，大文件通过 n8n 临时存储后提供下载链接。

## 安全配置

1. 所有 webhook 端点需要 Bearer Token 认证
2. 建议使用 HTTPS (自签名证书或内网 CA)
3. 限制访问 IP 范围

## 下一步

1. 填写 `config/settings.json` 中的 IP 地址
2. 在 n8n 中导入工作流
3. 在 OpenClaw 中安装 Skill
