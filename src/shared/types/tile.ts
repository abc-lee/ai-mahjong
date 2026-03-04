/**
 * 麻将牌定义
 * 136张基础牌：万、条、筒、风牌、箭牌
 */

// 牌的花色
export type Suit = 'wan' | 'tiao' | 'tong' | 'feng' | 'jian';

// 单张牌
export interface Tile {
  id: string;           // 唯一ID，如 "wan-1-0"
  suit: Suit;           // 花色
  value: number;        // 数值
  display: string;      // 显示名称，如 "一万"、"东风"
}

// 牌的定义（用于生成牌组）
export interface TileDefinition {
  suit: Suit;
  value: number;
  display: string;
}

// 136张牌的定义
export const TILE_DEFINITIONS: TileDefinition[] = [
  // 万（1-9）
  ...Array.from({ length: 9 }, (_, i) => ({
    suit: 'wan' as const,
    value: i + 1,
    display: `${['一', '二', '三', '四', '五', '六', '七', '八', '九'][i]}万`,
  })),
  // 条（1-9）
  ...Array.from({ length: 9 }, (_, i) => ({
    suit: 'tiao' as const,
    value: i + 1,
    display: `${['一', '二', '三', '四', '五', '六', '七', '八', '九'][i]}条`,
  })),
  // 筒（1-9）
  ...Array.from({ length: 9 }, (_, i) => ({
    suit: 'tong' as const,
    value: i + 1,
    display: `${['一', '二', '三', '四', '五', '六', '七', '八', '九'][i]}筒`,
  })),
  // 风牌（东南西北）
  { suit: 'feng', value: 1, display: '东风' },
  { suit: 'feng', value: 2, display: '南风' },
  { suit: 'feng', value: 3, display: '西风' },
  { suit: 'feng', value: 4, display: '北风' },
  // 箭牌（中发白）
  { suit: 'jian', value: 1, display: '红中' },
  { suit: 'jian', value: 2, display: '发财' },
  { suit: 'jian', value: 3, display: '白板' },
];

// 检查两张牌是否相同（花色和数值）
export function isSameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

// 检查是否是数牌（万、条、筒）
export function isNumberTile(tile: Tile): boolean {
  return tile.suit === 'wan' || tile.suit === 'tiao' || tile.suit === 'tong';
}

// 检查是否是风牌
export function isWindTile(tile: Tile): boolean {
  return tile.suit === 'feng';
}

// 检查是否是箭牌
export function isDragonTile(tile: Tile): boolean {
  return tile.suit === 'jian';
}

// 获取牌的数字（用于顺子检测）
export function getTileNumber(tile: Tile): number | null {
  if (isNumberTile(tile)) {
    return tile.value;
  }
  return null;
}
