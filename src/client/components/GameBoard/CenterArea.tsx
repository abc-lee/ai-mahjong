/**
 * 中央区域组件
 * 显示牌墙、最后打出的牌、回合信息
 */

import React from 'react';
import { Tile } from '../../../shared/types';

export interface CenterAreaProps {
  lastDiscard: Tile | null;
  wallRemaining: number;
  roundNumber: number;
}

export const CenterArea: React.FC<CenterAreaProps> = ({
  lastDiscard,
  wallRemaining,
  roundNumber,
}) => {
  return (
    <div className="center-area">
      {/* 回合信息 */}
      <div className="round-info">
        <span className="round-label">第</span>
        <span className="round-number">{roundNumber}</span>
        <span className="round-label">局</span>
      </div>

      {/* 牌墙信息 */}
      <div className="wall-info">
        <div className="wall-icon">🧱</div>
        <span className="wall-count">剩余 {wallRemaining} 张</span>
      </div>

      {/* 最后打出的牌 */}
      <div className="last-discard-area">
        {lastDiscard ? (
          <div className="last-discard-tile highlight">
            <span className="tile-display">{lastDiscard.display}</span>
          </div>
        ) : (
          <div className="last-discard-placeholder">
            等待出牌...
          </div>
        )}
      </div>
    </div>
  );
};

export default CenterArea;
