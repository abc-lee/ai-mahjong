/**
 * 等待进度条组件
 * 显示当前玩家的出牌等待时间
 */

import React, { useEffect, useState } from 'react';
import './WaitingIndicator.css';

export interface WaitingIndicatorProps {
  playerName: string;
  timeout?: number; // 超时时间（毫秒）
  level?: 1 | 2 | 3; // 等待等级
  onTimeout?: () => void;
}

export const WaitingIndicator: React.FC<WaitingIndicatorProps> = ({
  playerName,
  timeout = 15000,
  level = 1,
  onTimeout,
}) => {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      setElapsed(elapsed);
      setProgress(Math.min(100, (elapsed / timeout) * 100));
      
      if (elapsed >= timeout) {
        clearInterval(timer);
        onTimeout?.();
      }
    }, 100);

    return () => clearInterval(timer);
  }, [timeout, onTimeout]);

  const getLevelClass = () => {
    if (elapsed > 10000) return 'level-3';
    if (elapsed > 5000) return 'level-2';
    return 'level-1';
  };

  const getMessage = () => {
    if (elapsed > 10000) return `😅 ${playerName} 还在思考...`;
    if (elapsed > 5000) return `⏰ ${playerName} 正在思考...`;
    return `🤔 ${playerName} 的回合`;
  };

  return (
    <div className={`waiting-indicator ${getLevelClass()}`}>
      <div className="waiting-message">{getMessage()}</div>
      <div className="waiting-progress-track">
        <div 
          className="waiting-progress-fill" 
          style={{ width: `${progress}%` }} 
        />
      </div>
      <div className="waiting-time">{Math.floor(elapsed / 1000)}s</div>
    </div>
  );
};

/**
 * 等待状态徽章
 * 小型显示在玩家头上
 */
export interface WaitingBadgeProps {
  active: boolean;
}

export const WaitingBadge: React.FC<WaitingBadgeProps> = ({ active }) => {
  if (!active) return null;

  return (
    <div className="waiting-badge">
      <span className="waiting-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
    </div>
  );
};

export default WaitingIndicator;
