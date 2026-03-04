/**
 * 创建房间弹窗 - 像素风格中式设计
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (playerName: string) => void;
  isCreating?: boolean;
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#f5e6d3',
    border: '6px solid #8b4513',
    borderRadius: '12px',
    padding: '32px',
    minWidth: '320px',
    maxWidth: '90vw',
    boxShadow: `
      inset 3px 3px 0 rgba(255,255,255,0.4),
      inset -3px -3px 0 rgba(0,0,0,0.2),
      8px 8px 0 rgba(0,0,0,0.4)
    `,
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 30px,
        rgba(139, 69, 19, 0.08) 30px,
        rgba(139, 69, 19, 0.08) 31px
      )
    `,
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2c1810',
    textAlign: 'center',
    marginBottom: '24px',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
    textShadow: '2px 2px 0 rgba(139, 69, 19, 0.3)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#8b4513',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
  },
  input: {
    padding: '12px 16px',
    fontSize: '16px',
    border: '3px solid #8b4513',
    borderRadius: '4px',
    backgroundColor: '#fffef5',
    color: '#2c1810',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
    outline: 'none',
    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  button: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '16px',
    fontWeight: 'bold',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
    border: '3px solid',
    boxShadow: `
      inset 1px 1px 0 rgba(255,255,255,0.3),
      inset -1px -1px 0 rgba(0,0,0,0.2),
      3px 3px 0 rgba(0,0,0,0.3)
    `,
    transition: 'transform 0.1s',
  },
  createButton: {
    backgroundColor: '#c41e3a',
    color: '#ffd700',
    borderColor: '#8b0000',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    color: '#f3f4f6',
    borderColor: '#4b5563',
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  decoration: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#c41e3a',
    color: '#ffd700',
    padding: '4px 16px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    border: '2px solid #8b0000',
    fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
  },
};

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}) => {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && !isCreating) {
      onCreate(playerName.trim());
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setPlayerName('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            style={{ ...styles.modal, position: 'relative' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装饰标签 */}
            <div style={styles.decoration}>麻将</div>

            <h2 style={styles.title}>创建房间</h2>

            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.inputGroup}>
                <label style={styles.label} htmlFor="playerName">
                  你的名称
                </label>
                <input
                  id="playerName"
                  type="text"
                  style={styles.input}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="请输入名称..."
                  maxLength={12}
                  autoFocus
                  disabled={isCreating}
                />
              </div>

              <div style={styles.buttonGroup}>
                <motion.button
                  type="button"
                  style={{ ...styles.button, ...styles.cancelButton }}
                  onClick={handleClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isCreating}
                >
                  取消
                </motion.button>
                <motion.button
                  type="submit"
                  style={{
                    ...styles.button,
                    ...styles.createButton,
                    ...(!playerName.trim() || isCreating ? styles.disabledButton : {}),
                  }}
                  whileHover={playerName.trim() && !isCreating ? { scale: 1.02 } : {}}
                  whileTap={playerName.trim() && !isCreating ? { scale: 0.98 } : {}}
                  disabled={!playerName.trim() || isCreating}
                >
                  {isCreating ? '创建中...' : '创建'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateRoomModal;
