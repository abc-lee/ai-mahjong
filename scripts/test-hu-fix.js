// 测试自摸胡牌检测
const { HandAnalyzer } = require('../src/server/game/HandAnalyzer');
const { ActionValidator } = require('../src/server/game/ActionValidator');

const analyzer = new HandAnalyzer();
const validator = new ActionValidator();

// 创建一个测试手牌：可以胡牌的情况
// 模拟 3个顺子 + 1个刻子 + 1对将 = 14张牌
const testHand = [
  { id: 'wan-1', suit: 'wan', value: 1, display: '一万' },
  { id: 'wan-2', suit: 'wan', value: 2, display: '二万' },
  { id: 'wan-3', suit: 'wan', value: 3, display: '三万' },
  { id: 'tiao-1', suit: 'tiao', value: 1, display: '一条' },
  { id: 'tiao-2', suit: 'tiao', value: 2, display: '二条' },
  { id: 'tiao-3', suit: 'tiao', value: 3, display: '三条' },
  { id: 'tong-1', suit: 'tong', value: 1, display: '一筒' },
  { id: 'tong-2', suit: 'tong', value: 2, display: '二筒' },
  { id: 'tong-3', suit: 'tong', value: 3, display: '三筒' },
  { id: 'feng-1', suit: 'feng', value: 1, display: '东风' },
  { id: 'feng-1-2', suit: 'feng', value: 1, display: '东风' },
  { id: 'feng-1-3', suit: 'feng', value: 1, display: '东风' },
  { id: 'jian-1', suit: 'jian', value: 1, display: '红中' },
  { id: 'jian-1-2', suit: 'jian', value: 1, display: '红中' },
];

console.log('测试手牌:', testHand.map(t => t.display).join(' '));
console.log('手牌数:', testHand.length);

// 测试 canWin
const canWin = analyzer.canWin(testHand, []);
console.log('canWin 结果:', canWin);

// 模拟自摸场景：手牌有14张（已经摸到胡牌）
const player = {
  id: 'test-player',
  name: '测试玩家',
  hand: testHand,
  melds: [],
};

// 使用 checkSelfDrawActions 逻辑
const meldCount = 0;
const expectedHandSize = 14 - 3 * meldCount;
console.log('\n模拟自摸场景:');
console.log('手牌数:', player.hand.length, '期望手牌数:', expectedHandSize);

const handWithoutLast = player.hand.slice(0, -1);
console.log('移除最后一张后手牌数:', handWithoutLast.length);

const canWinSelfDraw = analyzer.canWin(handWithoutLast, []);
console.log('canWin(移除最后一张) 结果:', canWinSelfDraw);

// 测试 getAvailableActions
const result = {
  canHu: false,
  canGang: false,
  gangTiles: [],
  canPeng: false,
  canChi: false,
  chiCombinations: [],
  actions: [],
};

validator.checkSelfDrawActions(player, result);
console.log('\ngetAvailableActions 结果:');
console.log('canHu:', result.canHu);
console.log('actions:', result.actions);

if (canWinSelfDraw && result.canHu) {
  console.log('\n✅ 自摸胡牌检测修复成功！');
} else {
  console.log('\n❌ 自摸胡牌检测仍有问题');
}
