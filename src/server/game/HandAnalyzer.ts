import { Tile, isSameTile, isNumberTile } from '../../shared/types/tile';
import { Meld, MeldType } from '../../shared/types/meld';
import { FanDefinition, FAN_DEFINITIONS } from '../../shared/fanTypes';

/**
 * 牌计数映射
 */
type TileCountMap = Map<string, { tile: Tile; count: number }>;

/**
 * 杠牌结果
 */
export interface GangResult {
  canMingGang: boolean;  // 明杠：别人打出的牌，手上有3张
  canAnGang: boolean;    // 暗杠：手上有4张
  canJiaGang: boolean;   // 加杠：已碰的牌又摸到第4张
}

/**
 * 面子类型
 */
type MentsuType = 'shunzi' | 'kezi' | 'jiang';

/**
 * 面子结构
 */
interface Mentsu {
  type: MentsuType;
  tiles: Tile[];
}

/**
 * 手牌分析类
 * 负责判断胡牌、吃碰杠、番型计算
 */
export class HandAnalyzer {
  /**
   * 判断是否可以胡牌
   * @param hand 手牌
   * @param melds 副露
   * @returns 是否可以胡牌
   */
  canWin(hand: Tile[], melds: Meld[]): boolean {
    // 检查基本胡牌牌型（4组面子 + 1对将）
    if (this.canBasicWin(hand, melds)) return true;
    
    // 检查七对子（无副露时）
    if (melds.length === 0 && this.canSevenPairs(hand)) return true;
    
    // 检查十三幺（无副露时）
    if (melds.length === 0 && this.canThirteenOrphans(hand, melds)) return true;
    
    return false;
  }

  /**
   * 检查基础胡牌（4组面子 + 1对将）
   */
  private canBasicWin(hand: Tile[], melds: Meld[]): boolean {
    // 计算副露占用的面子数
    const meldCount = melds.length;
    const requiredMentsu = 4 - meldCount;
    
    // 手牌数量检查：需要 14 - 3*meldCount 张
    const expectedHandSize = 14 - 3 * meldCount;
    if (hand.length !== expectedHandSize) {
      console.log(`[canBasicWin] 手牌数量不匹配: hand.length=${hand.length}, expected=${expectedHandSize}`);
      return false;
    }
    
    // 转换为牌计数
    const counts = this.toTileCountMap(hand);
    
    // 打印牌型用于调试
    const handStr = hand.map(t => t.display).join(', ');
    console.log(`[canBasicWin] 检查牌型: ${handStr}, melds=${meldCount}, requiredMentsu=${requiredMentsu}`);
    
    // 尝试找出所有可能的将牌
    for (const [key, item] of counts) {
      if (item.count >= 2) {
        // 尝试用这张牌做将
        item.count -= 2;
        console.log(`[canBasicWin] 尝试将牌: ${item.tile.display}, 剩余需要组成 ${requiredMentsu} 组面子`);
        
        // 递归检查剩余牌能否组成 requiredMentsu 组面子
        if (this.canFormMentsu(counts, requiredMentsu)) {
          console.log(`[canBasicWin] ✓ 找到有效牌型！`);
          return true;
        }
        
        // 回溯
        item.count += 2;
      }
    }
    
    console.log(`[canBasicWin] ✗ 未找到有效牌型`);
    return false;
  }

  /**
   * 检查是否可以组成指定数量的面子
   */
  private canFormMentsu(counts: TileCountMap, required: number): boolean {
    if (required === 0) {
      // 检查是否所有牌都已用完
      for (const item of counts.values()) {
        if (item.count > 0) return false;
      }
      return true;
    }
    
    // 找出第一张还有剩余的牌
    let firstKey: string | null = null;
    for (const [key, item] of counts) {
      if (item.count > 0) {
        firstKey = key;
        break;
      }
    }
    
    if (!firstKey) return false;
    
    const tile = counts.get(firstKey)!.tile;
    
    // 尝试组成刻子
    if (counts.get(firstKey)!.count >= 3) {
      counts.get(firstKey)!.count -= 3;
      if (this.canFormMentsu(counts, required - 1)) {
        counts.get(firstKey)!.count += 3;
        return true;
      }
      counts.get(firstKey)!.count += 3;
    }
    
    // 尝试组成顺子（只有数牌可以）
    // 修改：从这张牌可能参与的顺子进行检查，而不只是以它开头的顺子
    if (isNumberTile(tile)) {
      // 尝试三种顺子组合：以这张牌为第一张、第二张或第三张
      for (let offset = 0; offset <= 2; offset++) {
        const startValue = tile.value - offset;
        if (startValue < 1 || startValue > 7) continue;
        
        const key1 = `${tile.suit}-${startValue}`;
        const key2 = `${tile.suit}-${startValue + 1}`;
        const key3 = `${tile.suit}-${startValue + 2}`;
        
        const item1 = counts.get(key1);
        const item2 = counts.get(key2);
        const item3 = counts.get(key3);
        
        if (item1 && item2 && item3 && 
            item1.count >= 1 && item2.count >= 1 && item3.count >= 1) {
          item1.count -= 1;
          item2.count -= 1;
          item3.count -= 1;
          
          if (this.canFormMentsu(counts, required - 1)) {
            item1.count += 1;
            item2.count += 1;
            item3.count += 1;
            return true;
          }
          
          item1.count += 1;
          item2.count += 1;
          item3.count += 1;
        }
      }
    }
    
    return false;
  }

