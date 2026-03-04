/**
 * 玩家槽位组件
 * 显示单个玩家的座位信息
 */

import React from 'react';
import { PlayerPublic } from '../../../shared/types';
import { SEAT_NAMES } from '../../../shared/constants';

export interface PlayerSlotProps {
  player?: PlayerPublic;
  position: 0 | 1 | 2 | 3; // 东南西北
  isHost: boolean;
  isMe: boolean;
}

// 位置对应的样式类名
const POSITION_CLASSES: Record<number, string> = {
  0: 'position-east',   // 东 - 右
  1: 'position-south',  // 南 - 下（自己）
  2: 'position-west',   // 西 - 左
  3: 'position-north',  // 北 - 上
};

// 位置对应的颜色主题
const POSITION_COLORS: Record<number, string> = {
  0: '#e74c3c', // 东 - 红色
  1: '#2ecc71', // 南 - 绿色
  2: '#f39c12', // 西 - 橙色
  3: '#3498db', // 北 - 蓝色
};

export const PlayerSlot: React.FC<PlayerSlotProps> = ({
  player,
  position,
  isHost,
  isMe,
}) => {
  const seatName = SEAT_NAMES[position];
  const positionColor = POSITION_COLORS[position];

  return (
    <div
      className={`player-slot ${POSITION_CLASSES[position]} ${player ? 'occupied' : 'empty'} ${isMe ? 'is-me' : ''}`}
      style={{ '--position-color': positionColor } as React.CSSProperties}
    >
      {/* 座位方向标识 */}
      <div className="seat-indicator" style={{ backgroundColor: positionColor }}>
        {seatName}
      </div>

      {player ? (
        <>
          {/* 玩家名称 */}
          <div className="player-name">
            {player.name}
            {isMe && <span className="me-badge">我</span>}
          </div>

          {/* 状态标识 */}
          <div className="player-badges">
            {isHost && <span className="host-badge">房主</span>}
            {!player.isOnline && <span className="offline-badge">离线</span>}
          </div>

          {/* 准备状态 */}
          <div className={`ready-status ${player.isReady ? 'ready' : 'not-ready'}`}>
            {player.isReady ? (
              <span className="ready-icon">✓</span>
            ) : (
              <span className="waiting-icon">○</span>
            )}
            <span className="ready-text">
              {player.isReady ? '已准备' : '未准备'}
            </span>
          </div>
        </>
      ) : (
        <div className="empty-slot">
          <span className="waiting-text">等待加入...</span>
        </div>
      )}
    </div>
  );
};

export default PlayerSlot;
