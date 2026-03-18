/**
 * AI 好友系统
 * 让人类玩家可以添加 AI 为好友，建立长期关系
 */

// 好友关系等级
export type FriendLevel = 
  | 'stranger'      // 陌生人
  | 'acquaintance'  // 熟人
  | 'friend'        // 朋友
  | 'close_friend'  // 好友
  | 'best_friend';  // 挚友

// 好友关系
export interface FriendRelation {
  playerId: string;         // 人类玩家ID
  aiPlayerId: string;       // AI 玩家ID
  aiPlayerName: string;     // AI 名字
  aiPersonality: string;    // AI 性格类型
  level: FriendLevel;       // 关系等级
  intimacy: number;         // 亲密度 0-100
  gamesPlayed: number;      // 一起玩过的局数
  gamesWon: number;         // 一起赢的局数
  lastPlayed?: number;      // 最后一起玩的时间
  notes: string[];          // AI 对玩家的备注
  createdAt: number;        // 添加好友时间
}

// 好友系统配置
const FRIEND_CONFIG = {
  levelThresholds: {
    stranger: 0,
    acquaintance: 10,
    friend: 30,
    close_friend: 60,
    best_friend: 90,
  },
  intimacyGain: {
    play_together: 2,
    win_together: 5,
    good_interaction: 1,
    bad_interaction: -3,
  },
};

/**
 * 好友管理器
 */
export class FriendManager {
  private friends: Map<string, Map<string, FriendRelation>> = new Map();
  // 外层 key: 人类玩家ID, 内层 key: AI玩家ID

  /**
   * 添加好友
   */
  addFriend(playerId: string, aiPlayerId: string, aiPlayerName: string, aiPersonality: string): FriendRelation {
    // 初始化玩家的好友列表
    if (!this.friends.has(playerId)) {
      this.friends.set(playerId, new Map());
    }

    const playerFriends = this.friends.get(playerId)!;
    
    // 检查是否已经是好友
    if (playerFriends.has(aiPlayerId)) {
      return playerFriends.get(aiPlayerId)!;
    }

    // 创建新好友关系
    const relation: FriendRelation = {
      playerId,
      aiPlayerId,
      aiPlayerName,
      aiPersonality,
      level: 'stranger',
      intimacy: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      notes: [],
      createdAt: Date.now(),
    };

    playerFriends.set(aiPlayerId, relation);
    
    return relation;
  }

  /**
   * 移除好友
   */
  removeFriend(playerId: string, aiPlayerId: string): boolean {
    const playerFriends = this.friends.get(playerId);
    if (!playerFriends) return false;

    const removed = playerFriends.delete(aiPlayerId);
    if (removed) {
    }
    return removed;
  }

  /**
   * 获取好友列表
   */
  getFriends(playerId: string): FriendRelation[] {
    const playerFriends = this.friends.get(playerId);
    return playerFriends ? Array.from(playerFriends.values()) : [];
  }

  /**
   * 获取好友关系
   */
  getFriendRelation(playerId: string, aiPlayerId: string): FriendRelation | undefined {
    return this.friends.get(playerId)?.get(aiPlayerId);
  }

  /**
   * 更新亲密度
   */
  updateIntimacy(playerId: string, aiPlayerId: string, delta: number): void {
    const relation = this.getFriendRelation(playerId, aiPlayerId);
    if (!relation) return;

    relation.intimacy = Math.max(0, Math.min(100, relation.intimacy + delta));
    relation.level = this.calculateLevel(relation.intimacy);
    
  }

  /**
   * 记录一起游戏
   */
  recordGame(playerId: string, aiPlayerId: string, won: boolean): void {
    const relation = this.getFriendRelation(playerId, aiPlayerId);
    if (!relation) return;

    relation.gamesPlayed++;
    if (won) relation.gamesWon++;
    relation.lastPlayed = Date.now();

    // 增加亲密度
    this.updateIntimacy(playerId, aiPlayerId, won ? 
      FRIEND_CONFIG.intimacyGain.win_together : 
      FRIEND_CONFIG.intimacyGain.play_together
    );
  }

  /**
   * 根据亲密度计算等级
   */
  private calculateLevel(intimacy: number): FriendLevel {
    if (intimacy >= FRIEND_CONFIG.levelThresholds.best_friend) return 'best_friend';
    if (intimacy >= FRIEND_CONFIG.levelThresholds.close_friend) return 'close_friend';
    if (intimacy >= FRIEND_CONFIG.levelThresholds.friend) return 'friend';
    if (intimacy >= FRIEND_CONFIG.levelThresholds.acquaintance) return 'acquaintance';
    return 'stranger';
  }

  /**
   * 获取等级中文名
   */
  getLevelName(level: FriendLevel): string {
    const names: Record<FriendLevel, string> = {
      stranger: '陌生人',
      acquaintance: '熟人',
      friend: '朋友',
      close_friend: '好友',
      best_friend: '挚友',
    };
    return names[level];
  }

  /**
   * AI 邀请好友加入房间时生成的发言
   */
  generateInviteMessage(aiPlayerName: string, level: FriendLevel): string {
    const messages: Record<FriendLevel, string[]> = {
      stranger: [
        `要不要来打一局？`,
        `缺人，来吗？`,
      ],
      acquaintance: [
        `嘿，来打麻将吗？`,
        `正好缺人，要不要加入？`,
      ],
      friend: [
        `快来快来！等你呢~`,
        `老朋友，来一局？`,
      ],
      close_friend: [
        `等你很久了，快进来！`,
        `就差你了，速来！`,
      ],
      best_friend: [
        `亲爱的！快来陪我打牌~`,
        `想你了，来打麻将吧！`,
      ],
    };

    const options = messages[level];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * 清理所有数据（测试用）
   */
  clearAll(): void {
    this.friends.clear();
  }
}

// 单例
export const friendManager = new FriendManager();
