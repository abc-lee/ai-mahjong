# AI Agent Prompt 设计文档

> 版本：v1.0  
> 更新时间：2026-03-04  
> 目的：定义游戏服务器与 AI Agent 之间的文本通信协议

---

## 1. 设计原则

### 1.1 核心原则

1. **完整信息**：AI Agent 收到的 Prompt 必须包含做决策所需的全部信息
2. **结构化输出**：AI Agent 必须返回结构化的 JSON，便于服务器解析
3. **错误处理**：服务器必须验证 AI 的返回，处理非法操作
4. **上下文保持**：每条 Prompt 包含必要的游戏上下文

### 1.2 与人类玩家的区别

| 维度 | 人类玩家 | AI Agent |
|------|---------|----------|
| 接收方式 | 图形界面（视觉） | 文本 Prompt |
| 返回方式 | 点击按钮/牌 | JSON 格式指令 |
| 错误反馈 | UI 提示（按钮变灰等） | 文本错误消息 |
| 超时处理 | 自动操作 | 默认行为 |

---

## 2. Prompt 类型总览

| 类型 | 触发时机 | 目的 |
|------|---------|------|
| `GAME_START` | 游戏开始 | 告知 AI 初始状态和角色 |
| `YOUR_TURN_DRAW` | 轮到摸牌 | 提示 AI 可以摸牌 |
| `YOUR_TURN_DISCARD` | 轮到打牌 | 提示 AI 需要打出一张牌 |
| `ACTION_REQUIRED` | 可以吃碰杠胡 | 让 AI 选择操作 |
| `ACTION_RESULT` | 操作结果反馈 | 告知 AI 操作成功/失败 |
| `OTHER_PLAYER_ACTION` | 其他玩家操作 | 告知 AI 游戏进展 |
| `GAME_END` | 游戏结束 | 告知 AI 结果 |

---

## 3. Prompt 详细设计

### 3.1 GAME_START - 游戏开始

**触发时机**：游戏开始时，发给每个 AI Agent

**Prompt 模板**：

```
【游戏开始】

你是本次麻将游戏的玩家之一。
- 你的名字：{playerName}
- 你的位置：{position} (0=东, 1=南, 2=西, 3=北)
- 你是否是庄家：{isDealer}

其他玩家：
{otherPlayers}

你的初始手牌（{handCount}张）：
{handTiles}

游戏规则提示：
- 每人13张起手，庄家14张
- 轮流摸牌、打牌
- 可以吃、碰、杠、胡

准备开始！等待你的回合...
```

**示例**：

```
【游戏开始】

你是本次麻将游戏的玩家之一。
- 你的名字：紫璃
- 你的位置：0 (东, 庄家)
- 你是否是庄家：是

其他玩家：
- 位置1(南)：小红
- 位置2(西)：老王
- 位置3(北)：玩家小明

你的初始手牌（14张）：
一万、二万、三万、四万、五万、六万、七万、八万、九万、一条、二条、三条、四条、五条

游戏规则提示：
- 每人13张起手，庄家14张
- 轮流摸牌、打牌
- 可以吃、碰、杠、胡

准备开始！等待你的回合...
```

---

### 3.2 YOUR_TURN_DRAW - 轮到摸牌

**触发时机**：轮到 AI 摸牌时

**Prompt 模板**：

```
【你的回合 - 摸牌阶段】

当前游戏状态：
- 剩余牌数：{wallRemaining}张
- 当前玩家：你（{position}）
- 上家打出的牌：{lastDiscard}（玩家：{lastDiscardPlayer}）

你的手牌（{handCount}张）：
{handTiles}

你需要执行的操作：摸牌

请发送指令：
{
  "action": "draw"
}
```

---

### 3.3 YOUR_TURN_DISCARD - 轮到打牌

**触发时机**：AI 摸牌后，需要打出一张牌

**Prompt 模板**：

