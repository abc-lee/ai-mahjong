/**
 * 提示词加载器
 * 从 JSON 文件加载提示词，支持变量替换和多语言
 */

import * as fs from 'fs';
import * as path from 'path';

// 支持的语言
export type Language = 'zh-CN' | 'en-US';

// 提示词配置类型
export interface PersonalityConfig {
  name: string;
  traits: string[];
  speakStyle: string;
  hint?: string;
  gender?: string;
  chatFrequency: number;
  chatProbability?: number;
  angerThreshold?: number;
  behaviors?: string[];
  templates?: {
    happy?: string[];
    angry?: string[];
    thinking?: string[];
    winning?: string[];
    losing?: string[];
    greeting?: string[];
    goodbye?: string[];
  };
}

export interface PromptConfig {
  common: {
    directions: string[];
    suitNames: Record<string, string>;
    actionNames: Record<string, string>;
    playerTypes: Record<string, string>;
  };
  identityTemplate: {
    core: string;
    genderOptions: string[];
  };
  personalityGuide: Record<string, {
    traits: string[];
    chatProbability: number;
  }>;
  chatRules: {
    do: string[];
    dont: string[];
    triggers: string[];
  };
  aiAdapter: {
    chatResponse: { system: string; user: string };
    queueReaction: { 
      system: string; 
      userMentioned: string; 
      userWithSpeaker: string; 
      userDefault: string 
    };
    idleChat: { 
      system: string; 
      userReplyingToMe: string; 
      userWithChats: string; 
      userNoChat: string 
    };
    decision: { system: string; user: string };
    sections: {
      lastDiscard: string;
      otherPlayers: string;
      chatHistory: string;
      recentEvents: string;
      crossGameMemory: string;
    };
    fallbackTemplates: Record<string, string[]>;
  };
  gameInfo: {
    gameStart: string;
    yourTurnDraw: string;
    yourTurnDiscard: string;
    actionRequired: string;
    actionSuccess: string;
    actionFailed: string;
    otherPlayerAction: string;
    gameEnd: string;
  };
  conversation: {
    response: { system: string; user: string };
    fallbackTemplates: Record<string, string[]>;
  };
  llmClient: {
    systemPrompt: string;
    defaultPersonality: string;
  };
  promptNL: Record<string, string>;
  personalities: Record<string, PersonalityConfig>;
  characters: Record<string, PersonalityConfig>;
}

/**
 * 提示词加载器类
 */
