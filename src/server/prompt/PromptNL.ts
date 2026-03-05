/**
 * 多语言自然语言 Prompt 生成器
 * 支持中文/英文切换
 */

export type Language = 'zh' | 'en';

interface PromptConfig {
  lang: Language;
}

// 多语言文本
const TRANSLATIONS = {
  zh: {
    yourTurn: '【麻将游戏 - 你的回合】',
    drawPhase: '📤 轮到你摸牌了。',
    discardPhase: '🎴 轮到你打牌了。',
    yourHand: '─── 你的手牌 ───',
    justDrawn: '📥 刚摸到:',
    gameInfo: '─── 牌局信息 ───',
    remainingTiles: '剩余牌数:',
    player: '玩家',
    discarded: '弃牌',
    melds: '副露',
    lastDiscard: '上一张弃牌:',
    strategyTips: '─── 策略提示 ───',
    pleaseDiscard: '请打出一张牌:',
    availableCommands: '─── 可用指令 ───',
    cmdDraw: '摸牌:',
    cmdDiscard: '打牌:',
    cmdAction: '吃碰杠胡:',
    cmdPass: '跳过:',
    example: '例如打出第一张:',
    suitWan: '万',
    suitTiao: '条',
    suitTong: '筒',
    suitFeng: '风',
    suitJian: '箭',
    tiles: '张',
    tipFewSuit: '牌较少，可以考虑打出',
    tipIsolated: '孤张牌较多，优先打出无法成搭的牌',
    tipHonors: '字牌较多，可考虑保留成刻或尽早打出',
    tipDefault: '观察牌局，选择最优打法',
    // 操作名称
    actionHu: '胡牌',
    actionGang: '杠牌',
    actionPeng: '碰牌',
    actionChi: '吃牌',
    // 欢迎
    welcome: '欢迎加入麻将游戏！',
    objective: '【游戏目标】',
    objectiveText: '凑成胡牌牌型: 4个顺子/刻子 + 1对将牌',
    rules: '【基本规则】',
    rule1: '每人13张手牌，轮流摸打',
    rule2: '可以吃、碰、杠、胡',
    rule3: '听牌后可胡任何一家打出的牌',
    controls: '【操作方式】',
    controlsText: '轮到你时会收到提示，按格式回复即可。',
    readyText: '准备好后游戏将自动开始，祝你好运！',
    // 错误
    errorTitle: '❌ 【操作失败】',
    suggestion: '💡 建议:',
    retryText: '请重新发送正确的指令。',
    // 可选操作
    selectAction: '【可以选择的操作】',
    youCanChoose: '你可以选择:',
    lastPlayed: '上一家打出:',
  },
  en: {
    yourTurn: '【Mahjong - Your Turn】',
    drawPhase: '📤 It\'s your turn to draw.',
    discardPhase: '🎴 It\'s your turn to discard.',
    yourHand: '─── Your Hand ───',
    justDrawn: '📥 Just drawn:',
    gameInfo: '─── Game Info ───',
    remainingTiles: 'Remaining tiles:',
    player: 'Player',
    discarded: 'discarded',
    melds: 'melds',
    lastDiscard: 'Last discard:',
    strategyTips: '─── Strategy Tips ───',
    pleaseDiscard: 'Please discard a tile:',
    availableCommands: '─── Available Commands ───',
    cmdDraw: 'Draw:',
    cmdDiscard: 'Discard:',
    cmdAction: 'Chi/Peng/Gang/Hu:',
    cmdPass: 'Pass:',
    example: 'Example, discard first tile:',
    suitWan: 'Wan',
    suitTiao: 'Tiao',
    suitTong: 'Tong',
    suitFeng: 'Wind',
    suitJian: 'Dragon',
    tiles: 'tiles',
    tipFewSuit: 'suit has few tiles, consider discarding',
    tipIsolated: 'Many isolated tiles, prioritize discarding useless ones',
    tipHonors: 'Many honor tiles, consider keeping for sets or discarding early',
    tipDefault: 'Observe the game, choose the best play',
    actionHu: 'Hu (Win)',
    actionGang: 'Gang (Kong)',
    actionPeng: 'Peng (Pong)',
    actionChi: 'Chi (Chow)',
    welcome: 'Welcome to Mahjong!',
    objective: '【Objective】',
    objectiveText: 'Form a winning hand: 4 sets + 1 pair',
    rules: '【Basic Rules】',
    rule1: 'Each player has 13 tiles, take turns to draw and discard',
    rule2: 'You can Chi, Peng, Gang, or Hu',
    rule3: 'When ready, you can Hu on any player\'s discard',
    controls: '【Controls】',
    controlsText: 'Follow the prompts when it\'s your turn.',
    readyText: 'Game will start automatically. Good luck!',
    errorTitle: '❌ 【Action Failed】',
    suggestion: '💡 Suggestion:',
    retryText: 'Please send a valid command.',
    selectAction: '【Available Actions】',
    youCanChoose: 'You can choose:',
    lastPlayed: 'Last player discarded:',
  }
};

