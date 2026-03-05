# 更新日志

## [2026-03-05] AI Agent 接入基础实现

### 新增

- **PlayerType 类型扩展**: `'human' | 'ai'` → `'human' | 'ai-agent' | 'ai-auto'`
- **Player.aiControl 字段**: 支持 AI Agent 断线降级控制
- **CommandParser**: Agent 指令解析器 (`src/server/prompt/CommandParser.ts`)
- **commands.json**: 指令定义文件 (`src/server/prompt/commands.json`)
- **handleAgentCommand**: 处理 AI Agent 发来的指令
- **agent:command 事件**: 新 Socket 事件，接收 Agent 指令
- **agent:your_turn 事件**: 新 Socket 事件，通知 Agent 轮次

### 修改

- **RoomManager.addAIPlayer**: 支持 `type` 参数区分 ai-agent/ai-auto
- **handleJoinAI**: 支持 `type` 参数
- **broadcastGameState**: 
  - ai-agent: 通过 socket 发送结构化消息
  - ai-agent 断线: 降级到 AIAdapter
  - ai-auto: 使用 AIAdapter
- **兼容性修改**: 4 个文件的 `player.type === 'ai'` 改为 `'ai-agent'`

### 文件清单

| 文件 | 操作 |
|------|------|
| `src/shared/types/player.ts` | 修改 |
| `src/server/room/RoomManager.ts` | 修改 |
| `src/server/socket/handlers.ts` | 修改 |
| `src/server/socket/index.ts` | 修改 |
| `src/client/components/GameBoard/PlayerArea.tsx` | 修改 |
| `src/server/prompt/commands.json` | 新增 |
| `src/server/prompt/CommandParser.ts` | 新增 |
| `docs/ai-agent-integration-design.md` | 新增 |
| `docs/ai-agent-integration-tasks.md` | 新增 |
| `docs/CHANGELOG.md` | 新增 |

### 下一步

- 创建测试脚本验证 Agent 接入
- 启动 4 个 Agent 进行实际打牌测试
