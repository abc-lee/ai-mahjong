/**
 * 番型定义
 */

import { Tile } from './types/tile';
import { Meld } from './types/meld';

// 番型定义
export interface FanDefinition {
  id: string;
  name: string;
  fan: number;
  description: string;
  checker: (hand: Tile[], melds: Meld[], isSelfDraw: boolean) => boolean;
  enabled: boolean;
}

// 基础番型列表
export const FAN_DEFINITIONS: FanDefinition[] = [
  {
    id: 'pinghu',
    name: '平胡',
    fan: 1,
    description: '四组顺子加一对将牌',
    checker: checkPinghu,
    enabled: true,
  },
  {
    id: 'duidui',
    name: '对对胡',
    fan: 2,
    description: '四组刻子/杠子加一对将牌',
    checker: checkDuidui,
    enabled: true,
  },
  {
    id: 'qys',
    name: '清一色',
    fan: 6,
    description: '全部是同一花色的牌',
    checker: checkQingyise,
    enabled: true,
  },
  {
    id: 'qdx',
    name: '七对子',
    fan: 2,
    description: '七个对子',
    checker: checkQiduizi,
    enabled: true,
  },
  {
    id: 'mq',
    name: '门前清',
    fan: 1,
    description: '没有吃碰杠，自摸胡牌',
    checker: checkMenqianqing,
    enabled: true,
  },
  {
    id: 'zimo',
    name: '自摸',
    fan: 1,
    description: '自己摸到的牌胡牌',
    checker: checkZimo,
    enabled: true,
  },
];

// === 番型检查函数 ===

function checkPinghu(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 简化版：检查是否有 4 组顺子 + 1 对将
  // TODO: 实现完整的平胡检测
  return false;
}

function checkDuidui(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 检查是否所有副露都是刻子或杠子
  if (melds.length > 0) {
    const allPengGang = melds.every(m => m.type === 'peng' || m.type === 'gang');
    if (!allPengGang) return false;
  }
  // TODO: 检查手牌部分
  return false;
}

function checkQingyise(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 检查是否所有牌都是同一花色
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  if (allTiles.length === 0) return false;
  
  const suits = new Set(allTiles.map(t => t.suit));
  return suits.size === 1;
}

function checkQiduizi(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 七对子不能有副露
  if (melds.length > 0) return false;
  
  // 检查是否有 7 个对子
  if (hand.length !== 14) return false;
  
  // 统计每张牌的数量
  const counts = new Map<string, number>();
  for (const tile of hand) {
    const key = `${tile.suit}-${tile.value}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  
  // 检查是否都是对子
  let pairs = 0;
  for (const count of counts.values()) {
    if (count === 2) pairs++;
    else if (count !== 4) return false; // 四张也可以
  }
  
  return pairs === 7 || (pairs === 5 && hand.length === 14); // 简化判断
}

function checkMenqianqing(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 没有吃碰杠，且自摸
  return melds.length === 0 && isSelfDraw;
}

function checkZimo(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  return isSelfDraw;
}
