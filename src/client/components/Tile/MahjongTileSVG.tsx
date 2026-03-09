/**
 * 彩色麻将牌 SVG 组件
 * 使用 SVG 绘制麻将牌，支持万、条、筒、风、箭五种花色
 */

import React from 'react';

export interface MahjongTileSVGProps {
  suit: 'wan' | 'tiao' | 'tong' | 'feng' | 'jian';
  value: number;
  selected?: boolean;
  className?: string;
  size?: number; // 宽度，默认48
}

// 中文数字
const CHINESE_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WIND_NAMES = ['東', '南', '西', '北'];
const ARROW_NAMES = ['中', '發', ' ']; // 白板无字

// 颜色方案
const COLORS = {
  wan: '#c41e3a',   // 红色
  tiao: '#228b22',  // 绿色
  tong: '#1e90ff',  // 蓝色
  feng: '#1a1a1a',  // 黑色
  jian: {
    1: '#c41e3a',   // 红中 - 红色
    2: '#228b22',   // 发财 - 绿色
    3: '#888888',   // 白板 - 灰边
  }
};

/**
 * 绘制筒子图案
 */
function drawTongPattern(value: number, color: string): JSX.Element {
  const patterns: Record<number, JSX.Element> = {
    1: <circle cx="24" cy="32" r="12" fill={color} stroke={color} strokeWidth="1" />,
    2: (
      <g>
        <circle cx="24" cy="22" r="8" fill={color} />
        <circle cx="24" cy="42" r="8" fill={color} />
      </g>
    ),
    3: (
      <g>
        <circle cx="24" cy="16" r="6" fill={color} />
        <circle cx="16" cy="36" r="6" fill={color} />
        <circle cx="32" cy="36" r="6" fill={color} />
      </g>
    ),
    4: (
      <g>
        <circle cx="16" cy="22" r="6" fill={color} />
        <circle cx="32" cy="22" r="6" fill={color} />
        <circle cx="16" cy="42" r="6" fill={color} />
        <circle cx="32" cy="42" r="6" fill={color} />
      </g>
    ),
    5: (
      <g>
        <circle cx="16" cy="20" r="5" fill={color} />
        <circle cx="32" cy="20" r="5" fill={color} />
        <circle cx="24" cy="32" r="6" fill={color} />
        <circle cx="16" cy="44" r="5" fill={color} />
        <circle cx="32" cy="44" r="5" fill={color} />
      </g>
    ),
    6: (
      <g>
        <circle cx="16" cy="18" r="5" fill={color} />
        <circle cx="32" cy="18" r="5" fill={color} />
        <circle cx="16" cy="32" r="5" fill={color} />
        <circle cx="32" cy="32" r="5" fill={color} />
        <circle cx="16" cy="46" r="5" fill={color} />
        <circle cx="32" cy="46" r="5" fill={color} />
      </g>
    ),
    7: (
      <g>
        <circle cx="24" cy="14" r="4" fill={color} />
        <circle cx="14" cy="28" r="4" fill={color} />
        <circle cx="34" cy="28" r="4" fill={color} />
        <circle cx="14" cy="42" r="4" fill={color} />
        <circle cx="34" cy="42" r="4" fill={color} />
        <circle cx="20" cy="50" r="4" fill={color} />
        <circle cx="28" cy="50" r="4" fill={color} />
      </g>
    ),
    8: (
      <g>
        <circle cx="16" cy="16" r="4" fill={color} />
        <circle cx="32" cy="16" r="4" fill={color} />
        <circle cx="24" cy="26" r="4" fill={color} />
        <circle cx="16" cy="36" r="4" fill={color} />
        <circle cx="32" cy="36" r="4" fill={color} />
        <circle cx="24" cy="46" r="4" fill={color} />
        <circle cx="16" cy="54" r="4" fill={color} />
        <circle cx="32" cy="54" r="4" fill={color} />
      </g>
    ),
    9: (
      <g>
        <circle cx="14" cy="16" r="4" fill={color} />
        <circle cx="24" cy="16" r="4" fill={color} />
        <circle cx="34" cy="16" r="4" fill={color} />
        <circle cx="14" cy="32" r="4" fill={color} />
        <circle cx="24" cy="32" r="4" fill={color} />
        <circle cx="34" cy="32" r="4" fill={color} />
        <circle cx="14" cy="48" r="4" fill={color} />
        <circle cx="24" cy="48" r="4" fill={color} />
        <circle cx="34" cy="48" r="4" fill={color} />
      </g>
    ),
  };
  return patterns[value] || patterns[1];
}