function t(key: keyof typeof TRANSLATIONS['zh'], lang: Language): string {
  return TRANSLATIONS[lang][key] || TRANSLATIONS['zh'][key];
}

/**
 * 获取花色名称
 */
function getSuitName(suit: string, lang: Language): string {
  const suitMap: { [key: string]: string } = {
    wan: t('suitWan', lang),
    tiao: t('suitTiao', lang),
    tong: t('suitTong', lang),
    feng: t('suitFeng', lang),
    jian: t('suitJian', lang),
  };
  return suitMap[suit] || suit;
}

/**
 * 生成回合 Prompt
 */
export function generateYourTurnPrompt(data: {
  phase: 'draw' | 'discard' | 'action';
  hand?: any[];
  lastDrawnTile?: any;
  gameState?: any;
  playerName?: string;
  lang?: Language;
}): string {
  const { phase, hand, lastDrawnTile, gameState, playerName } = data;
  const lang = data.lang || 'zh';
  
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════');
  lines.push(t('yourTurn', lang));
  lines.push('═══════════════════════════════════════');
  lines.push('');
  
  if (phase === 'draw') {
    lines.push(t('drawPhase', lang));
    lines.push('');
    lines.push(`${t('cmdDraw', lang)} {"cmd": "draw"}`);
  } else if (phase === 'discard') {
    lines.push(t('discardPhase', lang));
    lines.push('');
    
    // 手牌信息
    if (hand && hand.length > 0) {
      lines.push(t('yourHand', lang));
      
      // 按花色分组显示
      const suits: { [key: string]: string[] } = {};
      hand.forEach(t => {
        if (!t) return;
        const suitName = getSuitName(t.suit, lang);
        if (!suits[suitName]) suits[suitName] = [];
        const display = t.display || `${suitName}${t.value}`;
        suits[suitName].push(display);
      });
      
      Object.entries(suits).forEach(([suit, tiles]) => {
        lines.push(`【${suit}】${tiles.join(' ')}`);
      });
      lines.push(`${t('tiles', lang)}: ${hand.length}`);
      lines.push('');
    }
    
    // 刚摸到的牌
    if (lastDrawnTile) {
      lines.push(`${t('justDrawn', lang)} ${lastDrawnTile.display}`);
      lines.push('');
    }
    
    // 牌局分析
    if (gameState) {
      lines.push(t('gameInfo', lang));
      lines.push(`${t('remainingTiles', lang)} ${gameState.wallRemaining || '?'}`);
      
      if (gameState.players) {
        gameState.players.forEach((p: any, idx: number) => {
          if (p.name !== playerName) {
            const discardCount = p.discards?.length || 0;
            const meldCount = p.melds?.length || 0;
            lines.push(`${t('player', lang)}${idx + 1}(${p.name}): ${t('discarded', lang)}${discardCount}, ${t('melds', lang)}${meldCount}`);
          }
        });
      }
      
      if (gameState.lastDiscard) {
        lines.push(`${t('lastDiscard', lang)} ${gameState.lastDiscard.display}`);
      }
      lines.push('');
    }
    
    // 策略建议
    lines.push(t('strategyTips', lang));
    const tips = generateTips(hand, lang);
    tips.forEach(tip => lines.push('💡 ' + tip));
    lines.push('');
    
    lines.push(t('pleaseDiscard', lang));
    lines.push(`格式: {"cmd": "discard", "tileId": "tile-id"}`);
    lines.push('');
    lines.push(`${t('example', lang)} {"cmd": "discard", "tileId": "${hand?.[0]?.id || 'xxx'}"}`);
  }
  
  lines.push('');
  lines.push(t('availableCommands', lang));
  lines.push(`${t('cmdDraw', lang)} {"cmd": "draw"}`);
  lines.push(`${t('cmdDiscard', lang)} {"cmd": "discard", "tileId": "id"}`);
  lines.push(`${t('cmdAction', lang)} {"cmd": "action", "action": "chi/peng/gang/hu"}`);
  lines.push(`${t('cmdPass', lang)} {"cmd": "pass"}`);
  lines.push('');
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * 生成策略提示
 */
function generateTips(hand: any[], lang: Language): string[] {
  const tips: string[] = [];
  
  if (!hand || hand.length === 0) return [t('tipDefault', lang)];
  
  // 统计各花色数量
  const suitCount: { [key: string]: number } = {};
  hand.forEach(t => {
    if (!t) return;
    const suit = t.suit || 'unknown';
    suitCount[suit] = (suitCount[suit] || 0) + 1;
  });
  
  // 找出数量最少的花色
  const suits = Object.entries(suitCount).sort((a, b) => a[1] - b[1]);
  
  if (suits.length > 0 && suits[0][1] <= 2) {
    const suitName = getSuitName(suits[0][0], lang);
    tips.push(`${suitName}${t('tipFewSuit', lang)}`);
  }
  
  // 检查孤张
  const valueCount: { [key: string]: number } = {};
  hand.forEach(t => {
    if (!t) return;
    const key = `${t.suit}-${t.value}`;
    valueCount[key] = (valueCount[key] || 0) + 1;
  });
  
  const singles = Object.entries(valueCount).filter(([_, count]) => count === 1);
  if (singles.length > 0) {
    tips.push(t('tipIsolated', lang));
  }
  
  // 风牌和箭牌提示
  const honorCount = (suitCount['feng'] || 0) + (suitCount['jian'] || 0);
  if (honorCount > 2) {
    tips.push(`${t('tipHonors', lang)} (${honorCount})`);
  }
  
  if (tips.length === 0) {
    tips.push(t('tipDefault', lang));
  }
  
  return tips;
}

/**
 * 生成欢迎 Prompt
 */
export function generateWelcomePrompt(agentName: string, lang: Language = 'zh'): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════');
  lines.push(`${t('welcome', lang)} ${agentName}!`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(t('objective', lang));
  lines.push(t('objectiveText', lang));
  lines.push('');
  lines.push(t('rules', lang));
  lines.push('• ' + t('rule1', lang));
  lines.push('• ' + t('rule2', lang));
  lines.push('• ' + t('rule3', lang));
  lines.push('');
  lines.push(t('controls', lang));
  lines.push(t('controlsText', lang));
  lines.push('');
  lines.push(t('readyText', lang));
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * 生成错误 Prompt
 */
export function generateErrorPrompt(error: string, context?: {
  hand?: any[];
  suggestion?: string;
  lang?: Language;
}): string {
  const lang = context?.lang || 'zh';
  const lines: string[] = [];
  
  lines.push('');
  lines.push(t('errorTitle', lang));
  lines.push(error);
  lines.push('');
  
  if (context?.hand) {
    lines.push(t('yourHand', lang));
    const handStr = context.hand.map(t => `${t.display}(${t.id})`).join(', ');
    lines.push(handStr);
    lines.push('');
  }
  
  if (context?.suggestion) {
    lines.push(`${t('suggestion', lang)} ${context.suggestion}`);
    lines.push('');
  }
  
  lines.push(t('retryText', lang));
  
  return lines.join('\n');
}

/**
 * 生成操作选择 Prompt
 */
export function generateActionPrompt(data: {
  actions: any[];
  lastDiscard?: any;
  hand?: any[];
  lang?: Language;
}): string {
  const { actions, lastDiscard, hand } = data;
  const lang = data.lang || 'zh';
  
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════');
  lines.push(t('selectAction', lang));
  lines.push('═══════════════════════════════════════');
  lines.push('');
  
  if (lastDiscard) {
    lines.push(`${t('lastPlayed', lang)} ${lastDiscard.display}`);
    lines.push('');
  }
  
  lines.push(t('youCanChoose', lang));
  actions.forEach((a, idx) => {
    const actionName = {
      'hu': t('actionHu', lang),
      'gang': t('actionGang', lang),
      'peng': t('actionPeng', lang),
      'chi': t('actionChi', lang),
    }[a.action] || a.action;
    
    lines.push(`${idx + 1}. ${actionName}`);
  });
  lines.push('');
  
  lines.push(t('availableCommands', lang));
  
  if (actions.some(a => a.action === 'hu')) {
    lines.push(`${t('actionHu', lang)}: {"cmd": "action", "action": "hu"}`);
  }
  if (actions.some(a => a.action === 'gang')) {
    lines.push(`${t('actionGang', lang)}: {"cmd": "action", "action": "gang"}`);
  }
  if (actions.some(a => a.action === 'peng')) {
    lines.push(`${t('actionPeng', lang)}: {"cmd": "action", "action": "peng"}`);
  }
  if (actions.some(a => a.action === 'chi')) {
    lines.push(`${t('actionChi', lang)}: {"cmd": "action", "action": "chi", "tiles": [...tileIds]}`);
  }
  
  lines.push(`${t('cmdPass', lang)} {"cmd": "pass"}`);
  lines.push('');
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}
