/**
 * 游戏桌面主组件
 * 四方位布局：东(右)、南(下/自己)、西(左)、北(上)
 */

import React from 'react';
import { PlayerPublic, Tile, Meld, Mood } from '../../../shared/types';
import { SEAT_NAMES } from '../../../shared/constants';
import { PlayerArea } from './PlayerArea';
import { CenterArea } from './CenterArea';
import { WaitingIndicator } from './WaitingIndicator';
import { ChatContainer } from '../Chat/ChatContainer';
import { TileComponent } from '../Tile/Tile';
import { ChatMessage } from '../../../shared/types/chat';
import { SpeechMessage, EmotionState } from '../../store';
import './GameBoard.css';

// 位置映射：玩家 position (0-3) -> UI position
// 0=东, 1=南, 2=西, 3=北
// 自己始终在下方(南)，所以需要根据当前玩家位置进行偏移
type UIPosition = 'bottom' | 'right' | 'top' | 'left';

export interface GameBoardProps {
  // 玩家信息
  players: PlayerPublic[];
  currentPlayerIndex: number;
  myPosition: number; // 自己的座位位置 (0-3)
  
  // 自己的手牌（完整信息）
  myHand: Tile[];
  
  // 中央信息
  lastDiscard: Tile | null;
  wallRemaining: number;
  roundNumber: number;
  dealerIndex: number;
  
  // 当前是否轮到自己
  isMyTurn: boolean;
  
  // 当前阶段
  turnPhase?: 'draw' | 'discard' | 'action' | null;
  
  // 最后摸到的牌（可能为空）
  lastDrawnTile?: Tile;
  
  // 待处理的操作（吃碰杠胡）
  pendingActions?: Array<{ action: string; tiles?: Tile[] }>;
  
  // 发言系统
  speechMessages?: Record<string, SpeechMessage>;
  playerEmotions?: Record<string, EmotionState>;
  
  // 聊天系统
  chatMessages?: ChatMessage[];
  onSendChat?: (content: { text: string }) => void;
  myPlayerId?: string;
  myPlayerName?: string;
  myPlayerType?: 'human' | 'ai-agent';
  
  // 回调
  onDiscard?: (tileId: string) => void;
  onDraw?: () => void;
  onAction?: (action: string, tiles?: Tile[]) => void;
  onPass?: () => void;
}

/**
 * 计算玩家在 UI 中的位置
 * @param playerPosition 玩家的座位位置 (0-3)
 * @param myPosition 自己的座位位置
 * @returns UI 位置
 */
function getUIPosition(playerPosition: number, myPosition: number): UIPosition {
  // 计算相对位置
  const relativePosition = (playerPosition - myPosition + 4) % 4;
  
  // 0 = 自己(下), 1 = 下家(右), 2 = 对家(上), 3 = 上家(左)
  const positionMap: UIPosition[] = ['bottom', 'right', 'top', 'left'];
  return positionMap[relativePosition];
}

/**
 * 获取情绪表情
 */
function getMoodEmoji(mood: Mood): string {
  const moodEmojis: Record<Mood, string> = {
    confident: '😏',
    happy: '😊',
    normal: '😐',
    upset: '😟',
    angry: '😠',
    devastated: '😭',
  };
  return moodEmojis[mood] || '😐';
}

