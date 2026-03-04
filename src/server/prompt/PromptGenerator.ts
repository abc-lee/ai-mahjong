/**
 * Prompt 生成器
 * 将游戏状态转换为 AI Agent 可理解的文本 Prompt
 */

import type { Tile, PendingAction, Meld } from '@shared/types';
import { PromptType, type PromptContext, type AIAgentResponse } from './types';

/**
 * 牌 ID 转换为显示名称
 */
function tileToDisplay(tile: Tile): string {
  return `${tile.display}[id:${tile.id}]`;
}

/**
 * 手牌列表格式化
 */
function formatHand(hand: Tile[]): string {
  return hand.map(tileToDisplay).join('、');
}

/**
 * 副露格式化
 */
function formatMelds(melds: Meld[]): string {
  if (melds.length === 0) return '无';
  
  const meldNames: Record<string, string> = {
    chi: '吃',
    peng: '碰',
    gang: '杠',
  };
  
  return melds.map(meld => {
    const name = meldNames[meld.type];
    const tiles = meld.tiles.map(t => t.display).join('');
    return `${name}(${tiles})`;
  }).join('、');
}

/**
 * 可用操作格式化
 */
function formatAvailableActions(actions: PendingAction[]): string {
  const actionNames: Record<string, string> = {
    chi: '吃',
    peng: '碰',
    gang: '杠',
    hu: '胡',
  };
  
  return actions.map(action => {
    const name = actionNames[action.action];
    if (action.tiles && action.tiles.length > 0) {
      const tiles = action.tiles.map(t => t.display).join('、');
      return `- ${name}：使用 ${tiles}`;
    }
    return `- ${name}`;
  }).join('\n');
}

/**
 * 位置转方位
 */
function positionToDirection(position: number): string {
  const directions = ['东', '南', '西', '北'];
  return directions[position] || '未知';
}

/**
 * Prompt 生成器类
 */
export class PromptGenerator {
  
  /**
   * 生成 Prompt
   */
  generate(type: PromptType, context: PromptContext): string {
    switch (type) {
      case PromptType.GAME_START:
        return this.generateGameStart(context);
      case PromptType.YOUR_TURN_DRAW:
        return this.generateYourTurnDraw(context);
      case PromptType.YOUR_TURN_DISCARD:
        return this.generateYourTurnDiscard(context);
      case PromptType.ACTION_REQUIRED:
        return this.generateActionRequired(context);
      case PromptType.ACTION_RESULT:
        return this.generateActionResult(context);
      case PromptType.OTHER_PLAYER_ACTION:
        return this.generateOtherPlayerAction(context);
      case PromptType.GAME_END:
        return this.generateGameEnd(context);
      default:
        return '';
    }
  }
  
  /**
   * 游戏开始 Prompt
   */
  private generateGameStart(context: PromptContext): string {
    const { playerName, position, isDealer, hand, gameState } = context;
    const otherPlayers = gameState.players
      .filter(p => p.position !== position)
      .map(p => `- 位置${p.position}(${positionToDirection(p.position)})：${p.name}`)
      .join('\n');
    
    return `【游戏开始】

你是本次麻将游戏的玩家之一。
- 你的名字：${playerName}
- 你的位置：${position} (${positionToDirection(position)}${isDealer ? ', 庄家' : ''})
- 你是否是庄家：${isDealer ? '是' : '否'}

其他玩家：
${otherPlayers}

你的初始手牌（${hand.length}张）：
${formatHand(hand)}

游戏规则提示：
- 每人13张起手，庄家14张
- 轮流摸牌、打牌
- 可以吃、碰、杠、胡

准备开始！等待你的回合...`;
  }
  
  /**
   * 轮到摸牌 Prompt
   */
  private generateYourTurnDraw(context: PromptContext): string {
    const { gameState, hand } = context;
    const lastDiscardPlayer = gameState.players[gameState.lastDiscardPlayer];
    
    return `【你的回合 - 摸牌阶段】

当前游戏状态：
- 剩余牌数：${gameState.wallRemaining}张
- 当前玩家：你（${positionToDirection(context.position)}）
- 上家打出的牌：${gameState.lastDiscard?.display || '无'}（玩家：${lastDiscardPlayer?.name || '无'}）

你的手牌（${hand.length}张）：
${formatHand(hand)}

你需要执行的操作：摸牌

请发送指令：
\`\`\`json
{
  "action": "draw"
}
\`\`\``;
  }
  