```
【你的回合 - 打牌阶段】

你刚才摸到的牌：{drawnTile}

你现在的手牌（{handCount}张）：
{handTiles}

你需要打出一张牌。

请发送指令：
{
  "action": "discard",
  "tile": "要打出的牌的ID"
}

例如：
{
  "action": "discard",
  "tile": "wan-5-12"
}
```

**示例**：

```
【你的回合 - 打牌阶段】

你刚才摸到的牌：五条

你现在的手牌（14张）：
一万[id:wan-1-0]、二万[id:wan-2-1]、三万[id:wan-3-2]、四万[id:wan-4-3]、
五万[id:wan-5-4]、六万[id:wan-6-5]、七万[id:wan-7-6]、八万[id:wan-8-7]、
九万[id:wan-9-8]、一条[id:tiao-1-20]、二条[id:tiao-2-21]、三条[id:tiao-3-22]、
四条[id:tiao-4-23]、五条[id:tiao-5-24]

你需要打出一张牌。

请发送指令：
{
  "action": "discard",
  "tile": "要打出的牌的ID"
}
```

---

### 3.4 ACTION_REQUIRED - 可以吃碰杠胡

**触发时机**：其他玩家打出牌后，AI 可以进行操作

**Prompt 模板**：

```
【操作选择】

玩家 {lastDiscardPlayer} 打出了：{lastDiscard}

你可以进行的操作：
{availableActions}

你的手牌（{handCount}张）：
{handTiles}

请选择一个操作，发送指令：
{
  "action": "chi|peng|gang|hu|pass",
  "tiles": ["相关牌ID"] // 仅 chi/peng/gang 需要
}
```

**示例（可以吃）**：

```
【操作选择】

玩家 老王 打出了：七条

你可以进行的操作：
- chi（吃）：用 六条、八条 组成顺子

你的手牌（13张）：
一万、二万、三万、四万、五万、六条[id:tiao-6-30]、七万、八条[id:tiao-8-32]、九万、一条、二条、三条、四条

请选择一个操作，发送指令：
{
  "action": "chi",
  "tiles": ["tiao-6-30", "tiao-8-32"]
}

或者跳过：
{
  "action": "pass"
}
```

**示例（可以胡）**：

```
【操作选择】

玩家 小红 打出了：五万

你可以进行的操作：
- hu（胡）：胡牌！

你的手牌（13张）：
一万、二万、三万、四万、五万(已有2张)、六万、七万、八万、九万、一条、二条、三条、四条

请选择一个操作，发送指令：
{
  "action": "hu"
}
```

---

### 3.5 ACTION_RESULT - 操作结果反馈

**成功**：

```
【操作成功】

你成功执行了：{action}
{additionalInfo}

游戏继续...
```

**失败**：

```
【操作失败】

你尝试执行：{action}
失败原因：{reason}

请重新选择操作。
```

**示例**：

```
【操作失败】

你尝试执行：discard
失败原因：这张牌不在你的手中

请重新选择操作。可用牌：
一万[id:wan-1-0]、二万[id:wan-2-1]...
```

---

### 3.6 OTHER_PLAYER_ACTION - 其他玩家操作

**触发时机**：其他玩家（包括其他 AI）执行操作后

**Prompt 模板**：

```
【游戏进展】

玩家 {playerName}（{position}）执行了操作：
- {action}
{additionalInfo}

当前牌桌状态：
- 牌墙剩余：{wallRemaining}张
- 你的手牌：{handCount}张

等待你的回合...
```

**示例**：

```
【游戏进展】

玩家 老王（位置2, 西）执行了操作：
- 打出：五条

当前牌桌状态：
- 牌墙剩余：68张
- 你的手牌：13张

等待你的回合...
```

---

### 3.7 GAME_END - 游戏结束

**Prompt 模板**：

