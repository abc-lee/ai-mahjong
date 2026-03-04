/**
 * 房间卡片组件 - 木质边框风格
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Room } from '@shared/types';

interface RoomCardProps {
  room: Room;
  onJoin: () => void;
  isJoining?: boolean;
}

// 像素风木质边框样式
const styles: { [key: string]: React.CSSProperties } = {
  card: {
    backgroundColor: '#f5e6d3',
    border: '4px solid #8b4513',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: `
      inset 2px 2px 0 rgba(255,255,255,0.3),
      inset -2px -2px 0 rgba(0,0,0,0.2),
      4px 4px 0 rgba(0,0,0,0.3)
    `,
    position: 'relative',
    backgroundImage: `
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 20px,
        rgba(139, 69, 19, 0.1) 20px,
        rgba(139, 69, 19, 0.1) 21px
      )
    `,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '2px dashed #8b4513',
    paddingBottom: '8px',
  },
  roomName: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2c1810',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
  },
  status: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  statusWaiting: {
    backgroundColor: '#4ade80',
    color: '#166534',
  },
  statusPlaying: {
    backgroundColor: '#fbbf24',
    color: '#78350f',
  },
  statusFinished: {
    backgroundColor: '#94a3b8',
    color: '#334155',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#5d4037',
  },
  label: {
    color: '#8b4513',
  },
  players: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  playerCount: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2c1810',
  },
  joinButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#c41e3a',
    color: '#ffd700',
    border: '3px solid #8b0000',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
    boxShadow: `
      inset 1px 1px 0 rgba(255,255,255,0.3),
      inset -1px -1px 0 rgba(0,0,0,0.3),
      2px 2px 0 rgba(0,0,0,0.3)
    `,
    transition: 'transform 0.1s',
  },
  joinButtonDisabled: {
    backgroundColor: '#94a3b8',
    color: '#e2e8f0',
    border: '3px solid #64748b',
    cursor: 'not-allowed',
  },
};

const getStatusStyle = (state: Room['state']): React.CSSProperties => {
  switch (state) {
    case 'waiting':
      return { ...styles.status, ...styles.statusWaiting };
    case 'playing':
      return { ...styles.status, ...styles.statusPlaying };
    case 'finished':
      return { ...styles.status, ...styles.statusFinished };
  }
};

const getStatusText = (state: Room['state']): string => {
  switch (state) {
    case 'waiting':
      return '等待中';
    case 'playing':
      return '游戏中';
    case 'finished':
      return '已结束';
  }
};

export const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin, isJoining }) => {
  const isFull = room.players.length >= room.settings.maxPlayers;
  const canJoin = room.state === 'waiting' && !isFull;
  const hostName = room.players.find(p => p.id === room.host)?.name || '未知';

  return (
    <motion.div
      style={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div style={styles.header}>
        <span style={styles.roomName}>房间 {room.id.slice(-6)}</span>
        <span style={getStatusStyle(room.state)}>{getStatusText(room.state)}</span>
      </div>

      <div style={styles.info}>
        <div style={styles.infoRow}>
          <span style={styles.label}>房主：</span>
          <span>{hostName}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>玩家：</span>
          <div style={styles.players}>
            <span style={styles.playerCount}>
              {room.players.length} / {room.settings.maxPlayers}
            </span>
          </div>
        </div>
        {room.settings.allowSpectators && (
          <div style={styles.infoRow}>
            <span style={styles.label}>观战：</span>
            <span>✓ 允许</span>
          </div>
        )}
      </div>

      <motion.button
        style={{
          ...styles.joinButton,
          ...(!canJoin ? styles.joinButtonDisabled : {}),
        }}
        onClick={onJoin}
        disabled={!canJoin || isJoining}
        whileHover={canJoin ? { scale: 1.02 } : {}}
        whileTap={canJoin ? { scale: 0.98 } : {}}
      >
        {isJoining ? '加入中...' : isFull ? '已满员' : room.state !== 'waiting' ? '游戏中' : '加入房间'}
      </motion.button>
    </motion.div>
  );
};

export default RoomCard;
