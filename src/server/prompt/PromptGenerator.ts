/**
 * Prompt 生成器
 * 将游戏状态转换为 AI Agent 可理解的文本 Prompt
 */

import type { Tile, PendingAction, Meld } from '@shared/types';
import { PromptType, type PromptContext, type AIAgentResponse } from './types';
import { promptLoader } from './PromptLoader';

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
  return actions.map(action => {
    const name = promptLoader.getActionName(action.action);
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
  return promptLoader.getDirection(position);
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
      .map(p => `- 位置${p.position}(${promptLoader.getDirection(p.position)})：${p.name}`)
      .join('\n');
    
    return promptLoader.getWithVars('gameInfo.gameStart', {
      playerName,
      position,
      direction: promptLoader.getDirection(position),
      dealerMark: isDealer ? ', 庄家' : '',
      isDealer: isDealer ? '是' : '否',
      otherPlayers,
      handCount: hand.length,
      handTiles: formatHand(hand),
    });
  }
  
  /**
   * 轮到摸牌 Prompt
   */
  private generateYourTurnDraw(context: PromptContext): string {
    const { gameState, hand, position } = context;
    const lastDiscardPlayer = gameState.players[gameState.lastDiscardPlayer];
    
    return promptLoader.getWithVars('gameInfo.yourTurnDraw', {
      wallRemaining: gameState.wallRemaining,
      direction: promptLoader.getDirection(position),
      lastDiscard: gameState.lastDiscard?.display || '无',
      lastPlayerName: lastDiscardPlayer?.name || '无',
      handCount: hand.length,
      handTiles: formatHand(hand),
    });
  }
  
  /**
   * 轮到打牌 Prompt
   */
  private generateYourTurnDiscard(context: PromptContext): string {
    const { hand, lastDrawnTile, gameState } = context;
    
    return promptLoader.getWithVars('gameInfo.yourTurnDiscard', {
      lastDrawnTile: lastDrawnTile ? lastDrawnTile.display : '无',
      handCount: hand.length,
      handTiles: formatHand(hand),
      wallRemaining: gameState.wallRemaining,
    });
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
    
    return promptLoader.getWithVars('gameInfo.actionRequired', {
      lastPlayerName: lastDiscardPlayer?.name || '未知',
      lastDiscard: gameState.lastDiscard?.display || '未知',
      availableActions: formatAvailableActions(availableActions),
      handCount: hand.length,
      handTiles: formatHand(hand),
    });
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
      return promptLoader.getWithVars('gameInfo.actionSuccess', {
        action: actionResult.action,
      });
    } else {
      return promptLoader.getWithVars('gameInfo.actionFailed', {
        action: actionResult.action,
        reason: actionResult.reason || '未知',
      });
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
    
    return promptLoader.getWithVars('gameInfo.otherPlayerAction', {
      playerName: otherPlayerAction.playerName,
      position: otherPlayerAction.position,
      direction: promptLoader.getDirection(otherPlayerAction.position),
      action: otherPlayerAction.action,
      tileInfo: otherPlayerAction.tile ? `：${otherPlayerAction.tile.display}` : '',
      wallRemaining: gameState.wallRemaining,
      handCount: hand.length,
    });
  }
  
  /**
   * 游戏结束 Prompt
   */
  private generateGameEnd(context: PromptContext): string {
    const { gameEndInfo } = context;
    
    if (!gameEndInfo) {
      return '';
    }
    
    const scores = gameEndInfo.scores
      .map(s => `- ${s.playerName}：${s.score > 0 ? '+' : ''}${s.score}分`)
      .join('\n');
    
    return promptLoader.getWithVars('gameInfo.gameEnd', {
      winnerName: gameEndInfo.winnerName,
      winnerDirection: promptLoader.getDirection(gameEndInfo.winnerPosition),
      winType: gameEndInfo.winType === 'selfDraw' ? '自摸' : '点炮',
      winningTiles: gameEndInfo.winningTiles.map(t => t.display).join('、'),
      scores,
    });
  }
}

// 导出单例
export const promptGenerator = new PromptGenerator();
