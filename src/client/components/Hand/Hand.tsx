/**
 * 手牌组件 - 显示玩家手牌
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tile } from '../../../shared/types';
import { TileComponent } from '../Tile';
import styles from './Hand.module.css';

export interface HandProps {
  tiles: Tile[];
  selectedTileId?: string;
  onTileClick?: (tile: Tile) => void;
  disabled?: boolean;
  isMyTurn: boolean;
  hidden?: boolean; // 是否隐藏牌面（其他玩家）
}

export const Hand: React.FC<HandProps> = ({
  tiles,
  selectedTileId,
  onTileClick,
  disabled = false,
  isMyTurn = false,
  hidden = false,
}) => {
  const canInteract = isMyTurn && !disabled;

  return (
    <div className={`${styles.handContainer} ${!isMyTurn ? styles.notMyTurn : ''}`}>
      <div className={styles.handScroll}>
        <motion.div 
          className={styles.handTiles}
          layout
        >
          <AnimatePresence mode="popLayout">
            {tiles.map((tile, index) => (
              <motion.div
                key={tile.id}
                className={`${styles.tileWrapper} ${hidden ? styles.hiddenTile : ''}`}
                layout
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ 
                  type: 'spring',
                  stiffness: 300,
                  damping: 25,
                  delay: index * 0.02,
                }}
              >
                {hidden ? (
                  <div className={styles.tileBack}>
                    <div className={styles.tileBackInner} />
                  </div>
                ) : (
                  <TileComponent
                    tile={tile}
                    selected={selectedTileId === tile.id}
                    onClick={canInteract ? () => onTileClick?.(tile) : undefined}
                    disabled={!canInteract}
                    size="medium"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
      
      {/* 回合指示器 */}
      {isMyTurn && (
        <motion.div
          className={styles.turnIndicator}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          你的回合
        </motion.div>
      )}
    </div>
  );
};

export default Hand;