class PromptLoader {
  private config: PromptConfig | null = null;
  private language: Language = 'zh-CN';
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'locales', this.language, 'prompts.json');
  }

  /**
   * 设置语言
   */
  setLanguage(lang: Language): void {
    this.language = lang;
    this.configPath = path.join(process.cwd(), 'locales', this.language, 'prompts.json');
    this.config = null; // 清除缓存，下次加载时会重新读取
  }

  /**
   * 获取当前语言
   */
  getLanguage(): Language {
    return this.language;
  }

  /**
   * 加载提示词配置
   */
  load(): PromptConfig {
    if (this.config) {
      return this.config;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      // 移除 _comment 和 _version 字段
      const rawConfig = JSON.parse(content);
      const { _comment, _version, ...config } = rawConfig;
      this.config = config as PromptConfig;
      return this.config;
    } catch (e: any) {
      console.error(`[PromptLoader] 加载提示词文件失败: ${this.configPath}`, e.message);
      throw new Error(`Failed to load prompts: ${e.message}`);
    }
  }

  /**
   * 重新加载配置（用于开发时热更新）
   */
  reload(): PromptConfig {
    this.config = null;
    return this.load();
  }

  /**
   * 替换模板变量
   * 格式：{{variableName}}
   */
  replaceVars(template: string, vars: Record<string, string | number | boolean>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * 获取指定路径的提示词
   * @param path 点分隔的路径，如 'aiAdapter.chatResponse.system'
   */
  get(path: string): string {
    const config = this.load();
    const parts = path.split('.');
    let current: any = config;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        throw new Error(`Prompt not found: ${path}`);
      }
      current = current[part];
    }
    
    if (typeof current !== 'string') {
      throw new Error(`Prompt at ${path} is not a string`);
    }
    
    return current;
  }

  /**
   * 获取提示词并替换变量
   */
  getWithVars(path: string, vars: Record<string, string | number | boolean>): string {
    const template = this.get(path);
    return this.replaceVars(template, vars);
  }

  /**
   * 获取整个模块配置
   */
  getModule(module: 'common' | 'aiAdapter' | 'gameInfo' | 'conversation' | 'llmClient' | 'promptNL' | 'personalities'): any {
    const config = this.load();
    return config[module];
  }

  // ==================== 便捷方法 ====================

  /**
   * 获取方位名称
   */
  getDirection(index: number): string {
    const config = this.load();
    return config.common.directions[index] || '未知';
  }

  /**
   * 获取花色名称
   */
  getSuitName(suit: string): string {
    const config = this.load();
    return config.common.suitNames[suit] || suit;
  }

  /**
   * 获取操作名称
   */
  getActionName(action: string): string {
    const config = this.load();
    return config.common.actionNames[action] || action;
  }

  /**
   * 获取玩家类型名称
   */
  getPlayerType(type: string): string {
    const config = this.load();
    return config.common.playerTypes[type] || type;
  }

  /**
   * 获取性格配置（按类型，如 chatty、aggressive）
   */
  getPersonality(type: string): PersonalityConfig | undefined {
    const config = this.load();
    return config.personalities[type];
  }

  /**
   * 获取预设角色配置（按名字，如 紫璃、白泽）
   */
  getCharacter(name: string): PersonalityConfig | undefined {
    const config = this.load();
    return config.characters[name];
  }

  /**
   * 获取所有预设角色名字
   */
  getCharacterNames(): string[] {
    const config = this.load();
    return Object.keys(config.characters);
  }

  /**
   * 获取所有性格类型
   */
  getPersonalityTypes(): string[] {
    const config = this.load();
    return Object.keys(config.personalities);
  }

  /**
   * 获取随机 fallback 回应
   */
  getRandomFallback(type: string, playerName: string): string | null {
    const config = this.load();
    const templates = config.aiAdapter.fallbackTemplates[type];
    if (!templates || templates.length === 0) return null;
    
    const template = templates[Math.floor(Math.random() * templates.length)];
    return this.replaceVars(template, { playerName });
  }

  /**
   * 获取身份模板
   */
  getIdentityTemplate(vars: { playerName: string; gender?: string; traits: string }): string {
    const config = this.load();
    return this.replaceVars(config.identityTemplate.core, {
      playerName: vars.playerName,
      gender: vars.gender || '玩家',
      traits: vars.traits
    });
  }

  /**
   * 获取聊天规则
   */
  getChatRules(): { do: string[]; dont: string[]; triggers: string[] } {
    const config = this.load();
    return config.chatRules;
  }

  /**
   * 获取聊天规则格式化字符串
   */
  getChatRulesFormatted(): { doText: string; dontText: string } {
    const rules = this.getChatRules();
    return {
      doText: rules.do.map(r => `- ${r}`).join('\n'),
      dontText: rules.dont.map(r => `- ${r}`).join('\n')
    };
  }

  /**
   * 获取性格表现指南
   */
  getPersonalityGuide(type: string): string {
    const config = this.load();
    const guide = config.personalityGuide[type];
    if (!guide) return '';
    return guide.traits.join('\n');
  }

  /**
   * 获取说话概率（按性格类型）
   */
  getChatProbability(personalityType: string): number {
    const personality = this.getPersonality(personalityType);
    return personality?.chatProbability || 0.3;
  }

  /**
   * 获取角色的性别
   */
  getCharacterGender(name: string): string {
    const character = this.getCharacter(name);
    return character?.gender || '玩家';
  }
}

// 导出单例
export const promptLoader = new PromptLoader();