export const GameBoard: React.FC<GameBoardProps> = ({
  players,
  currentPlayerIndex,
  myPosition,
  myHand,
  lastDiscard,
  wallRemaining,
  roundNumber,
  dealerIndex,
  isMyTurn,
  turnPhase,
  lastDrawnTile,
  pendingActions = [],
  speechMessages = {},
  playerEmotions = {},
  chatMessages = [],
  onSendChat,
  myPlayerId = '',
  myPlayerName = '玩家',
  myPlayerType = 'human',
  onDiscard,
  onDraw,
  onAction,
  onPass,
}) => {
  // 按 UI 位置组织玩家
  const playersByPosition = players.reduce((acc, player, index) => {
    const uiPosition = getUIPosition(player.position, myPosition);
    acc[uiPosition] = { ...player, index };
    return acc;
  }, {} as Record<UIPosition, PlayerPublic & { index: number }>);

  // 判断当前阶段 - 使用服务器发送的 turnPhase
  const needDraw = isMyTurn && turnPhase === 'draw' && pendingActions.length === 0;
  const canDiscard = isMyTurn && turnPhase === 'discard' && pendingActions.length === 0;
  const hasActions = pendingActions && pendingActions.length > 0;
  
  console.log('[GameBoard] pendingActions:', pendingActions);
  console.log('[GameBoard] needDraw:', needDraw, 'canDiscard:', canDiscard, 'hasActions:', hasActions);

  // 获取当前回合玩家名称（用于等待指示器）
  const currentTurnPlayer = players[currentPlayerIndex];
  const waitingPlayerName = currentTurnPlayer?.name || '';

  return (
    <div className="game-board-wrapper">
      <div className="game-board">
      {/* 北/对家 */}
      <div className="player-slot player-top">
        {playersByPosition.top && (
          <PlayerArea
            player={playersByPosition.top}
            position="top"
            isCurrentTurn={currentPlayerIndex === playersByPosition.top.index}
            isDealer={dealerIndex === playersByPosition.top.index}
            getMoodEmoji={getMoodEmoji}
            speechMessage={speechMessages[playersByPosition.top.id]}
            emotion={playerEmotions[playersByPosition.top.id]}
          />
        )}
      </div>

      {/* 西/上家 */}
      <div className="player-slot player-left">
        {playersByPosition.left && (
          <PlayerArea
            player={playersByPosition.left}
            position="left"
            isCurrentTurn={currentPlayerIndex === playersByPosition.left.index}
            isDealer={dealerIndex === playersByPosition.left.index}
            getMoodEmoji={getMoodEmoji}
            speechMessage={speechMessages[playersByPosition.left.id]}
            emotion={playerEmotions[playersByPosition.left.id]}
          />
        )}
      </div>

      {/* 中央区域 - 游戏信息在上，聊天窗口在下 */}
      <div className="center-slot">
        {/* 游戏信息 */}
        <div className="center-game-area">
          <CenterArea
            lastDiscard={lastDiscard}
            wallRemaining={wallRemaining}
            roundNumber={roundNumber}
          />
          {/* 等待指示器 */}
          {!isMyTurn && waitingPlayerName && (
            <WaitingIndicator
              playerName={waitingPlayerName}
              timeout={15000}
            />
          )}
        </div>
        
        {/* 聊天窗口 - 在中间底部 */}
        <div className="chat-panel">
          <ChatContainer
            myPlayerId={myPlayerId}
            myPlayerName={myPlayerName}
            myPlayerType={myPlayerType}
            messages={chatMessages}
            onSendMessage={onSendChat}
            showInput={myPlayerType === 'human'}
          />
        </div>
      </div>

      {/* 东/下家 */}
      <div className="player-slot player-right">
        {playersByPosition.right && (
          <PlayerArea
            player={playersByPosition.right}
            position="right"
            isCurrentTurn={currentPlayerIndex === playersByPosition.right.index}
            isDealer={dealerIndex === playersByPosition.right.index}
            getMoodEmoji={getMoodEmoji}
            speechMessage={speechMessages[playersByPosition.right.id]}
            emotion={playerEmotions[playersByPosition.right.id]}
          />
        )}
      </div>

      {/* 南/自己 - 包含手牌区和操作区 */}
      <div className="player-slot player-bottom">
        {playersByPosition.bottom && (
          <>
            <PlayerArea
              player={playersByPosition.bottom}
              position="bottom"
              isCurrentTurn={isMyTurn}
              isDealer={dealerIndex === playersByPosition.bottom.index}
              getMoodEmoji={getMoodEmoji}
              speechMessage={speechMessages[playersByPosition.bottom.id]}
              emotion={playerEmotions[playersByPosition.bottom.id]}
            />
            
            {/* 操作提示区 */}
            <div className="action-area">
              {/* 摸牌阶段 */}
              {needDraw && (
                <button className="action-button draw-button" onClick={onDraw}>
                  摸牌
                </button>
              )}
              
              {/* 吃碰杠胡选择 */}
              {hasActions && (
                <div className="action-buttons">
                  {pendingActions.map((action, index) => (
                    <button
                      key={index}
                      className={`action-button ${action.action}-button`}
                      onClick={() => onAction?.(action.action, action.tiles)}
                    >
                      {action.action === 'hu' ? '胡' : 
                       action.action === 'gang' ? '杠' : 
                       action.action === 'peng' ? '碰' : 
                       action.action === 'chi' ? '吃' : action.action}
                    </button>
                  ))}
                  <button className="action-button pass-button" onClick={onPass}>
                    过
                  </button>
                </div>
              )}
              
              {/* 打牌阶段提示 */}
              {canDiscard && (
                <div className="turn-hint">
                  点击手牌打出
                </div>
              )}
            </div>
            
            {/* 手牌区 - 仅自己显示 */}
            <div className="hand-area">
              <div className="hand-tiles">
                {myHand
                  .slice()
                  .sort((a, b) => {
                    // 花色优先级：万 -> 条 -> 筒 -> 风 -> 箭
                    const suitOrder: Record<string, number> = {
                      'wan': 1, 'tiao': 2, 'tong': 3, 'feng': 4, 'jian': 5,
                    };
                    const suitA = suitOrder[a.suit] || 99;
                    const suitB = suitOrder[b.suit] || 99;
                    if (suitA !== suitB) return suitA - suitB;
                    return (a.value || 0) - (b.value || 0);
                  })
                  .map((tile, index) => (
                    <TileComponent
                      key={tile.id}
                      tile={tile}
                      selected={lastDrawnTile?.id === tile.id}
                      onClick={() => canDiscard && onDiscard?.(tile.id)}
                      disabled={!canDiscard}
                      size="medium"
                    />
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default GameBoard;
