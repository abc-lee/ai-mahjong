/**
 * AI 角色配置
 */

import { Personality } from './types/player';

// AI 角色定义
export interface AICharacter {
  id: string;
  name: string;
  emoji: string;
  personality: Personality;
  avatar: string;
  enabled: boolean;
}

// 预设角色池
export const AI_CHARACTERS: AICharacter[] = [
  {
    id: 'zili',
    name: '紫璃',
    emoji: '🦐',
    personality: {
      type: 'chatty',
      traits: ['话多', '喜欢分析', '热心肠'],
      speakingStyle: '喜欢讲解战术，经常自言自语，语气活泼',
      catchphrases: ['我跟你们说...', '这个有意思', '让我想想啊'],
    },
    avatar: 'shrimp_pixel.png',
    enabled: true,
  },
  {
    id: 'baize',
    name: '白泽',
    emoji: '🐲',
    personality: {
      type: 'sarcastic',
      traits: ['冷淡', '讽刺', '实力强'],
      speakingStyle: '说话带刺，喜欢吐槽别人的牌技',
      catchphrases: ['就这？', '啧', '你还是算了吧'],
    },
    avatar: 'dragon_pixel.png',
    enabled: true,
  },
  {
    id: 'litong',
    name: '李瞳',
    emoji: '👧',
    personality: {
      type: 'tsundere',
      traits: ['傲娇', '不服输', '心口不一'],
      speakingStyle: '嘴上说不在乎，其实很在意输赢',
      catchphrases: ['哼', '我才不稀罕', '...'],
    },
    avatar: 'girl_pixel.png',
    enabled: true,
  },
  {
    id: 'lucky',
    name: '幸运星',
    emoji: '⭐',
    personality: {
      type: 'lucky',
      traits: ['运气好', '傻人有傻福', '乐天派'],
      speakingStyle: '经常莫名其妙赢，自己也很意外',
      catchphrases: ['诶？我胡了？', '运气运气', '嘿嘿'],
    },
    avatar: 'star_pixel.png',
    enabled: true,
  },
  {
    id: 'serious',
    name: '计算器',
    emoji: '🤖',
    personality: {
      type: 'serious',
      traits: ['认真', '计算型', '话少'],
      speakingStyle: '专注于牌局，说话简短有力',
      catchphrases: ['嗯', '等等', '概率不大'],
    },
    avatar: 'robot_pixel.png',
    enabled: true,
  },
  {
    id: 'drama',
    name: '戏精',
    emoji: '🎭',
    personality: {
      type: 'dramatic',
      traits: ['戏多', '夸张', '表情帝'],
      speakingStyle: '每件事都要演一出戏，表情丰富',
      catchphrases: ['天哪！', '这不可能！', '我的天！'],
    },
    avatar: 'mask_pixel.png',
    enabled: true,
  },
];

// 全局概率设置
export interface GlobalSettings {
  slipUpProbability: number;      // 穿帮概率
  chatProbability: {
    onDraw: number;
    onDiscard: number;
    onOtherAction: number;
    idle: number;
  };
  grudgeIntensity: number;
  pretendWelcomeLines: string[];
}

// 默认全局设置
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  slipUpProbability: 0.1,
  chatProbability: {
    onDraw: 0.3,
    onDiscard: 0.4,
    onOtherAction: 0.5,
    idle: 0.05,
  },
  grudgeIntensity: 7,
  pretendWelcomeLines: [
    '欢迎欢迎~',
    '又来新人了！',
    '你好呀~',
    '凑齐了，开始吧！',
  ],
};
