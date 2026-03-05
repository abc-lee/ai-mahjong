# Bug 修复：AI 不出牌问题

## 问题现象

1. 游戏可以开始
2. 但 AI 收到轮次后不出牌
3. 游戏卡住

## 根本原因

经过 Oracle Agent 和 Explore Agent 深度分析，发现以下问题：

### 核心问题：AIAdapter 从未初始化

**Explore Agent 发现**：

`aiManager.initGame(players)` **从未被调用**，导致 AI 玩家没有 adapter。

代码流程问题：
```
handleGameStart() 
  → roomManager.startGame(roomId)
    → gameEngine.startGame(players)
    → ❌ 缺少 aiManager.initGame(players)
  → broadcastGameState()
    → adapter = aiManager.getAdapter(player.id)
    → adapter 为 null → 什么都不做 → 卡住！
```

## 解决方案

在 `handleGameStart` 中添加：

```typescript
// 初始化 AIAdapter（关键修复：确保所有 AI 都有 adapter）
if (gameRoom) {
  aiManager.initGame(gameRoom.players);
  console.log(`[Server] AIAdapter 已初始化，玩家数: ${gameRoom.players.length}`);
}
```

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/server/socket/handlers.ts` | `handleGameStart` 添加 `aiManager.initGame()` |

## 测试验证

```
=== 4 Agent 游戏测试 ===

[紫璃] 创建房间: mmdgniqg-7xeal9cv8
[紫璃] 我是房主，全员已准备，自动开始游戏！
[紫璃] 开始游戏: 成功
[测试员] 轮次: discard, 手牌: 14张
[测试员] 打出: 七万
[紫璃] 轮次: draw, 手牌: 13张
[紫璃] 执行摸牌
[紫璃] 打出: 九万
[白泽] 轮次: draw, 手牌: 13张
...（游戏正常进行）
```

---

*更新时间：2026-03-05*
