/**
 * 副露类型定义
 */

import { Tile } from './tile';

// 副露类型
export type MeldType = 'chi' | 'peng' | 'gang';

// 副露
export interface Meld {
  type: MeldType;
  tiles: Tile[];
  fromPlayer: number;     // 从谁那吃碰杠的
  isConcealed: boolean;   // 是否暗杠
}

// 检查是否是顺子（吃）
export function isChi(meld: Meld): boolean {
  return meld.type === 'chi';
}

// 检查是否是刻子（碰）
export function isPeng(meld: Meld): boolean {
  return meld.type === 'peng';
}

// 检查是否是杠
export function isGang(meld: Meld): boolean {
  return meld.type === 'gang';
}

// 获取副露的牌数
export function getMeldTileCount(meld: Meld): number {
  if (meld.type === 'gang') {
    return 4;
  }
  return 3;
}