/**
 * 绘制条子图案（竹节）
 */
function drawTiaoPattern(value: number, color: string): JSX.Element {
  // 条子用竹节形状表示
  const drawBamboo = (x: number, y: number, height: number) => (
    <g>
      <rect x={x - 3} y={y} width="6" height={height} fill={color} rx="2" />
      <line x1={x - 3} y1={y + height * 0.3} x2={x + 3} y2={y + height * 0.3} stroke="#fff" strokeWidth="0.5" opacity="0.5" />
      <line x1={x - 3} y1={y + height * 0.7} x2={x + 3} y2={y + height * 0.7} stroke="#fff" strokeWidth="0.5" opacity="0.5" />
    </g>
  );

  const patterns: Record<number, JSX.Element> = {
    1: (
      <g>
        {/* 一条：一只鸟或单个竹节 */}
        <rect x="18" y="20" width="12" height="28" fill={color} rx="3" />
        <line x1="18" y1="28" x2="30" y2="28" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
        <line x1="18" y1="40" x2="30" y2="40" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
      </g>
    ),
    2: (
      <g>
        {drawBamboo(20, 18, 20)}
        {drawBamboo(28, 32, 20)}
      </g>
    ),
    3: (
      <g>
        {drawBamboo(24, 12, 14)}
        {drawBamboo(18, 30, 14)}
        {drawBamboo(30, 38, 14)}
      </g>
    ),
    4: (
      <g>
        {drawBamboo(18, 16, 14)}
        {drawBamboo(30, 16, 14)}
        {drawBamboo(18, 36, 14)}
        {drawBamboo(30, 36, 14)}
      </g>
    ),
    5: (
      <g>
        {drawBamboo(18, 14, 12)}
        {drawBamboo(30, 14, 12)}
        {drawBamboo(24, 28, 12)}
        {drawBamboo(18, 42, 12)}
        {drawBamboo(30, 42, 12)}
      </g>
    ),
    6: (
      <g>
        {drawBamboo(18, 14, 12)}
        {drawBamboo(30, 14, 12)}
        {drawBamboo(18, 30, 12)}
        {drawBamboo(30, 30, 12)}
        {drawBamboo(18, 46, 12)}
        {drawBamboo(30, 46, 12)}
      </g>
    ),
    7: (
      <g>
        {drawBamboo(24, 10, 10)}
        {drawBamboo(16, 24, 10)}
        {drawBamboo(32, 24, 10)}
        {drawBamboo(16, 38, 10)}
        {drawBamboo(32, 38, 10)}
        {drawBamboo(20, 50, 10)}
        {drawBamboo(28, 50, 10)}
      </g>
    ),
    8: (
      <g>
        {drawBamboo(16, 12, 10)}
        {drawBamboo(32, 12, 10)}
        {drawBamboo(24, 22, 10)}
        {drawBamboo(16, 32, 10)}
        {drawBamboo(32, 32, 10)}
        {drawBamboo(24, 42, 10)}
        {drawBamboo(16, 52, 10)}
        {drawBamboo(32, 52, 10)}
      </g>
    ),
    9: (
      <g>
        {drawBamboo(14, 12, 10)}
        {drawBamboo(24, 12, 10)}
        {drawBamboo(34, 12, 10)}
        {drawBamboo(14, 28, 10)}
        {drawBamboo(24, 28, 10)}
        {drawBamboo(34, 28, 10)}
        {drawBamboo(14, 44, 10)}
        {drawBamboo(24, 44, 10)}
        {drawBamboo(34, 44, 10)}
      </g>
    ),
  };
  return patterns[value] || patterns[1];
}

