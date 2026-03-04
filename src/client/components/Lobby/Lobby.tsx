/**
 * 大厅主组件 - 麻将桌绿色背景
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Room } from '@shared/types';
import { RoomCard } from './RoomCard';
import { CreateRoomModal } from './CreateRoomModal';
import { socket, getRoomList, createRoom, joinRoom } from '@client/socket';
import { useConnected } from '@client/store';

interface LobbyProps {
  onJoinRoom: (roomId: string, room: Room) => void;
}

const styles: Record<string, React.CSSProperties> = {
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
    fontSize: '48px', fontWeight: 'bold', color: '#ffd700',
    textShadow: '3px 3px 0 #8b0000', fontFamily: 'sans-serif', marginBottom: '8px',
  },
  subtitle: { fontSize: '16px', color: '#a3e635', fontFamily: 'sans-serif' },
  connectionStatus: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '20px', marginBottom: '16px',
  },
  statusDot: { width: '10px', height: '10px', borderRadius: '50%' },
  statusConnected: { backgroundColor: '#4ade80', boxShadow: '0 0 8px #4ade80' },
  statusDisconnected: { backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' },
  statusText: { fontSize: '14px', color: '#f3f4f6', fontFamily: 'sans-serif' },
  controls: { display: 'flex', gap: '16px', marginBottom: '24px' },
  button: {
    padding: '14px 28px', fontSize: '18px', fontWeight: 'bold', borderRadius: '8px',
    cursor: 'pointer', fontFamily: 'sans-serif', border: '4px solid',
    boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.3), 4px 4px 0 rgba(0,0,0,0.4)',
  },
  createButton: { backgroundColor: '#c41e3a', color: '#ffd700', borderColor: '#8b0000' },
  refreshButton: { backgroundColor: '#fbbf24', color: '#78350f', borderColor: '#92400e' },
  disabledButton: { opacity: 0.6, cursor: 'not-allowed' },
  roomList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', width: '100%', maxWidth: '1200px' },
  emptyState: { textAlign: 'center', padding: '48px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '3px dashed rgba(255, 255, 255, 0.3)', maxWidth: '400px' },
  emptyText: { fontSize: '18px', color: '#a3e635', fontFamily: 'sans-serif', marginBottom: '12px' },
  emptyHint: { fontSize: '14px', color: 'rgba(163, 230, 53, 0.7)', fontFamily: 'sans-serif' },
  loading: { display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', color: '#a3e635', fontFamily: 'sans-serif' },
  spinner: { width: '24px', height: '24px', border: '3px solid rgba(163, 230, 53, 0.3)', borderTopColor: '#a3e635', borderRadius: '50%', animation: 'spin 1s linear infinite' },
};

export const Lobby: React.FC<LobbyProps> = ({ onJoinRoom }) => {
  const isConnected = useConnected();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // 获取房间列表
  const fetchRooms = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    try {
      const response = await getRoomList();
      setRooms(response.rooms);
    } catch (err) {
      console.error('获取房间列表失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 创建房间
  const handleCreateRoom = useCallback(async (playerName: string) => {
    if (!isConnected) return;
    setIsCreating(true);
    try {
      const response = await createRoom(playerName);
      setIsCreateModalOpen(false);
      onJoinRoom(response.roomId, response.room);
    } catch (err) {
      alert('创建失败: ' + (err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [isConnected, onJoinRoom]);

  // 加入房间
  const handleJoinRoom = useCallback(async (room: Room) => {
    if (!isConnected) return;
    const playerName = prompt('请输入你的名称:');
    if (!playerName) return;
    setJoiningRoomId(room.id);
    try {
      const response = await joinRoom(room.id, playerName);
      onJoinRoom(response.roomId, response.room);
    } catch (err) {
      alert('加入失败: ' + (err as Error).message);
    } finally {
      setJoiningRoomId(null);
    }
  }, [isConnected, onJoinRoom]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <motion.h1 style={styles.title} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          麻将大厅
        </motion.h1>
        <p style={styles.subtitle}>与 AI 一起享受麻将乐趣</p>
        <motion.div style={styles.connectionStatus} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ ...styles.statusDot, ...(isConnected ? styles.statusConnected : styles.statusDisconnected) }} />
          <span style={styles.statusText}>{isConnected ? '已连接' : '连接中...'}</span>
        </motion.div>
      </div>

      <motion.div style={styles.controls} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <motion.button
          style={{ ...styles.button, ...styles.createButton, ...(!isConnected ? styles.disabledButton : {}) }}
          onClick={() => setIsCreateModalOpen(true)}
          disabled={!isConnected}
          whileHover={isConnected ? { scale: 1.05 } : {}}
          whileTap={isConnected ? { scale: 0.95 } : {}}
        >
          创建房间
        </motion.button>
        <motion.button
          style={{ ...styles.button, ...styles.refreshButton, ...(isLoading || !isConnected ? styles.disabledButton : {}) }}
          onClick={fetchRooms}
          disabled={isLoading || !isConnected}
          whileHover={!isLoading && isConnected ? { scale: 1.05 } : {}}
          whileTap={!isLoading && isConnected ? { scale: 0.95 } : {}}
        >
          {isLoading ? '刷新中...' : '刷新列表'}
        </motion.button>
      </motion.div>

      {isLoading && rooms.length === 0 ? (
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span>加载中...</span>
        </div>
      ) : rooms.length === 0 ? (
        <motion.div style={styles.emptyState} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={styles.emptyText}>暂无房间</p>
          <p style={styles.emptyHint}>点击创建房间开始游戏</p>
        </motion.div>
      ) : (
        <motion.div style={styles.roomList} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {rooms.map((room, index) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <RoomCard
                room={room}
                onJoin={() => handleJoinRoom(room)}
                isJoining={joiningRoomId === room.id}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateRoom}
        isCreating={isCreating}
      />

      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  );
};

export default Lobby;