  /**
   * 检查七对子
   */
  private canSevenPairs(hand: Tile[]): boolean {
    if (hand.length !== 14) return false;
    
    const counts = this.toTileCountMap(hand);
    
    let pairs = 0;
    for (const item of counts.values()) {
      if (item.count === 2) {
        pairs++;
      } else if (item.count === 4) {
        pairs += 2;  // 四张算两个对子
      } else {
        return false;  // 其他数量不行
      }
    }
    
    return pairs === 7;
  }

  /**
   * 检查十三幺（国士无双）
   * 需要一万、九万、一条、九条、一筒、九筒、东风、南风、西风、北风、红中、发财、白板
   * 再加其中任意一张作为将牌
   */
  private canThirteenOrphans(hand: Tile[], melds: Meld[]): boolean {
    // 有副露不能十三幺
    if (melds.length > 0) return false;
    
    // 必须是14张牌
    if (hand.length !== 14) return false;
    
    // 十三幺所需的13种牌
    const thirteenOrphansTiles = [
      { suit: 'wan', value: 1 },   // 一万
      { suit: 'wan', value: 9 },   // 九万
      { suit: 'tiao', value: 1 },  // 一条
      { suit: 'tiao', value: 9 },  // 九条
      { suit: 'tong', value: 1 },  // 一筒
      { suit: 'tong', value: 9 },  // 九筒
      { suit: 'feng', value: 1 },  // 东风
      { suit: 'feng', value: 2 },  // 南风
      { suit: 'feng', value: 3 },  // 西风
      { suit: 'feng', value: 4 },  // 北风
      { suit: 'jian', value: 1 },  // 红中
      { suit: 'jian', value: 2 },  // 发财
      { suit: 'jian', value: 3 },  // 白板
    ];
    
    const counts = this.toTileCountMap(hand);
    
    // 检查是否所有13种牌都至少有一张
    let hasAllThirteen = true;
    for (const required of thirteenOrphansTiles) {
      const key = `${required.suit}-${required.value}`;
      const item = counts.get(key);
      if (!item || item.count < 1) {
        hasAllThirteen = false;
        break;
      }
    }
    
    if (!hasAllThirteen) return false;
    
    // 检查是否有某张牌是成对的（作为将牌）
    for (const required of thirteenOrphansTiles) {
      const key = `${required.suit}-${required.value}`;
      const item = counts.get(key);
      if (item && item.count === 2) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 判断是否可以吃牌
   * @param hand 手牌
   * @param tile 要吃的牌
   * @returns 可能的吃牌组合，每种组合是3张牌的数组
   */
  canChi(hand: Tile[], tile: Tile): Tile[][] {
    // 只有数牌可以吃
    if (!isNumberTile(tile)) return [];
    
    const results: Tile[][] = [];
    const counts = this.toTileCountMap(hand);
    
    const suit = tile.suit;
    const value = tile.value;
    
    // 情况1：吃中间（如一二三，吃二）
    if (value >= 2 && value <= 8) {
      const prev = counts.get(`${suit}-${value - 1}`);
      const next = counts.get(`${suit}-${value + 1}`);
      if (prev && prev.count >= 1 && next && next.count >= 1) {
        results.push([
          { ...prev.tile },
          { ...tile },
          { ...next.tile },
        ]);
      }
    }
    
    // 情况2：吃右边（如一二三，吃一）
    if (value <= 7) {
      const next1 = counts.get(`${suit}-${value + 1}`);
      const next2 = counts.get(`${suit}-${value + 2}`);
      if (next1 && next1.count >= 1 && next2 && next2.count >= 1) {
        results.push([
          { ...tile },
          { ...next1.tile },
          { ...next2.tile },
        ]);
      }
    }
    
    // 情况3：吃左边（如七八九，吃九）
    if (value >= 3) {
      const prev1 = counts.get(`${suit}-${value - 1}`);
      const prev2 = counts.get(`${suit}-${value - 2}`);
      if (prev1 && prev1.count >= 1 && prev2 && prev2.count >= 1) {
        results.push([
          { ...prev2.tile },
          { ...prev1.tile },
          { ...tile },
        ]);
      }
    }
    
    return results;
  }

  /**
   * 判断是否可以碰牌
   * @param hand 手牌
   * @param tile 要碰的牌
   * @returns 是否可以碰
   */
  canPeng(hand: Tile[], tile: Tile): boolean {
    const counts = this.toTileCountMap(hand);
    const key = `${tile.suit}-${tile.value}`;
    const item = counts.get(key);
    return item !== undefined && item.count >= 2;
  }

  /**
   * 判断是否可以杠牌
   * @param hand 手牌
   * @param tile 要杠的牌（别人打出的或自己摸的）
   * @param melds 已有的副露
   * @param isSelfDraw 是否自摸（摸到这张牌）
   * @returns 杠牌结果
   */
  canGang(hand: Tile[], tile: Tile, melds: Meld[], isSelfDraw: boolean): GangResult {
    const result: GangResult = {
      canMingGang: false,
      canAnGang: false,
      canJiaGang: false,
    };
    
    const counts = this.toTileCountMap(hand);
    const key = `${tile.suit}-${tile.value}`;
    const item = counts.get(key);
    
    if (isSelfDraw) {
      // 自摸情况
      if (item && item.count >= 3) {
        // 已经有3张，加上摸的这张有4张，可以暗杠
        result.canAnGang = true;
      }
      
      // 检查加杠：已碰的牌又摸到第4张
      const pengMeld = melds.find(m => 
        m.type === 'peng' && 
        m.tiles.length > 0 && 
        isSameTile(m.tiles[0], tile)
      );
      if (pengMeld) {
        result.canJiaGang = true;
      }
    } else {
      // 别人打出情况
      if (item && item.count >= 3) {
        // 手上有3张，可以明杠
        result.canMingGang = true;
      }
    }
    
    return result;
  }

  /**
   * 获取可以暗杠的牌（扫描整个手牌）
   * @param hand 手牌
   * @returns 可以暗杠的牌列表
   */
  getAnGangTiles(hand: Tile[]): Tile[] {
    const results: Tile[] = [];
    const counts = this.toTileCountMap(hand);
    
    for (const item of counts.values()) {
      if (item.count >= 4) {
        results.push(item.tile);
      }
    }
    
    return results;
  }

  /**
   * 计算番型
   * @param hand 手牌（已经包含胡的那张牌）
   * @param melds 副露
   * @param isSelfDraw 是否自摸
   * @param winningTile 胡的那张牌（未使用，保留参数兼容）
   * @returns 番型列表
   */
  calculateFans(hand: Tile[], melds: Meld[], isSelfDraw: boolean, winningTile: Tile): FanDefinition[] {
    const fans: FanDefinition[] = [];
    
    // GameEngine 已经将 winningTile 添加到手牌中
    // 直接使用 hand 进行检测即可
    const fullHand = hand;
    
    for (const fanDef of FAN_DEFINITIONS) {
      if (fanDef.enabled && fanDef.checker(fullHand, melds, isSelfDraw)) {
        fans.push(fanDef);
      }
    }
    
    // 如果没有检测到任何番型，给一个基础胡牌番
    if (fans.length === 0) {
      console.log(`[calculateFans] 未检测到番型，使用基础胡牌`);
      fans.push({
        id: 'base',
        name: '胡牌',
        fan: 1,
        description: '基础胡牌',
        checker: () => true,
        enabled: true,
      });
    }
    
    return fans;
  }

  /**
   * 计算总番数
   */
  calculateTotalFan(hand: Tile[], melds: Meld[], isSelfDraw: boolean, winningTile: Tile): number {
    const fans = this.calculateFans(hand, melds, isSelfDraw, winningTile);
    return fans.reduce((sum, fan) => sum + fan.fan, 0);
  }

  /**
   * 将手牌转换为计数映射
   */
  private toTileCountMap(tiles: Tile[]): TileCountMap {
    const map: TileCountMap = new Map();
    
    for (const tile of tiles) {
      const key = `${tile.suit}-${
tile.value}`;
      const existing = map.get(key);
      
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { tile, count: 1 });
      }
    }
    
    return map;
  }