/**
 * 绘制万字图案
 */
function drawWanPattern(value: number, color: string): JSX.Element {
  return (
    <g>
      {/* 数字部分 */}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fill={color}
        fontSize="18"
        fontWeight="bold"
        fontFamily="serif"
      >
        {CHINESE_NUMBERS[value - 1]}
      </text>
      {/* "万"字 */}
      <text
        x="24"
        y="50"
        textAnchor="middle"
        fill={color}
        fontSize="14"
        fontWeight="bold"
        fontFamily="serif"
      >
        万
      </text>
    </g>
  );
}

/**
 * 绘制风牌图案
 */
function drawFengPattern(value: number, color: string): JSX.Element {
  return (
    <text
      x="24"
      y="40"
      textAnchor="middle"
      fill={color}
      fontSize="24"
      fontWeight="bold"
      fontFamily="serif"
    >
      {WIND_NAMES[value - 1]}
    </text>
  );
}

/**
 * 绘制箭牌图案
 */
function drawJianPattern(value: number): JSX.Element {
  const color = COLORS.jian[value as 1 | 2 | 3];
  
  if (value === 3) {
    // 白板：只有边框
    return (
      <rect
        x="14"
        y="24"
        width="20"
        height="20"
        fill="#ffffff"
        stroke={color}
        strokeWidth="2"
        rx="2"
      />
    );
  }
  
  return (
    <text
      x="24"
      y="42"
      textAnchor="middle"
      fill={color}
      fontSize="26"
      fontWeight="bold"
      fontFamily="serif"
    >
      {ARROW_NAMES[value - 1]}
    </text>
  );
}

/**
 * 彩色麻将牌 SVG 组件
 */
export const MahjongTileSVG: React.FC<MahjongTileSVGProps> = ({
  suit,
  value,
  selected = false,
  className = '',
  size = 48,
}) => {
  // 确保尺寸有效
  const actualSize = size > 0 ? size : 36;
  const height = Math.round(actualSize * 1.35);
  
  const strokeColor = selected ? '#ffd700' : '#2c5530';
  const strokeWidth = selected ? 2 : 1;
  
  // 生成唯一 ID
  const uniqueId = `tile-${suit}-${value}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 根据花色选择绘制方式
  const renderPattern = () => {
    switch (suit) {
      case 'wan':
        return drawWanPattern(value, COLORS.wan);
      case 'tiao':
        return drawTiaoPattern(value, COLORS.tiao);
      case 'tong':
        return drawTongPattern(value, COLORS.tong);
      case 'feng':
        return drawFengPattern(value, COLORS.feng);
      case 'jian':
        return drawJianPattern(value);
      default:
        return null;
    }
  };

  return (
    <svg
      width={actualSize}
      height={height}
      viewBox="0 0 48 65"
      preserveAspectRatio="xMidYMid meet"
      className={`mahjong-tile-svg ${className}`}
      style={{
        filter: selected ? 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))' : 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))',
      }}
    >
      {/* 渐变定义 */}
      <defs>
        <linearGradient id={`${uniqueId}-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#faf8f0" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#e8e0c8" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      
      {/* 牌面背景 */}
      <rect
        x="2"
        y="2"
        width="44"
        height="61"
        rx="4"
        fill="#fffef5"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      
      {/* 内部效果 */}
      <rect
        x="4"
        y="4"
        width="40"
        height="57"
        rx="3"
        fill={`url(#${uniqueId}-gradient)`}
      />
      
      {/* 牌面图案 */}
      {renderPattern()}
    </svg>
  );
};

export default MahjongTileSVG;
