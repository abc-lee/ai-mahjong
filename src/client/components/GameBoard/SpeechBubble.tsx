/**
 * 发言气泡组件
 * 显示 AI 玩家的发言内容
 */

import React, { useEffect, useState } from 'react';
import './SpeechBubble.css';

export interface SpeechBubbleProps {
  playerName: string;
  content: string;
  emotion?: string;
  position: 'bottom' | 'right' | 'top' | 'left';
  duration?: number; // 显示时长（毫秒）
  onDismiss?: () => void;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  playerName,
  content,
  emotion = 'calm',
  position,
  duration = 5000,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, duration - 500);

    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  if (!visible) return null;

  // 根据情绪设置样式
  const emotionClass = `emotion-${emotion}`;

  return (
    <div className={`speech-bubble speech-${position} ${emotionClass} ${fading ? 'fading' : ''}`}>
      <div className="bubble-content">
        <span className="bubble-text">{content}</span>
      </div>
      <div className={`bubble-tail bubble-tail-${position}`} />
    </div>
  );
};

/**
 * 发言气泡容器
 * 管理多个发言的显示
 */
export interface SpeechMessage {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  emotion?: string;
  timestamp: number;
}

export interface SpeechBubbleContainerProps {
  messages: SpeechMessage[];
  playersPosition: Record<string, 'bottom' | 'right' | 'top' | 'left'>;
  maxVisible?: number;
}

export const SpeechBubbleContainer: React.FC<SpeechBubbleContainerProps> = ({
  messages,
  playersPosition,
  maxVisible = 3,
}) => {
  const [visibleMessages, setVisibleMessages] = useState<SpeechMessage[]>([]);

  useEffect(() => {
    // 只显示最新的几条消息
    const recent = messages.slice(-maxVisible);
    setVisibleMessages(recent);
  }, [messages, maxVisible]);

  const handleDismiss = (id: string) => {
    setVisibleMessages(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="speech-bubble-container">
      {visibleMessages.map(msg => (
        <SpeechBubble
          key={msg.id}
          playerName={msg.playerName}
          content={msg.content}
          emotion={msg.emotion}
          position={playersPosition[msg.playerId] || 'top'}
          onDismiss={() => handleDismiss(msg.id)}
        />
      ))}
    </div>
  );
};

export default SpeechBubble;