  /**
   * 解析手牌为面子结构（用于番型检测）
   */
  parseHand(hand: Tile[], melds: Meld[]): Mentsu[] | null {
    const mentsus: Mentsu[] = [];
    
    // 先添加副露
    for (const meld of melds) {
      if (meld.type === 'chi') {
        mentsus.push({ type: 'shunzi', tiles: meld.tiles });
      } else if (meld.type === 'peng') {
        mentsus.push({ type: 'kezi', tiles: meld.tiles });
      } else if (meld.type === 'gang') {
        mentsus.push({ type: 'kezi', tiles: meld.tiles });
      }
    }
    
    // 检查手牌数量
    const expectedHandSize = 14 - 3 * melds.length;
    if (hand.length !== expectedHandSize) return null;
    
    // 解析手牌
    const counts = this.toTileCountMap(hand);
    const requiredMentsu = 4 - melds.length;
    
    // 尝试解析
    for (const [key, item] of counts) {
      if (item.count >= 2) {
        item.count -= 2;
        const handMentsus = this.tryParseMentsu(counts, requiredMentsu);
        if (handMentsus) {
          // 找到将牌
          const jiangTile = { ...item.tile };
          mentsus.push({ type: 'jiang', tiles: [jiangTile, jiangTile] });
          mentsus.push(...handMentsus);
          return mentsus;
        }
        item.count += 2;
      }
    }
    
    return null;
  }