  /**
   * 轮到打牌 Prompt
   */
  private generateYourTurnDiscard(context: PromptContext): string {
    const { hand, lastDrawnTile, gameState } = context;
    
    return `【你的回合 - 打牌阶段】

你刚才摸到的牌：${lastDrawnTile ? lastDrawnTile.display : '无'}

你现在的手牌（${hand.length}张）：
${formatHand(hand)}

牌墙剩余：${gameState.wallRemaining}张

你需要打出一张牌。

请发送指令：
\`\`\`json
{
  "action": "discard",
  "tile": "要打出的牌的ID"
}
\`\`\`

例如：
\`\`\`json
{
  "action": "discard",
  "tile": "wan-5-12"
}
\`\`\``;
  }
  
  /**
   * 可以吃碰杠胡 Prompt
   */
  private generateActionRequired(context: PromptContext): string {
    const { gameState, hand, availableActions } = context;
    
    if (!availableActions || availableActions.length === 0) {
      return '';
    }
    
    const lastDiscardPlayer = gameState.players[gameState.lastDiscardPlayer];
    
    return `【操作选择】

玩家 ${lastDiscardPlayer?.name || '未知'} 打出了：${gameState.lastDiscard?.display || '未知'}

你可以进行的操作：
${formatAvailableActions(availableActions)}

你的手牌（${hand.length}张）：
${formatHand(hand)}

请选择一个操作，发送指令：
\`\`\`json
{
  "action": "chi|peng|gang|hu|pass",
  "tiles": ["相关牌ID"]
}
\`\`\`

或者跳过：
\`\`\`json
{
  "action": "pass"
}
\`\`\``;
  }
  
  /**
   * 操作结果反馈 Prompt
   */
  private generateActionResult(context: PromptContext): string {
    const { actionResult } = context;
    
    if (!actionResult) {
      return '';
    }
    
    if (actionResult.success) {
      return `【操作成功】

你成功执行了：${actionResult.action}

游戏继续...`;
    } else {
      return `【操作失败】

你尝试执行：${actionResult.action}
失败原因：${actionResult.reason || '未知'}

请重新选择操作。`;
    }
  }
  
  /**
   * 其他玩家操作 Prompt
   */
  private generateOtherPlayerAction(context: PromptContext): string {
    const { otherPlayerAction, hand, gameState } = context;
    
    if (!otherPlayerAction) {
      return '';
    }
    
    return `【游戏进展】

玩家 ${otherPlayerAction.playerName}（位置${otherPlayerAction.position}, ${positionToDirection(otherPlayerAction.position)}）执行了操作：
- ${otherPlayerAction.action}${otherPlayerAction.tile ? `：${otherPlayerAction.tile.display}` : ''}

当前牌桌状态：
- 牌墙剩余：${gameState.wallRemaining}张
- 你的手牌：${hand.length}张

等待你的回合...`;
  }
  
  /**
   * 游戏结束 Prompt
   */
  private generateGameEnd(context: PromptContext): string {
    const { gameEndInfo, hand } = context;
    
    if (!gameEndInfo) {
      return '';
    }
    
    const scores = gameEndInfo.scores
      .map(s => `- ${s.playerName}：${s.score > 0 ? '+' : ''}${s.score}分`)
      .join('\n');
    
    return `【游戏结束】

赢家：${gameEndInfo.winnerName}（${positionToDirection(gameEndInfo.winnerPosition)}）
胡牌方式：${gameEndInfo.winType === 'selfDraw' ? '自摸' : '点炮'}
胡牌：${gameEndInfo.winningTiles.map(t => t.display).join('、')}

得分：
${scores}

游戏结束，感谢参与！`;
  }
}

// 导出单例
export const promptGenerator = new PromptGenerator();