```
【游戏结束】

赢家：{winnerName}（{winnerPosition}）
胡牌方式：{winType} // 自摸/点炮
胡牌：{winningTiles}

番型：
{fanList}

得分：
{scores}

你的战绩：
- 本局得分：{yourScore}
- 总战绩：{yourStats}

游戏结束，感谢参与！
```

---

## 4. AI Agent 返回格式

### 4.1 标准返回格式

```typescript
interface AIAgentResponse {
  // 必填：操作类型
  action: 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
  
  // 打牌/吃碰杠时必填：相关牌
  tiles?: string[];  // 牌的 ID 列表
  
  // 可选：AI 的聊天内容
  message?: string;
  
  // 可选：AI 的情绪状态
  mood?: 'confident' | 'happy' | 'normal' | 'upset' | 'angry';
}
```

### 4.2 各操作的返回示例

**摸牌**：
```json
{
  "action": "draw"
}
```

**打牌**：
```json
{
  "action": "discard",
  "tile": "wan-5-12",
  "message": "这张牌用不上，打了吧~"
}
```

**吃牌**：
```json
{
  "action": "chi",
  "tiles": ["tiao-6-30", "tiao-8-32"]
}
```

**碰牌**：
```json
{
  "action": "peng",
  "tiles": ["wan-5-10", "wan-5-11"]
}
```

**杠牌**：
```json
{
  "action": "gang",
  "tiles": ["tong-3-40", "tong-3-41", "tong-3-42"]
}
```

**胡牌**：
```json
{
  "action": "hu",
  "message": "哈哈，胡了！"
}
```

**跳过**：
```json
{
  "action": "pass"
}
```

---

## 5. 错误处理

### 5.1 服务器验证逻辑

| 验证项 | 条件 | 失败处理 |
|--------|------|---------|
| 回合检查 | 是否轮到该 AI | 返回错误 |
| 牌存在检查 | 牌是否在手中 | 返回错误 |
| 操作合法性 | 吃碰杠胡是否满足条件 | 返回错误 |
| 格式检查 | JSON 格式是否正确 | 返回错误 |

### 5.2 超时处理

| 操作 | 超时时间 | 默认行为 |
|------|---------|---------|
| 摸牌 | 10秒 | 自动摸牌 |
| 打牌 | 30秒 | 打出第一张牌 |
| 吃碰杠胡选择 | 15秒 | 自动跳过 |

---

## 6. 实现说明

### 6.1 Prompt 生成位置

在游戏服务器中新增 `PromptGenerator` 模块：

```
src/server/
├── prompt/
│   ├── PromptGenerator.ts    # Prompt 生成器
│   ├── templates/            # Prompt 模板
│   └── types.ts              # 类型定义
```

### 6.2 AI Agent 接口

修改 `AIClient.ts`，使其：

1. 收到 Prompt 后，调用大模型 API
2. 解析大模型返回的 JSON
3. 发送操作指令给服务器

### 6.3 与 OpenClaw Agent 的对接

OpenClaw Agent 作为独立的 WebSocket 客户端连接游戏服务器，流程：

```
游戏服务器 --[发送 Prompt]--> OpenClaw Agent --[调用大模型]--> 大模型
     ↑                                              |
     +--------[返回 JSON 操作]---------------------+
```

---

## 7. 附录

### 7.1 牌 ID 格式

```
{花色}-{数值}-{序号}

花色：wan(万)、tiao(条)、tong(筒)、feng(风)、jian(箭)
数值：1-9（万条筒）、1-4（风：东南西北）、1-3（箭：中发白）
序号：0-3（同一种牌有4张）

示例：
- wan-1-0：第一张一万
- tiao-9-2：第三张九条
- feng-2-1：第二张南风
- jian-1-0：第一张红中
```

### 7.2 位置编码

| 数值 | 方位 | 说明 |
|------|------|------|
| 0 | 东 | 庄家 |
| 1 | 南 | 下家 |
| 2 | 西 | 对家 |
| 3 | 北 | 上家 |

---

*文档版本：v1.0*  
*更新时间：2026-03-04*
