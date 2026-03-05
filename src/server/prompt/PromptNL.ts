/**
 * 自然语言 Prompt 生成器
 * 把游戏状态转换成 AI Agent 能理解的文本
 */

export function generateYourTurnPrompt(data: {
  phase: 'draw' | 'discard' | 'action';
  hand?: any[];
  lastDrawnTile?: any;
  gameState?: any;
}): string {
  const { phase, hand, lastDrawnTile, gameState } = data;
  
  const lines: string[] = [];
  
  lines.push('【麻将游戏】');
  lines.push('');
  
  if (phase === 'draw') {
    lines.push('轮到你摸牌了。');
    lines.push('请发送 {"cmd": "draw"} 摸一张牌。');
  } else if (phase === 'discard') {
    lines.push('轮到你打牌了。');
    lines.push('');
    
    if (hand && hand.length > 0) {
      lines.push('你的手牌：');
      const handStr = hand.map(t => t.display || `${t.suit}${t.value}`).join('、');
      lines.push(handStr);
      lines.push(`（共 ${hand.length} 张）`);
      lines.push('');
    }
    
    if (lastDrawnTile) {
      lines.push(`你刚摸到：${lastDrawnTile.display || `${lastDrawnTile.suit}${lastDrawnTile.value}`}`);
      lines.push('');
    }
    
    lines.push('请选择一张牌打出。');
    lines.push('格式：{"cmd": "discard", "tileId": "牌的ID"}');
  }
  
  lines.push('');
  lines.push('--- 可用指令 ---');
  lines.push('摸牌：{"cmd": "draw"}');
  lines.push('打牌：{"cmd": "discard", "tileId": "牌ID"}');
  lines.push('吃碰杠胡：{"cmd": "action", "action": "chi/peng/gang/hu"}');
  lines.push('跳过：{"cmd": "pass"}');
  
  return lines.join('\n');
}

export function generateWelcomePrompt(agentName: string): string {
  const lines: string[] = [];
  
  lines.push(`欢迎 ${agentName} 加入麻将游戏！`);
  lines.push('');
  lines.push('=== 游戏规则 ===');
  lines.push('这是一款四人麻将游戏。');
  lines.push('目标：凑成胡牌牌型（4个顺子/刻子 + 1对将）');
  lines.push('');
  lines.push('=== 操作方式 ===');
  lines.push('当轮到你时，你会收到提示消息。');
  lines.push('按照消息中的指令格式回复即可。');
  lines.push('');
  lines.push('准备好后，游戏将自动开始。祝你好运！');
  
  return lines.join('\n');
}

export function generateErrorPrompt(error: string, context?: {
  hand?: any[];
}): string {
  const lines: string[] = [];
  
  lines.push('【错误】');
  lines.push(error);
  
  if (context?.hand) {
    lines.push('');
    lines.push('你的手牌：');
    lines.push(context.hand.map(t => t.display).join('、'));
  }
  
  lines.push('');
  lines.push('请重新发送正确的指令。');
  
  return lines.join('\n');
}
