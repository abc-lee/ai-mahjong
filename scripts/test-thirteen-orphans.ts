// 测试十三幺胡牌检测
import { HandAnalyzer } from '../src/server/game/HandAnalyzer';
import { Tile } from '../src/shared/types/tile';
import { Meld } from '../src/shared/types/meld';

const analyzer = new HandAnalyzer();

// 十三幺测试手牌：13种牌各一张 + 其中一张成对
const thirteenOrphansHand: Tile[] = [
  { id: 'wan-1', suit: 'wan', value: 1, display: '一万' },
  { id: 'wan-9', suit: 'wan', value: 9, display: '九万' },
  { id: 'tiao-1', suit: 'tiao', value: 1, display: '一条' },
  { id: 'tiao-9', suit: 'tiao', value: 9, display: '九条' },
  { id: 'tong-1', suit: 'tong', value: 1, display: '一筒' },
  { id: 'tong-9', suit: 'tong', value: 9, display: '九筒' },
  { id: 'feng-1', suit: 'feng', value: 1, display: '东风' },
  { id: 'feng-2', suit: 'feng', value: 2, display: '南风' },
  { id: 'feng-3', suit: 'feng', value: 3, display: '西风' },
  { id: 'feng-4', suit: 'feng', value: 4, display: '北风' },
  { id: 'jian-1', suit: 'jian', value: 1, display: '红中' },
  { id: 'jian-2', suit: 'jian', value: 2, display: '发财' },
  { id: 'jian-3', suit: 'jian', value: 3, display: '白板' },
  { id: 'wan-1-2', suit: 'wan', value: 1, display: '一万' },  // 第二张一万作为将牌
];

// 非十三幺测试手牌（缺少一种）
const notThirteenOrphansHand: Tile[] = [
  { id: 'wan-1', suit: 'wan', value: 1, display: '一万' },
  { id: 'wan-9', suit: 'wan', value: 9, display: '九万' },
  { id: 'tiao-1', suit: 'tiao', value: 1, display: '一条' },
  { id: 'tiao-9', suit: 'tiao', value: 9, display: '九条' },
  { id: 'tong-1', suit: 'tong', value: 1, display: '一筒' },
  { id: 'tong-9', suit: 'tong', value: 9, display: '九筒' },
  { id: 'feng-1', suit: 'feng', value: 1, display: '东风' },
  { id: 'feng-2', suit: 'feng', value: 2, display: '南风' },
  { id: 'feng-3', suit: 'feng', value: 3, display: '西风' },
  { id: 'feng-4', suit: 'feng', value: 4, display: '北风' },
  { id: 'jian-1', suit: 'jian', value: 1, display: '红中' },
  { id: 'jian-2', suit: 'jian', value: 2, display: '发财' },
  // 缺少白板
  { id: 'wan-2', suit: 'wan', value: 2, display: '二万' },
  { id: 'wan-3', suit: 'wan', value: 3, display: '三万' },
];

console.log('=== 十三幺测试 ===\n');

console.log('测试1: 标准十三幺手牌');
console.log('手牌:', thirteenOrphansHand.map(t => t.display).join(' '));
console.log('手牌数:', thirteenOrphansHand.length);
const result1 = analyzer.canWin(thirteenOrphansHand, []);
console.log('canWin 结果:', result1);
console.log(result1 ? '✅ 通过' : '❌ 失败');

console.log('\n测试2: 非十三幺手牌（缺少白板）');
console.log('手牌:', notThirteenOrphansHand.map(t => t.display).join(' '));
console.log('手牌数:', notThirteenOrphansHand.length);
const result2 = analyzer.canWin(notThirteenOrphansHand, []);
console.log('canWin 结果:', result2);
console.log(!result2 ? '✅ 通过（正确识别为不能胡）' : '❌ 失败（应该不能胡）');

// 测试带副露的情况
console.log('\n测试3: 带副露的十三幺（应该不能胡）');
const melds = [{ type: 'peng', tiles: [{ id: 'feng-1', suit: 'feng', value: 1, display: '东风' }] }] as any;
const result3 = analyzer.canWin(thirteenOrphansHand, melds);
console.log('canWin 结果:', result3);
console.log(!result3 ? '✅ 通过（正确拒绝带副露的十三幺）' : '❌ 失败');
