/**
 * 玩家区域组件
 * 显示单个玩家的信息（名称、手牌背面、副露、弃牌等）
 */

import React, { useState, useEffect } from 'react';
import { PlayerPublic, Tile, Meld, Mood } from '../../../shared/types';
import { SEAT_NAMES } from '../../../shared/constants';
import { SpeechBubble, SpeechMessage } from './SpeechBubble';
import { EmotionIndicator } from './EmotionIndicator';
import { WaitingBadge } from './WaitingIndicator';
import { EmotionState } from '../../store';

export interface PlayerAreaProps {
  player: PlayerPublic;
  position: 'bottom' | 'right' | 'top' | 'left';
  isCurrentTurn: boolean;
  isDealer: boolean;
  getMoodEmoji: (mood: Mood) => string;
  // 发言系统
  speechMessage?: SpeechMessage | null;
  emotion?: EmotionState | null;
}

/**
 * 渲染单张牌
 */
const TileView: React.FC<{ tile: Tile; faceDown?: boolean }> = ({ tile, faceDown = false }) => {
  if (faceDown) {
    return <div className="tile tile-back" />;
  }
  return (
    <div className="tile tile-front">
      <span className="tile-display">{tile.display}</span>
    </div>
  );
};

/**
 * 渲染副露组
 */
const MeldView: React.FC<{ meld: Meld }> = ({ meld }) => {
  return (
    <div className={`meld meld-${meld.type}`}>
      {meld.tiles.map((tile) => (
        <TileView key={tile.id} tile={tile} />
      ))}
    </div>
  );
};

/**
 * 渲染弃牌区
 */
const DiscardArea: React.FC<{ discards: Tile[] }> = ({ discards }) => {
  // 将弃牌分成多行显示
  const ROW_SIZE = 6;
  const rows: Tile[][] = [];
  for (let i = 0; i < discards.length; i += ROW_SIZE) {
    rows.push(discards.slice(i, i + ROW_SIZE));
  }

  if (discards.length === 0) {
    return <div className="discard-area empty">暂无弃牌</div>;
  }

  return (
    <div className="discard-area">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="discard-row">
          {row.map((tile) => (
            <TileView key={tile.id} tile={tile} />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * 渲染手牌背面
 */
const HandBack: React.FC<{ count: number }> = ({ count }) => {
  return (
    <div className="hand-back">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="tile tile-back" />
      ))}
    </div>
  );
};

export const PlayerArea: React.FC<PlayerAreaProps> = ({
  player,
  position,
  isCurrentTurn,
  isDealer,
  getMoodEmoji,
  speechMessage,
  emotion,
}) => {
  const seatName = SEAT_NAMES[player.position];
  const [showSpeech, setShowSpeech] = useState(false);

  // 当有新发言时显示
  useEffect(() => {
    if (speechMessage) {
      setShowSpeech(true);
      const timer = setTimeout(() => setShowSpeech(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [speechMessage]);

  return (
    <div className={`player-area player-${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
      {/* 玩家信息头部 */}
      <div className="player-header">
        <div className="player-info">
          <span className="player-name">{player.name}</span>
          {isDealer && <span className="dealer-badge">庄</span>}
          <span className="player-seat">{seatName}</span>
        </div>
        <div className="player-stats">
          <span className="player-score">{player.score}分</span>
          {player.type === 'ai-agent' && (
            <>
              {/* 情绪指示器 */}
              {emotion && (
                <EmotionIndicator
                  mood={emotion.mood}
                  emoji={emotion.emoji}
                  color={emotion.color}
                  intensity={emotion.values.happiness > 0 ? emotion.values.happiness : 50}
                  animated={true}
                />
              )}
              {/* 备用：简单情绪表情 */}
              {!emotion && (
                <span className="player-mood">{getMoodEmoji(player.mood)}</span>
              )}
            </>
          )}
        </div>
        {/* 等待徽章 */}
        {isCurrentTurn && player.type === 'ai-agent' && (
          <WaitingBadge active={true} />
        )}
      </div>

      {/* 发言气泡 */}
      {showSpeech && speechMessage && (
        <SpeechBubble
          playerName={speechMessage.playerName}
          content={speechMessage.content}
          emotion={speechMessage.emotion}
          position={position}
          duration={5000}
          onDismiss={() => setShowSpeech(false)}
        />
      )}

      {/* 游戏区域 */}
      <div className="player-game-area">
        {/* 手牌背面（其他玩家） */}
        {position !== 'bottom' && (
          <div className="hand-area-other">
            <HandBack count={player.handCount} />
          </div>
        )}

        {/* 副露区 */}
        <div className="melds-area">
          {player.melds.length > 0 && (
            <div className="melds">
              {player.melds.map((meld, index) => (
                <MeldView key={index} meld={meld} />
              ))}
            </div>
          )}
        </div>

        {/* 弃牌区 */}
        <div className="discards-container">
          <DiscardArea discards={player.discards} />
        </div>
      </div>

      {/* 当前回合指示器 */}
      {isCurrentTurn && (
        <div className="turn-indicator">
          <span className="turn-arrow">▶</span>
        </div>
      )}
    </div>
  );
};

export default PlayerArea;
