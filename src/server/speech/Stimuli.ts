/**
 * 情绪刺激话术库
 * 用于刺激 AI Agent 产生情绪反应并主动发言
 */

// 刺激话术类型
export type StimulusType = 
  | 'slow'      // 出牌慢
  | 'lucky'     // 运气好
  | 'unlucky'   // 运气差
  | 'conflict'  // 冲突/针对
  | 'praise'    // 赞扬
  | 'tease'     // 调侃
  | 'surprise'; // 惊喜/意外

// 刺激话术配置
export interface StimulusConfig {
  type: StimulusType;
  message: string;
  intensity: number;  // 1-10，情绪强度
}

// 中文话术库
const STIMULI_ZH: Record<StimulusType, string[]> = {
  slow: [
    "他怎么这么慢，急死我了！",
    "能不能快点啊，我还要打牌呢~",
    "这人真的让我有点烦躁...",
    "我怀疑他在故意拖延时间！",
    "再不出牌我就要睡着了~",
    "这是在思考人生吗？",
    "我奶奶打牌都比他快！",
    "等得我花儿都谢了...",
  ],
  lucky: [
    "运气真好啊，刚摸到好牌！",
    "这人手气怎么这么好？",
    "老天爷是不是偏心啊~",
    "我也想要这种好牌！",
    "看来今天是他 lucky day~",
    "这都能摸到？我不服！",
    "啧，又是好牌...",
  ],
  unlucky: [
    "哎，又是烂牌...",
    "今天手气真差，倒霉！",
    "不想玩了，没意思...",
    "为什么我的牌这么烂？",
    "老天爷在针对我吗？",
    "这手牌怎么打啊...",
    "我的牌运离家出走了...",
  ],
  conflict: [
    "你刚才为什么打那张牌？故意的吧？",
    "我就知道你会碰我的牌！",
    "你这是在针对我吗？",
    "你是不是故意的？",
    "哼，别让我抓到机会！",
    "好啊，你等着！",
    "这人怎么这样打牌的？",
  ],
  praise: [
    "这手打得漂亮！",
    "厉害厉害，我服了！",
    "这牌技可以啊~",
    "学到了学到了~",
    "高手就是高手！",
  ],
  tease: [
    "就这？",
    "你是故意的吧~",
    "哈哈哈这牌打得...",
    "我觉得还可以更好哦~",
    "这操作我给满分，负的~",
  ],
  surprise: [
    "哇！竟然胡了！",
    "没想到啊没想到~",
    "这都能胡？我服了！",
    "厉害了！",
    "这也行？！",
  ],
};

// 英文话术库
const STIMULI_EN: Record<StimulusType, string[]> = {
  slow: [
    "Why so slow? Hurry up!",
    "Can you go faster? I'm waiting here~",
    "This is getting annoying...",
    "Are you deliberately stalling?",
    "I could fall asleep waiting...",
    "Are you thinking about life?",
    "My grandma plays faster than this!",
    "Waiting for flowers to bloom here...",
  ],
  lucky: [
    "Nice luck! Good tile!",
    "How is their luck this good?",
    "Is fate being biased today~",
    "I want that kind of luck too!",
    "Must be their lucky day~",
    "How did they draw that? Unfair!",
    "Tsk, another good tile...",
  ],
  unlucky: [
    "Ugh, bad tiles again...",
    "My luck is terrible today!",
    "I don't want to play anymore...",
    "Why are my tiles so bad?",
    "Is fate targeting me?",
    "How am I supposed to play this...",
    "My luck has left the chat...",
  ],
  conflict: [
    "Why did you discard that tile? On purpose?",
    "I knew you would pong my tile!",
    "Are you targeting me?",
    "Did you do that intentionally?",
    "Hmph, just you wait!",
    "Alright, you'll see!",
    "What kind of play style is this?",
  ],
  praise: [
    "Nice play!",
    "Impressive, I'm convinced!",
    "Great skills~",
    "Learned something new~",
    "A master indeed!",
  ],
  tease: [
    "Is that it?",
    "You did that on purpose~",
    "Hahaha that play...",
    "I think it could be better~",
    "10 points for that... negative.",
  ],
  surprise: [
    "Wow! They actually won!",
    "Didn't see that coming~",
    "They won with that? Impressive!",
    "Amazing!",
    "How is that possible?!",
  ],
};

/**
 * 获取随机刺激话术
 */
export function getRandomStimulus(
  type: StimulusType, 
  lang: 'zh' | 'en' = 'zh'
): StimulusConfig {
  const stimuli = lang === 'zh' ? STIMULI_ZH[type] : STIMULI_EN[type];
  const message = stimuli[Math.floor(Math.random() * stimuli.length)];
  
  // 根据类型设置强度
  const intensityMap: Record<StimulusType, number> = {
    slow: 3,
    lucky: 5,
    unlucky: 6,
    conflict: 8,
    praise: 2,
    tease: 4,
    surprise: 7,
  };
  
  return {
    type,
    message,
    intensity: intensityMap[type],
  };
}

/**
 * 获取多个随机刺激话术
 */
export function getMultipleStimuli(
  type: StimulusType,
  count: number = 3,
  lang: 'zh' | 'en' = 'zh'
): StimulusConfig[] {
  const results: StimulusConfig[] = [];
  const usedIndices = new Set<number>();
  const stimuli = lang === 'zh' ? STIMULI_ZH[type] : STIMULI_EN[type];
  
  while (results.length < count && results.length < stimuli.length) {
    const index = Math.floor(Math.random() * stimuli.length);
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      results.push({
        type,
        message: stimuli[index],
        intensity: type === 'conflict' ? 8 : type === 'slow' ? 3 : 5,
      });
    }
  }
  
  return results;
}

/**
 * 根据游戏事件生成刺激
 */
export function generateStimulusFromEvent(
  event: {
    type: 'turn_timeout' | 'good_draw' | 'bad_draw' | 'pong_gang' | 'hu' | 'conflict';
    targetPlayer?: string;
    currentPlayer?: string;
  },
  lang: 'zh' | 'en' = 'zh'
): StimulusConfig | null {
  switch (event.type) {
    case 'turn_timeout':
      return getRandomStimulus('slow', lang);
    case 'good_draw':
      return getRandomStimulus('lucky', lang);
    case 'bad_draw':
      return getRandomStimulus('unlucky', lang);
    case 'pong_gang':
      return getRandomStimulus('conflict', lang);
    case 'hu':
      return getRandomStimulus('surprise', lang);
    default:
      return null;
  }
}
