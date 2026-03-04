/**
 * 麻将牌组件 - 中国像素风格
 */
import React from 'react';
import { motion } from 'framer-motion';
import type { Tile, Suit } from '../../../shared/types';
import styles from './Tile.module.css';

export interface TileProps {
  tile: Tile;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// 牌面颜色映射
const SUIT_COLORS: Record<Suit, string> = {
  wan: '#c41e3a',   // 万 - 红色
  tiao: '#228b22',  // 条 - 绿色
  tong: '#1e90ff',  // 筒 - 蓝色
  feng: '#1a1a1a',  // 风 - 黑色
  jian: '#c41e3a',  // 箭 - 红色（红中、发财用绿色）
};

// 获取牌面显示符号
function getTileSymbol(tile: Tile): string {
  const { suit, value } = tile;
  
  if (suit === 'wan') {
    return ['一', '二', '三', '四', '五', '六', '七', '八', '九'][value - 1];
  }
  if (suit === 'tiao') {
    return ['一', '二', '三', '四', '五', '六', '七', '八', '九'][value - 1];
  }
  if (suit === 'tong') {
    return ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'][value - 1];
  }
  if (suit === 'feng') {
    return ['東', '南', '西', '北'][value - 1];
  }
  if (suit === 'jian') {
    return ['中', '發', '白'][value - 1];
  }
  return '?';
}

// 获取牌面花色符号
function getSuitSymbol(tile: Tile): string {
  const { suit } = tile;
  if (suit === 'wan') return '萬';
  if (suit === 'tiao') return '條';
  if (suit === 'tong') return '筒';
  return '';
}

// 获取特殊颜色（箭牌）
function getSpecialColor(tile: Tile): string | null {
  if (tile.suit === 'jian') {
    if (tile.value === 1) return '#c41e3a'; // 红中 - 红
    if (tile.value === 2) return '#228b22'; // 发财 - 绿
    if (tile.value === 3) return '#2d2d2d'; // 白板 - 深灰
  }
  return null;
}

export const TileComponent: React.FC<TileProps> = ({
  tile,
  selected = false,
  onClick,
  disabled = false,
  size = 'medium',
}) => {
  const symbol = getTileSymbol(tile);
  const suitSymbol = getSuitSymbol(tile);
  const color = getSpecialColor(tile) || SUIT_COLORS[tile.suit];
  const isHonor = tile.suit === 'feng' || tile.suit === 'jian';
  
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <motion.div
      className={`${styles.tile} ${styles[size]} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''} ${!disabled && onClick ? styles.clickable : ''}`}
      onClick={handleClick}
      whileHover={!disabled && onClick ? { scale: 1.1, y: -8 } : undefined}
      whileTap={!disabled && onClick ? { scale: 0.95 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <div className={styles.tileInner}>
        <div className={styles.tileFace}>
          {/* 像素风格装饰角 */}
          <div className={styles.cornerTL} />
          <div className={styles.cornerTR} />
          <div className={styles.cornerBL} />
          <div className={styles.cornerBR} />
          
          {/* 牌面内容 */}
          <div className={styles.content} style={{ color }}>
            {isHonor ? (
              <span className={styles.honorText}>{symbol}</span>
            ) : (
              <>
                <span className={styles.numberText}>{symbol}</span>
                {suitSymbol && <span className={styles.suitText}>{suitSymbol}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TileComponent;
