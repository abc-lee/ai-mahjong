/**
 * 情绪指示器组件
 * 显示 AI 玩家的情绪状态和动画
 */

import React from 'react';
import './EmotionIndicator.css';

export interface EmotionIndicatorProps {
  mood: string;
  emoji: string;
  color: string;
  intensity?: number; // 0-100
  animated?: boolean;
}

export const EmotionIndicator: React.FC<EmotionIndicatorProps> = ({
  mood,
  emoji,
  color,
  intensity = 50,
  animated = true,
}) => {
  return (
    <div 
      className={`emotion-indicator ${mood} ${animated ? 'animated' : ''}`}
      style={{ '--emotion-color': color } as React.CSSProperties}
    >
      <div className="emotion-emoji">{emoji}</div>
      <div className="emotion-ring" style={{ opacity: intensity / 100 }} />
      {intensity > 70 && (
        <div className="emotion-particles">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="particle" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 情绪条组件
 * 显示情绪值的进度条
 */
export interface EmotionBarProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  color?: string;
}

export const EmotionBar: React.FC<EmotionBarProps> = ({
  label,
  value,
  min = -100,
  max = 100,
  color = '#4CAF50',
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const neutralPercentage = ((0 - min) / (max - min)) * 100;

  return (
    <div className="emotion-bar">
      <div className="emotion-bar-label">{label}</div>
      <div className="emotion-bar-track">
        <div className="emotion-bar-neutral" style={{ left: `${neutralPercentage}%` }} />
        <div 
          className="emotion-bar-fill" 
          style={{ 
            width: `${Math.abs(percentage - neutralPercentage)}%`,
            left: value >= 0 ? `${neutralPercentage}%` : `${percentage}%`,
            backgroundColor: color,
          }} 
        />
      </div>
      <div className="emotion-bar-value">{value}</div>
    </div>
  );
};

/**
 * 情绪面板组件
 * 显示完整的情绪信息面板
 */
export interface EmotionPanelProps {
  emotion: {
    mood: string;
    emoji: string;
    color: string;
    values: {
      happiness: number;
      anger: number;
      patience: number;
      confidence: number;
    };
  };
  visible?: boolean;
  onClose?: () => void;
}

export const EmotionPanel: React.FC<EmotionPanelProps> = ({
  emotion,
  visible = true,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <div className="emotion-panel">
      <div className="emotion-panel-header">
        <EmotionIndicator
          mood={emotion.mood}
          emoji={emotion.emoji}
          color={emotion.color}
        />
        <span className="emotion-mood-name">{emotion.mood}</span>
        {onClose && (
          <button className="emotion-close" onClick={onClose}>×</button>
        )}
      </div>
      <div className="emotion-panel-bars">
        <EmotionBar 
          label="快乐" 
          value={emotion.values.happiness} 
          color={emotion.values.happiness >= 0 ? '#4CAF50' : '#9E9E9E'}
        />
        <EmotionBar 
          label="愤怒" 
          value={emotion.values.anger} 
          min={0}
          max={100}
          color="#f44336"
        />
        <EmotionBar 
          label="耐心" 
          value={emotion.values.patience} 
          min={0}
          max={100}
          color="#2196F3"
        />
        <EmotionBar 
          label="自信" 
          value={emotion.values.confidence} 
          min={0}
          max={100}
          color="#FF9800"
        />
      </div>
    </div>
  );
};

export default EmotionIndicator;
