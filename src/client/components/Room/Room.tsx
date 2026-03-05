/**
 * 房间等待组件
 * 显示房间信息和玩家准备状态
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentRoom, usePlayerInfo, useIsHost, useGameStore } from '../../store';
import { PlayerPublic } from '../../../shared/types';
import { SEAT_NAMES } from '../../../shared/constants';
import { setReady, startGame, leaveRoom, socket } from '../../socket';
import { PlayerSlot } from './PlayerSlot';
import './Room.css';

export interface RoomProps {
  onLeave?: () => void;
}

export const Room: React.FC<RoomProps> = ({ onLeave }) => {
  const navigate = useNavigate();
  const currentRoom = useCurrentRoom();
  const { playerId, playerName } = usePlayerInfo();
  const isHost = useIsHost();
  const setCurrentRoom = useGameStore((state) => state.setCurrentRoom);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 监听 game:started 事件跳转到游戏页面
  useEffect(() => {
    const handleGameStarted = () => {
      console.log('[Room] 收到 game:started，跳转到游戏页面');
      if (currentRoom) {
        navigate(`/game/${currentRoom.id}`);
      }
    };

    socket.on('game:started', handleGameStarted);

    return () => {
      socket.off('game:started', handleGameStarted);
    };
  }, [currentRoom, navigate]);

  // 当房间状态变为 playing 时也跳转
  useEffect(() => {
    if (currentRoom && currentRoom.state === 'playing') {
      console.log('[Room] 房间状态变为 playing，跳转到游戏页面');
      navigate(`/game/${currentRoom.id}`);
    }
  }, [currentRoom, navigate]);

  // 获取当前玩家的准备状态
  const currentPlayer = currentRoom?.players.find((p) => p.id === playerId);
  const myReadyState = currentPlayer?.isReady ?? false;

  // 检查是否所有玩家都已准备
  const allReady = currentRoom && currentRoom.players.length === 4 &&
    currentRoom.players.every((p) => p.isReady);

  // 复制房间ID
  const handleCopyRoomId = useCallback(() => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [currentRoom]);

  // 切换准备状态
  const handleToggleReady = useCallback(async () => {
    console.log('[Room] 点击准备按钮, 当前状态:', myReadyState);
    try {
      const newReadyState = !myReadyState;
      console.log('[Room] 发送准备请求:', newReadyState);
      const response = await setReady(newReadyState);
      console.log('[Room] 准备响应:', response);
      if (response.room) {
        setCurrentRoom(response.room);
      }
    } catch (error) {
      console.error('[Room] 准备失败:', error);
    }
  }, [myReadyState, setCurrentRoom]);

  // 开始游戏
  const handleStartGame = useCallback(async () => {
    if (!allReady || !isHost) return;
    
    setIsStarting(true);
    try {
      await startGame();
    } catch (error) {
      console.error('Failed to start game:', error);
      setIsStarting(false);
    }
  }, [allReady, isHost]);

  // 离开房间
  const handleLeave = useCallback(async () => {
    try {
      console.log('[Room] 点击离开房间');
      await leaveRoom();
      console.log('[Room] 离开房间成功');
      // 清除房间状态
      setCurrentRoom(null);
      // 导航到首页
      navigate('/');
      onLeave?.();
    } catch (error) {
      console.error('[Room] 离开房间失败:', error);
      // 即使失败也清除状态并返回首页
      setCurrentRoom(null);
      navigate('/');
    }
  }, [setCurrentRoom, navigate, onLeave]);

  // 获取指定位置的玩家
  const getPlayerByPosition = (pos: number): PlayerPublic | undefined => {
    return currentRoom?.players.find((p) => p.position === pos);
  };

  if (!currentRoom) {
    return <div className="room-loading">加载中...</div>;
  }

  return (
    <div className="room-container">
      {/* 房间信息头部 */}
      <div className="room-header">
        <h2 className="room-title">麻将房间</h2>
        <div className="room-id-section">
          <span className="room-id-label">房间号：</span>
          <span className="room-id-value">{currentRoom.id}</span>
          <button
            className="copy-btn"
            onClick={handleCopyRoomId}
            title="复制房间号"
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      {/* 玩家槽位布局 */}
      <div className="players-grid">
        {/* 北 - 上 */}
        <div className="slot-wrapper slot-top">
          <PlayerSlot
            player={getPlayerByPosition(3)}
            position={3}
            isHost={currentRoom.host === getPlayerByPosition(3)?.id}
            isMe={getPlayerByPosition(3)?.id === playerId}
          />
        </div>

        {/* 西 - 左 */}
        <div className="slot-wrapper slot-left">
          <PlayerSlot
            player={getPlayerByPosition(2)}
            position={2}
            isHost={currentRoom.host === getPlayerByPosition(2)?.id}
            isMe={getPlayerByPosition(2)?.id === playerId}
          />
        </div>

        {/* 中央信息区 */}
        <div className="center-info">
          <div className="player-count">
            玩家：{currentRoom.players.length} / 4
          </div>
          {currentRoom.players.length < 4 && (
            <div className="waiting-message">等待玩家加入...</div>
          )}
        </div>

        {/* 东 - 右 */}
        <div className="slot-wrapper slot-right">
          <PlayerSlot
            player={getPlayerByPosition(0)}
            position={0}
            isHost={currentRoom.host === getPlayerByPosition(0)?.id}
            isMe={getPlayerByPosition(0)?.id === playerId}
          />
        </div>

        {/* 南 - 下（自己） */}
        <div className="slot-wrapper slot-bottom">
          <PlayerSlot
            player={getPlayerByPosition(1)}
            position={1}
            isHost={currentRoom.host === getPlayerByPosition(1)?.id}
            isMe={getPlayerByPosition(1)?.id === playerId}
          />
        </div>
      </div>

      {/* 操作按钮区 */}
      <div className="room-actions">
        {/* 准备按钮 */}
        <button
          className={`ready-btn ${myReadyState ? 'cancel' : ''}`}
          onClick={handleToggleReady}
        >
          {myReadyState ? '取消准备' : '准备'}
        </button>

        {/* 开始游戏按钮 - 仅房主可见 */}
        {isHost && (
          <button
            className="start-btn"
            onClick={handleStartGame}
            disabled={!allReady || isStarting}
          >
            {isStarting ? '开始中...' : '开始游戏'}
          </button>
        )}

        {/* 离开房间按钮 */}
        <button className="leave-btn" onClick={handleLeave}>
          离开房间
        </button>
      </div>

      {/* 提示信息 */}
      {!allReady && currentRoom.players.length === 4 && (
        <div className="room-hint">
          等待所有玩家准备...
        </div>
      )}
    </div>
  );
};

export default Room;
