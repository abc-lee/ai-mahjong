/**
 * 牌堆组件 - 显示多张牌的堆叠效果
 */
import React from 'react';
import { motion } from 'framer-motion';
import type { Tile } from '../../../shared/types';
import { TileComponent } from './Tile';
import styles from './Tile.module.css';

export interface TileStackProps {
  tiles: Tile[];
  maxVisible?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  faceDown?: boolean;
}

export const TileStack: React.FC<TileStackProps> = ({
  tiles,
  maxVisible = 4,
  size = 'medium',
  showCount = true,
  faceDown = false,
}) => {
  const visibleTiles = tiles.slice(0, maxVisible);
  const remainingCount = Math.max(0, tiles.length - maxVisible);

  return (
    <div className={styles.stackContainer}>
      <div className={styles.stackWrapper}>
        {visibleTiles.map((tile, index) => (
          <motion.div
            key={tile.id}
            className={`${styles.stackItem} ${faceDown ? styles.tileBack : ''}`}
            style={{
              zIndex: index,
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ 
              opacity: 1, 
              x: index * -3,
              y: index * -2,
            }}
            transition={{ delay: index * 0.05 }}
          >
            <TileComponent
              tile={tile}
              size={size}
              disabled
            />
          </motion.div>
        ))}
      </div>
      {showCount && tiles.length > maxVisible && (
        <div className={styles.stackCount}>
          +{remainingCount}
        </div>
      )}
      {showCount && tiles.length > 1 && (
        <div className={styles.stackTotal}>
          共 {tiles.length} 张
        </div>
      )}
    </div>
  );
};

export default TileStack;
