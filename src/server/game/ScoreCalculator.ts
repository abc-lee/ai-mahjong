import { Player } from '../../shared/types/player';
import { FanDefinition } from '../../shared/fanTypes';

/**
 * 计分结果
 */
export interface ScoreResult {
  winnerScore: number;        // 赢家得分
  loserScore: number;         // 点炮者失分（点炮时）
  otherScores: number[];      // 其他玩家失分（自摸时）
}

/**
 * 详细计分结果
 */
export interface DetailedScoreResult extends ScoreResult {
  baseScore: number;          // 底分
  han: number;                // 总番数
  fans: FanDefinition[];      // 番型列表
  isSelfDraw: boolean;        // 是否自摸
}

/**
 * 计分配置
 */
export interface ScoreConfig {
  baseScore: number;          // 底分，默认 1000
  maxHan: number;             // 封顶番数，默认 13（累计封顶）
}

const DEFAULT_CONFIG: ScoreConfig = {
  baseScore: 100,  // 底分改为100，1番=200分
  maxHan: 13,
};

/**
 * 计分类
 * 负责计算番数和分数
 */
export class ScoreCalculator {
  private config: ScoreConfig;

  constructor(config: Partial<ScoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 计算总番数
   * @param fans 番型列表
   * @returns 总番数
   */
  calculateHan(fans: FanDefinition[]): number {
    if (!fans || fans.length === 0) return 0;

    // 累加所有番型的番数
    let totalHan = fans.reduce((sum, fan) => sum + fan.fan, 0);

    // 封顶
    if (this.config.maxHan > 0) {
      totalHan = Math.min(totalHan, this.config.maxHan);
    }

    return totalHan;
  }

  /**
   * 计算分数
   * 公式：底分 × 2^番数
   * @param han 番数
   * @param baseScore 底分（可选，默认使用配置）
   * @returns 分数
   */
  calculateScore(han: number, baseScore?: number): number {
    const base = baseScore ?? this.config.baseScore;

    if (han <= 0) return 0;

    // 底分 × 2^番数
    // 使用位运算优化：2^n = 1 << n（当 n 为正整数时）
    const multiplier = Math.pow(2, han);
    return base * multiplier;
  }

  /**
   * 计算最终得分
   * @param winner 赢家
   * @param loser 点炮者（自摸时为 null）
   * @param han 总番数
   * @param isSelfDraw 是否自摸
   * @returns 计分结果
   */
  calculateFinalScore(
    winner: Player,
    loser: Player | null,
    han: number,
    isSelfDraw: boolean
  ): ScoreResult {
    const score = this.calculateScore(han);

    if (isSelfDraw) {
      // 自摸：其他三家各付
      // 每家付的分数
      const eachPay = score;

      return {
        winnerScore: eachPay * 3,  // 赢家收三家的分
        loserScore: 0,              // 没有点炮者
        otherScores: [eachPay, eachPay, eachPay],  // 三家各付
      };
    } else {
      // 点炮：点炮者一人付
      return {
        winnerScore: score,         // 赢家得分
        loserScore: -score,         // 点炮者失分
        otherScores: [0, 0, 0],     // 其他玩家不失分
      };
    }
  }

  /**
   * 计算详细得分
   */
  calculateDetailedScore(
    winner: Player,
    loser: Player | null,
    fans: FanDefinition[],
    isSelfDraw: boolean
  ): DetailedScoreResult {
    const han = this.calculateHan(fans);
    const scoreResult = this.calculateFinalScore(winner, loser, han, isSelfDraw);

    return {
      ...scoreResult,
      baseScore: this.config.baseScore,
      han,
      fans,
      isSelfDraw,
    };
  }

  /**
   * 应用分数变更到玩家
   */
  applyScoreChange(
    players: Player[],
    winnerIndex: number,
    loserIndex: number | null,
    result: ScoreResult
  ): void {
    // 赢家得分
    players[winnerIndex].score += result.winnerScore;

    if (loserIndex !== null) {
      // 点炮
      players[loserIndex].score += result.loserScore;
    } else {
      // 自摸：其他三家各付
      let otherIndex = 0;
      for (let i = 0; i < players.length; i++) {
        if (i !== winnerIndex) {
          players[i].score -= result.otherScores[otherIndex];
          otherIndex++;
        }
      }
    }
  }

  /**
   * 获取番型名称列表
   */
  getFanNames(fans: FanDefinition[]): string[] {
    return fans.map(f => f.name);
  }

  /**
   * 获取番型描述
   */
  getFanDescription(fans: FanDefinition[]): string {
    if (fans.length === 0) return '无番型';

    return fans
      .map(f => `${f.name}(${f.fan}番)`)
      .join(' ');
  }

  /**
   * 计算倍率
   */
  getMultiplier(han: number): number {
    return Math.pow(2, han);
  }

  /**
   * 格式化分数显示
   */
  formatScore(score: number): string {
    if (score > 0) return `+${score}`;
    return `${score}`;
  }
}
