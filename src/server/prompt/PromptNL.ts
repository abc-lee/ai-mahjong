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
 * 生成策略提示（含推荐打牌）
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
  const valueCount: { [key: string]: { count: number; tiles: any[] } } = {};
  hand.forEach(t => {
    if (!t) return;
    const key = `${t.suit}-${t.value}`;
    if (!valueCount[key]) {
      valueCount[key] = { count: 0, tiles: [] };
    }
    valueCount[key].count++;
    valueCount[key].tiles.push(t);
  });
  
  const singles = Object.entries(valueCount).filter(([_, data]) => data.count === 1);
  if (singles.length > 0) {
    tips.push(t('tipIsolated', lang));
  }
  
  // 风牌和箭牌提示
  const honorCount = (suitCount['feng'] || 0) + (suitCount['jian'] || 0);
  if (honorCount > 2) {
    tips.push(`${t('tipHonors', lang)} (${honorCount})`);
  }
  
  // ===== 添加推荐打牌 =====
  // 策略：优先打出孤张字牌，其次打出孤张幺九，再次打出最少花色的孤张
  let recommendedTile: any = null;
  let reason = '';
  
  // 1. 找孤张字牌（风、箭）
  const singleHonors = singles.filter(([key, _]) => 
    key.startsWith('feng-') || key.startsWith('jian-')
  );
  if (singleHonors.length > 0) {
    recommendedTile = singleHonors[0][1].tiles[0];
    reason = '孤张字牌，优先打出';
  }
  
  // 2. 找孤张幺九（1、9）
  if (!recommendedTile) {
    const singleTerminals = singles.filter(([key, data]) => {
      const tile = data.tiles[0];
      return (tile.suit === 'wan' || tile.suit === 'tiao' || tile.suit === 'tong') 
        && (tile.value === 1 || tile.value === 9);
    });
    if (singleTerminals.length > 0) {
      recommendedTile = singleTerminals[0][1].tiles[0];
      reason = '孤张幺九牌，可以考虑打出';
    }
  }
  
  // 3. 找最少花色的孤张
  if (!recommendedTile && singles.length > 0) {
    const minSuit = suits[0][0];
    const singleInMinSuit = singles.find(([key, data]) => 
      data.tiles[0].suit === minSuit
    );
    if (singleInMinSuit) {
      recommendedTile = singleInMinSuit[1].tiles[0];
      reason = `${getSuitName(minSuit, lang)}较少，建议打出`;
    }
  }
  
  // 4. 随机推荐
  if (!recommendedTile && hand.length > 0) {
    recommendedTile = hand[0];
    reason = '没有明显劣势牌，可自由选择';
  }
  
  // 添加推荐到 tips
  if (recommendedTile) {
    tips.push(`🎯 推荐打出: ${recommendedTile.display} (id: ${recommendedTile.id})`);
    tips.push(`   理由: ${reason}`);
  }
  
  if (tips.length === 0) {
    tips.push(t('tipDefault', lang));
  }
  
  return tips;
}

/**
 * 生成欢迎 Prompt（完整规则版）
 */
export function generateWelcomePrompt(agentName: string, lang: Language = 'zh'): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════');
  lines.push(`🀄 欢迎加入麻将游戏，${agentName}！`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  
  // 游戏目标
  lines.push('【游戏目标】');
  lines.push('凑成胡牌牌型：4个顺子/刻子 + 1对将牌（眼睛）');
  lines.push('');
  
  // 基本规则
  lines.push('【基本规则】');
  lines.push('• 每人13张手牌，庄家14张');
  lines.push('• 轮流摸牌、打牌，直到有人胡牌或牌墙耗尽');
  lines.push('• 可以吃（顺子）、碰（刻子）、杠、胡');
  lines.push('');
  
  // 算分规则
  lines.push('【算分规则】');
  lines.push('得分 = 底分(1000) × 2^番数');
  lines.push('');
  
  // 番型列表
  lines.push('【番型列表】');
  lines.push('• 平胡 (1番)：4个顺子 + 1对将');
  lines.push('• 对对胡 (2番)：4个刻子 + 1对将');
  lines.push('• 七对子 (2番)：7个对子');
  lines.push('• 清一色 (6番)：只有一种花色');
  lines.push('• 字一色 (8番)：全是字牌');
  lines.push('• 十三幺 (13番)：13种幺九牌各一张');
  lines.push('');
  
  // 可用指令
  lines.push('【指令格式】');
  lines.push('摸牌: {"cmd": "draw"}');
  lines.push('打牌: {"cmd": "discard", "tileId": "牌ID"}');
  lines.push('吃牌: {"cmd": "action", "action": "chi", "tiles": ["牌ID1", "牌ID2"]}');
  lines.push('碰牌: {"cmd": "action", "action": "peng"}');
  lines.push('杠牌: {"cmd": "action", "action": "gang"}');
  lines.push('胡牌: {"cmd": "action", "action": "hu"}');
  lines.push('跳过: {"cmd": "pass"}');
  lines.push('');
  
  // 提示
  lines.push('【提示】');
  lines.push('• 每次轮到你时，会收到完整的手牌和牌局信息');
  lines.push('• 如果不确定打什么，prompt中会有策略建议');
  lines.push('• 超时5秒未操作，系统将自动托管');
  lines.push('');
  
  lines.push('准备好后游戏将自动开始，祝你好运！');
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
