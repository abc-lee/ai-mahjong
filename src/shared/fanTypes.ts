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

import { HandAnalyzer } from '../server/game/HandAnalyzer';

function checkPinghu(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 平胡：四组顺子 + 一对将，不能有刻子或杠子（副露中不能有碰/杠）
  // 如果有副露，检查副露是否都是顺子（吃）
  if (melds.length > 0) {
    const allChi = melds.every(m => m.type === 'chi');
    if (!allChi) {
      console.log(`[checkPinghu] 副露不全是吃，返回 false`);
      return false;
    }
  }

  // 尝试解析手牌，看是否能组成四组面子+一对将，且面子都是顺子
  const analyzer = new HandAnalyzer();
  const mentsus = analyzer.parseHand(hand, melds);
  if (!mentsus) {
    console.log(`[checkPinghu] parseHand 返回 null`);
    return false;
  }

  // 检查所有面子都是顺子（除了将牌）
  const nonJiangMentsus = mentsus.filter(m => m.type !== 'jiang');
  const result = nonJiangMentsus.every(m => m.type === 'shunzi');
  console.log(`[checkPinghu] 面子类型: ${nonJiangMentsus.map(m => m.type).join(', ')}, 结果: ${result}`);
  return result;
}

function checkDuidui(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 对对胡：四组刻子/杠子 + 一对将
  // 检查副露是否都是刻子或杠子
  if (melds.length > 0) {
    const allPengGang = melds.every(m => m.type === 'peng' || m.type === 'gang');
    if (!allPengGang) return false;
  }

  // 尝试解析手牌，看是否能组成四组面子+一对将，且面子都是刻子
  const analyzer = new HandAnalyzer();
  const mentsus = analyzer.parseHand(hand, melds);
  if (!mentsus) return false;

  // 检查所有面子都是刻子（除了将牌）
  const nonJiangMentsus = mentsus.filter(m => m.type !== 'jiang');
  return nonJiangMentsus.every(m => m.type === 'kezi');
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
  
  // 检查是否都是对子：四张算两个对子，两张算一个对子
  let totalPairs = 0;
  for (const count of counts.values()) {
    if (count === 2) {
      totalPairs += 1;
    } else if (count === 4) {
      totalPairs += 2;
    } else {
      // 1张或3张都不行
      return false;
    }
  }
  
  // 必须正好是7个对子
  return totalPairs === 7;
}

function checkMenqianqing(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  // 没有吃碰杠，且自摸
  return melds.length === 0 && isSelfDraw;
}

function checkZimo(hand: Tile[], melds: Meld[], isSelfDraw: boolean): boolean {
  return isSelfDraw;
}
