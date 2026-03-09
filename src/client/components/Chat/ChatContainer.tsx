/**
 * 群聊容器组件
 * 消息列表滚动显示
 * 输入框和发送按钮
 * 订阅 room:chat 事件
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, MessageSender, ChatTextContent } from '../../../shared/types/chat';
import { MessageBubble } from './MessageBubble';
import './Chat.css';

export interface ChatContainerProps {
  /** 当前玩家 ID */
  myPlayerId: string;
  /** 当前玩家名称 */
  myPlayerName: string;
  /** 当前玩家类型 */
  myPlayerType: 'human' | 'ai-agent';
  /** 消息列表 */
  messages: ChatMessage[];
  /** 发送消息回调 */
  onSendMessage?: (content: ChatTextContent) => void;
  /** 是否显示输入框 */
  showInput?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 最大消息数 */
  maxMessages?: number;
}

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 群聊容器组件
 */
export const ChatContainer: React.FC<ChatContainerProps> = ({
  myPlayerId,
  myPlayerName,
  myPlayerType,
  messages,
  onSendMessage,
  showInput = true,
  className = '',
  maxMessages = 50,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // 限制显示的消息数量
  const displayMessages = messages.slice(-maxMessages);

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && autoScroll) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  // 新消息到达时自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * 处理滚动事件
   * 检测用户是否手动滚动，如果是则暂停自动滚动
   */
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isNearBottom);
    }
  }, []);

  /**
   * 处理发送消息
   */
  const handleSend = useCallback(() => {
    if (!inputText.trim() || !onSendMessage) return;

    const content: ChatTextContent = {
      text: inputText.trim(),
    };

    onSendMessage(content);
    setInputText('');
    setAutoScroll(true);
  }, [inputText, onSendMessage]);

  /**
   * 处理按键事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleSend();
      }
    },
    [handleSend]
  );

  /**
   * 判断是否为当前用户的消息
   */
  const isMyMessage = useCallback(
    (sender: MessageSender) => sender.id === myPlayerId,
    [myPlayerId]
  );

  /**
   * 快捷消息
   */
  const quickMessages = [
    '快点打！',
    '这把不错',
    '求别点炮',
    '听牌了~',
    '🤬',
  ];

  /**
   * 发送快捷消息
   */
  const handleQuickMessage = useCallback(
    (text: string) => {
      if (onSendMessage) {
        onSendMessage({ text });
        setAutoScroll(true);
      }
    },
    [onSendMessage]
  );

  return (
    <div className={`chat-container ${className}`}>
      {/* 消息列表 */}
      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {displayMessages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">🀄</div>
            <div className="empty-text">暂无消息</div>
            <div className="empty-hint">开始聊天或发送动作吧~</div>
          </div>
        ) : (
          <>
            {displayMessages.filter(Boolean).map((message, index) => {
              // 安全检查：确保消息和 sender 存在
              if (!message || !message.sender) {
                return null;
              }
              
              // 判断是否需要显示发送者信息
              const prevMessage = displayMessages[index - 1];
              const showSender =
                !prevMessage ||
                !prevMessage.sender ||
                prevMessage.sender.id !== message.sender.id ||
                message.timestamp - prevMessage.timestamp > 60000; // 1 分钟内合并

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMyMessage={isMyMessage(message.sender)}
                  showSender={showSender}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* 新消息提示 */}
        {!autoScroll && messages.length > 0 && (
          <button
            className="scroll-to-bottom-btn"
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
          >
            ↓ 新消息
          </button>
        )}
      </div>

      {/* 输入区 */}
      {showInput && (
        <div className="chat-input-area">
          {/* 快捷消息 */}
          <div className="quick-messages">
            {quickMessages.map((msg, idx) => (
              <button
                key={idx}
                className="quick-message-btn"
                onClick={() => handleQuickMessage(msg)}
              >
                {msg}
              </button>
            ))}
          </div>

          {/* 输入框 */}
          <div className="input-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="输入消息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={200}
            />
            <button
              className={`send-btn ${inputText.trim() ? 'active' : ''}`}
              onClick={handleSend}
              disabled={!inputText.trim()}
            >
              发送
            </button>
          </div>

          {/* 字数提示 */}
          <div className="input-hint">
            <span className={inputText.length >= 180 ? 'warning' : ''}>
              {inputText.length}/200
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 聊天容器状态管理 Hook
 */
export function useChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  /**
   * 添加消息
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  /**
   * 添加多条消息
   */
  const addMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMessages]);
  }, []);

  /**
   * 清除消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * 创建新消息
   */
  const createMessage = useCallback(
    (
      sender: MessageSender,
      type: ChatMessage['type'],
      content: ChatMessage['content']
    ): ChatMessage => {
      return {
        id: generateMessageId(),
        timestamp: Date.now(),
        sender,
        type,
        content,
      };
    },
    []
  );

  return {
    messages,
    setMessages,
    addMessage,
    addMessages,
    clearMessages,
    createMessage,
  };
}

export default ChatContainer;
