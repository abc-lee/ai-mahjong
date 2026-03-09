/**
 * 麻将牌组件 - 彩色SVG风格
 */
import React from 'react';
import { motion } from 'framer-motion';
import type { Tile, Suit } from '../../../shared/types';
import { MahjongTileSVG } from './MahjongTileSVG';
import styles from './Tile.module.css';

export interface TileProps {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// 尺寸映射
const SIZE_MAP: Record<string, number> = {
  small: 28,
  medium: 48,
  large: 56,
};

export const TileComponent: React.FC<TileProps> = ({
  tile,
  selected = false,
  onClick,
  disabled = false,
  size = 'medium',
}) => {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const svgSize = SIZE_MAP[size];

  return (
    <motion.div
      className={`${styles.tile} ${styles[size]} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''} ${!disabled && onClick ? styles.clickable : ''}`}
      onClick={handleClick}
      whileHover={!disabled && onClick ? { scale: 1.05 } : undefined}
      whileTap={!disabled && onClick ? { scale: 0.95 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <MahjongTileSVG
        suit={tile.suit}
        value={tile.value}
        selected={selected}
        size={svgSize}
      />
    </motion.div>
  );
};

export default TileComponent;
