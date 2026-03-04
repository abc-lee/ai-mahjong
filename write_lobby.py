import os

lobby_content = '''/**
 * 大厅主组件 - 麻将桌绿色背景
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Room } from '@shared/types';
import { ClientEvents, ServerEvents } from '@client/socket/events';
import { RoomCard } from './RoomCard';
import { CreateRoomModal } from './CreateRoomModal';

interface Socket {
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
}

interface LobbyProps {
  socket: Socket | null;
  isConnected: boolean;
  onJoinRoom: (roomId: string, room: Room) => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1a472a',
    backgroundImage: 'radial-gradient(ellipse at center, #2d5016 0%, #1a472a 70%)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: { textAlign: 'center', marginBottom: '32px' },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#ffd700',
    textShadow: '3px 3px 0 #8b0000',
    fontFamily: '"Microsoft YaHei", sans-serif',
    marginBottom: '8px',
  },
  subtitle: { fontSize: '16px', color: '#a3e635', fontFamily: '"Microsoft YaHei", sans-serif' },
  connectionStatus: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '20px', marginBottom: '16px',
  },
  statusDot: { width: '10px', height: '10px', borderRadius: '50%' },
  statusConnected: { backgroundColor: '#4ade80', boxShadow: '0 0 8px #4ade80' },
  statusDisconnected: { backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' },
  statusText: { fontSize: '14px', color: '#f3f4f6', fontFamily: '"Microsoft YaHei", sans-serif' },
  controls: { display: 'flex', gap: '16px', marginBottom: '24px' },
  button: {
    padding: '14px 28px', fontSize: '18px', fontWeight: 'bold', borderRadius: '8px',
    cursor: 'pointer', fontFamily: '"Microsoft YaHei", sans-serif',
    border: '4px solid', boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.3), 4px 4px 0 rgba(0,0,0,0.4)',
    transition: 'transform 0.1s',
  },
  createButton: { backgroundColor: '#c41e3a', color: '#ffd700', borderColor: '#8b0000' },
  refreshButton: { backgroundColor: '#fbbf24', color: '#78350f', borderColor: '#92400e' },
  disabledButton: { opacity: 0.6, cursor: 'not-allowed' },
  roomList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', width: '100%', maxWidth: '1200px' },
  emptyState: { textAlign: 'center', padding: '48px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '3px dashed rgba(255, 255, 255, 0.3)', width: '100%', maxWidth: '400px' },
  emptyText: { fontSize: '18px', color: '#a3e635', fontFamily: '"Microsoft YaHei", sans-serif', marginBottom: '12px' },
  emptyHint: { fontSize: '14px', color: 'rgba(163, 230, 53, 0.7)', fontFamily: '"Microsoft YaHei", sans-serif' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', color: '#a3e635', fontFamily: '"Microsoft YaHei", sans-serif' },
  spinner: { width: '24px', height: '24px', border: '3px solid rgba(163, 230, 53, 0.3)', borderTopColor: '#a3e635', borderRadius: '50%', animation: 'spin 1s linear infinite' },
};

export const Lobby: React.FC<LobbyProps> = ({ socket, isConnected, onJoinRoom }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const fetchRooms = useCallback(() => {
    if (!socket || !isConnected) return;
    setIsLoading(true);
    socket.emit(ClientEvents.ROOM_LIST);
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket) return;
    const handleRoomList = (response: { rooms: Room[] }) => {
      setRooms(response.rooms);
      setIsLoading(false);
    };
    const handleRoomUpdated = (event: { room: Room }) => {
      setRooms((prev) => {
        const index = prev.findIndex((r) => r.id === event.room.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = event.room;
          return updated;
        }
        return [...prev, event.room];
      });
    };
    socket.on(ServerEvents.ROOM_UPDATED, handleRoomUpdated);
    socket.on('room:list', handleRoomList);
    fetchRooms();
    return () => {
      socket.off(ServerEvents.ROOM_UPDATED, handleRoomUpdated);
      socket.off('room:list', handleRoomList);
    };
  }, [socket, fetchRooms]);

  const handleCreateRoom = useCallback((playerName: string) => {
    if (!socket || !isConnected) return;
    setIsCreating(true);
    socket.emit(ClientEvents.ROOM_CREATE, { playerName }, (response: { roomId?: string; room?: Room; error?: string }) => {
      setIsCreating(false);
      if (response.error) {
        alert('创建失败: ' + response.error);
      } else if (response.roomId && response.room) {
        setIsCreateModalOpen(false);
        onJoinRoom(response.roomId, response.room);
      }
    });
  }, [socket, isConnected, onJoinRoom]);

  const handleJoinRoom = useCallback((room: Room) => {
    if (!socket || !isConnected) return;
    const playerName = prompt('请输入你的名称:');
    if (!playerName) return;
    setJoiningRoomId(room.id);
    socket.emit(ClientEvents.ROOM_JOIN, { roomId: room.id, playerName }, (response: { roomId?: string; room?: Room; error?: string }) => {
      setJoiningRoomId(null);
      if (response.error) {
        alert('加入失败: ' + response.error);
      } else if (response.roomId && response.room) {
        onJoinRoom(response.roomId, response.room);
      }
    });
  }, [socket, isConnected, onJoinRoom]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <motion.h1 style={styles.title} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>麻将大厅</motion.h1>
        <p style={styles.subtitle}>与 AI 一起享受麻将乐趣</p>
        <motion.div style={styles.connectionStatus} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ ...styles.statusDot, ...(isConnected ? styles.statusConnected : styles.statusDisconnected) }} />
          <span style={styles.statusText}>{isConnected ? '已连接' : '连接中...'}</span>
        </motion.div>
      </div>
      <motion.div style={styles.controls} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <motion.button style={{ ...styles.button, ...styles.createButton, ...(!isConnected ? styles.disabledButton : {}) }} onClick={() => setIsCreateModalOpen(true)} disabled={!isConnected} whileHover={isConnected ? { scale: 1.05 } : {}} whileTap={isConnected ? { scale: 0.95 } : {}}>创建房间</motion.button>
        <motion.button style={{ ...styles.button, ...styles.refreshButton, ...(isLoading || !isConnected ? styles.disabledButton : {}) }} onClick={fetchRooms} disabled={isLoading || !isConnected} whileHover={!isLoading && isConnected ? { scale: 1.05 } : {}} whileTap={!isLoading && isConnected ? { scale: 0.95 } : {}}>{isLoading ? '刷新中...' : '刷新列表'}</motion.button>
      </motion.div>
      {isLoading && rooms.length === 0 ? (
        <div style={styles.loading}><div style={styles.spinner} /><span>加载中...</span></div>
      ) : rooms.length === 0 ? (
        <motion.div style={styles.emptyState} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><p style={styles.emptyText}>暂无房间</p><p style={styles.emptyHint}>点击创建房间开始游戏</p></motion.div>
      ) : (
        <motion.div style={styles.roomList} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {rooms.map((room, index) => (
            <motion.div key={room.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <RoomCard room={room} onJoin={() => handleJoinRoom(room)} isJoining={joiningRoomId === room.id} />
        