  /**
   * 尝试解析面子
   */
  private tryParseMentsu(counts: TileCountMap, required: number): Mentsu[] | null {
    if (required === 0) {
      for (const item of counts.values()) {
        if (item.count > 0) return null;
      }
      return [];
    }
    
    // 找第一张剩余的牌
    let firstKey: string | null = null;
    for (const [key, item] of counts) {
      if (item.count > 0) {
        firstKey = key;
        break;
      }
    }
    
    if (!firstKey) return null;
    
    const tile = counts.get(firstKey)!.tile;
    
    // 尝试刻子
    if (counts.get(firstKey)!.count >= 3) {
      counts.get(firstKey)!.count -= 3;
      const result = this.tryParseMentsu(counts, required - 1);
      counts.get(firstKey)!.count += 3;
      
      if (result) {
        result.unshift({ type: 'kezi', tiles: [tile, tile, tile] });
        return result;
      }
    }
    
    // 尝试顺子
    if (isNumberTile(tile) && tile.value <= 7) {
      const key1 = `${tile.suit}-${tile.value}`;
      const key2 = `${tile.suit}-${tile.value + 1}`;
      const key3 = `${tile.suit}-${tile.value + 2}`;
      
      const item1 = counts.get(key1);
      const item2 = counts.get(key2);
      const item3 = counts.get(key3);
      
      if (item1 && item2 && item3 && 
          item1.count >= 1 && item2.count >= 1 && item3.count >= 1) {
        item1.count -= 1;
        item2.count -= 1;
        item3.count -= 1;
        
        const result = this.tryParseMentsu(counts, required - 1);
        
        item1.count += 1;
        item2.count += 1;
        item3.count += 1;
        
        if (result) {
          result.unshift({ 
            type: 'shunzi', 
            tiles: [item1.tile, item2.tile, item3.tile] 
          });
          return result;
        }
      }
    }
    
    return null;
  }

  /**
   * 检查是否听牌（单骑、边张、嵌张等）
   * @param hand 手牌（不含摸的牌）
   * @param melds 副露
   * @returns 可以胡的牌列表
   */
  getWaitingTiles(hand: Tile[], melds: Meld[]): Tile[] {
    const waiting: Tile[] = [];
    
    // 生成所有可能的牌
    const allPossibleTiles = this.generateAllPossibleTiles();
    
    for (const tile of allPossibleTiles) {
      // 模拟加入这张牌后能否胡
      const testHand = [...hand, tile];
      if (this.canWin(testHand, melds)) {
        waiting.push(tile);
      }
    }
    
    return waiting;
  }

  /**
   * 生成所有可能的牌（用于检测听牌）
   */
  private generateAllPossibleTiles(): Tile[] {
    const tiles: Tile[] = [];
    const suits: Array<'wan' | 'tiao' | 'tong' | 'feng' | 'jian'> = ['wan', 'tiao', 'tong', 'feng', 'jian'];
    const displays: Record<string, string[]> = {
      wan: ['一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'],
      tiao: ['一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'],
      tong: ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'],
      feng: ['东风', '南风', '西风', '北风'],
      jian: ['红中', '发财', '白板'],
    };
    
    for (const suit of suits) {
      const max = suit === 'feng' ? 4 : (suit === 'jian' ? 3 : 9);
      for (let v = 1; v <= max; v++) {
        tiles.push({
          id: `${suit}-${v}-test`,
          suit,
          value: v,
          display: displays[suit][v - 1],
        });
      }
    }
    
    return tiles;
  }
}
