/**
 * 麻将规则引擎
 * 提供基于规则的 AI 决策
 */

import type { Tile, Meld } from '@shared/types';

/**
 * 牌的价值（用于决策）
 */
function getTileValue(tile: Tile): number {
  // 字牌（风、箭）价值较低
  if (tile.suit === 'feng' || tile.suit === 'jian') {
    return 0;
  }
  // 幺九牌价值较低
  if (tile.value === 1 || tile.value === 9) {
    return 1;
  }
  // 中张价值较高
  return 2;
}

/**
 * 判断是否是孤张（周围没有相邻牌）
 */
function isIsolated(tile: Tile, hand: Tile[]): boolean {
  if (tile.suit === 'feng' || tile.suit === 'jian') {
    // 字牌：检查是否有相同的牌
    return hand.filter(t => t.suit === tile.suit && t.value === tile.value).length === 1;
  }
  
  // 数牌：检查是否有相邻的牌
  const sameSuit = hand.filter(t => t.suit === tile.suit);
  const hasNeighbor = sameSuit.some(t => 
    Math.abs(t.value - tile.value) <= 2 && t.id !== tile.id
  );
  
  return !hasNeighbor;
}

/**
 * 找出最佳的出牌
 */
export function findBestDiscard(hand: Tile[], melds: Meld[]): Tile | null {
  if (hand.length === 0) return null;
  
  // 策略：优先打孤张，其次打价值低的牌
  const candidates = [...hand];
  
  // 按策略排序
  candidates.sort((a, b) => {
    // 优先打孤张
    const aIsolated = isIsolated(a, hand);
    const bIsolated = isIsolated(b, hand);
    if (aIsolated !== bIsolated) {
      return aIsolated ? -1 : 1;
    }
    
    // 其次打价值低的牌
    return getTileValue(a) - getTileValue(b);
  });
  
  return candidates[0];
}

/**
 * 决定是否碰牌
 */
export function shouldPeng(tile: Tile, hand: Tile[]): boolean {
  // 简单规则：总是碰
  return true;
}

/**
 * 决定是否吃牌
 */
export function shouldChi(tile: Tile, hand: Tile[]): boolean {
  // 简单规则：根据手牌情况决定
  // 如果手牌较少（快胡了），不吃
  if (hand.length <= 10) {
    return false;
  }
  return true;
}

/**
 * 决定是否杠牌
 */
export function shouldGang(tile: Tile, hand: Tile[]): boolean {
  // 简单规则：总是杠
  return true;
}
