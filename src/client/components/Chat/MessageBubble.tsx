/**
 * 消息气泡组件
 * 支持不同类型：chat、action、system
 * 显示玩家头像、名称、时间
 * AI 消息和人类消息样式区分
 */

import React from 'react';
import {
  ChatMessage,
  MessageType,
  SenderType,
  EmotionType,
  ActionType,
  NotificationLevel,
} from '../../../shared/types/chat';
import './Chat.css';

export interface MessageBubbleProps {
  message: ChatMessage;
  isMyMessage: boolean;
  showSender?: boolean;
}

/**
 * 情绪表情映射
 */
const emotionEmojis: Record<EmotionType, string> = {
  happy: '😊',
  surprised: '😲',
  sad: '😢',
  thinking: '🤔',
  confident: '😏',
};

/**
 * 动作表情映射
 */
const actionEmojis: Record<ActionType, string> = {
  discard: '🀅',
  chi: '🍜',
  peng: '👏',
  gang: '🎉',
  hu: '💰',
  pass: '🚫',
  draw: '🎴',
};

/**
 * 获取默认头像
 */
function getDefaultAvatar(senderType: SenderType, name: string): string {
  if (senderType === 'human') {
    return '👤';
  }
  // AI 玩家使用固定的个性头像
  const aiAvatars: Record<string, string> = {
    '紫璃': '🦊',
    '青云': '🐉',
    '墨染': '🐼',
    '白雪': '🐰',
    '金阳': '🦁',
  };
  return aiAvatars[name] || '🤖';
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 获取通知级别样式
 */
function getNotificationClass(level?: NotificationLevel): string {
  switch (level) {
    case 'warning':
      return 'system-warning';
    case 'highlight':
      return 'system-highlight';
    default:
      return 'system-info';
  }
}

/**
 * 获取玩家样式类名
 * 根据玩家分配不同颜色
 */
function getPlayerColorClass(senderId: string, senderType: SenderType): string {
  if (senderType === 'human') {
    return 'player-human';
  }
  // 根据 senderId 的后几位分配颜色
  const hash = senderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ['player-ai-1', 'player-ai-2', 'player-ai-3'];
  return colors[hash % colors.length];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMyMessage,
  showSender = true,
}) => {
  const { id, timestamp, sender, type, content } = message;
  const avatar = sender.avatar || getDefaultAvatar(sender.type, sender.name);
  const timeStr = formatTime(timestamp);
  const playerClass = getPlayerColorClass(sender.id, sender.type);

  // 渲染消息内容
  const renderContent = () => {
    switch (type) {
      case 'chat':
      case 'normal': {
        // 兼容两种格式：content 可能是字符串或对象
        const chatContent = typeof content === 'string' 
          ? { text: content } 
          : content as { text: string; emotion?: EmotionType; replyTo?: string };
        const emotionEmoji = chatContent.emotion ? emotionEmojis[chatContent.emotion] : null;
        
        return (
          <div className="message-text">
            {chatContent.replyTo && (
              <div className="reply-to">
                回复: {chatContent.replyTo}
              </div>
            )}
            <span className="text">{chatContent.text}</span>
            {emotionEmoji && (
              <span className="emotion-emoji" title={chatContent.emotion}>
                {emotionEmoji}
              </span>
            )}
          </div>
        );
      }

      case 'action': {
        const actionContent = content as {
          text: string;
          action: ActionType;
          tile?: string;
          targetTile?: string;
        };
        const actionEmoji = actionEmojis[actionContent.action];
        
        return (
          <div className="message-action">
            <span className="action-emoji">{actionEmoji}</span>
            <span className="action-text">{actionContent.text}</span>
            {actionContent.tile && (
              <span className="action-tile">{actionContent.tile}</span>
            )}
          </div>
        );
      }

      case 'system': {
        const systemContent = content as { notification: string; level?: NotificationLevel };
        const levelClass = getNotificationClass(systemContent.level);
        
        return (
          <div className={`message-system ${levelClass}`}>
            <span className="system-icon">🔔</span>
            <span className="system-text">{systemContent.notification}</span>
          </div>
        );
      }

      default:
        return <div className="message-text">未知消息类型</div>;
    }
  };

  // 系统消息居中显示
  if (type === 'system') {
    return (
      <div className={`message-bubble system ${playerClass}`} data-message-id={id}>
        {renderContent()}
      </div>
    );
  }

  return (
    <div
      className={`message-bubble ${type} ${playerClass} ${isMyMessage ? 'self' : 'other'}`}
      data-message-id={id}
    >
      {!isMyMessage && showSender && (
        <div className="message-avatar">
          <div className="avatar-image">{avatar}</div>
        </div>
      )}

      <div className="message-content">
        {!isMyMessage && showSender && (
          <div className="message-header">
            <span className="sender-name">{sender.name}</span>
            <span className="message-time">{timeStr}</span>
          </div>
        )}

        <div className={`message-body ${type}`}>
          {renderContent()}
        </div>

        {isMyMessage && (
          <div className="message-time self">{timeStr}</div>
        )}
      </div>

      {isMyMessage && (
        <div className="message-avatar self">
          <div className="avatar-image">{avatar}</div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
