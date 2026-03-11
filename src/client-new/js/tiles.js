/**
 * 麻将牌渲染模块
 * 基于新 UI 设计，生成麻将牌的 HTML
 */

// 牌显示名称映射
const TILE_NAMES = {
  wan: ['一', '二', '三', '四', '五', '六', '七', '八', '九'],
  tiao: ['一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'],
  tong: ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'],
  feng: ['东', '南', '西', '北'],
  dragon: ['中', '发', '白'],
};

// 英文名称映射（用于 title）
const TILE_ENGLISH = {
  wan: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'],
  tiao: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'],
  tong: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'],
};

const WIND_ENGLISH_TITLE = ['East', 'South', 'West', 'North'];
const WIND_ENGLISH_DISPLAY = ['EAST', 'SOUTH', 'WEST', 'NORTH'];
const DRAGON_ENGLISH_TITLE = ['Red Dragon', 'Green Dragon', 'White Dragon'];
const DRAGON_ENGLISH_DISPLAY = ['ZHONG', 'FA', 'BAI'];
const DRAGON_NAMES = ['红中', '发财', '白板'];

/**
 * 获取牌的完整名称（用于 title 属性）
 * @param {string} suit - 花色
 * @param {number} value - 牌值
 * @returns {string} 完整名称，如 "九万 Nine of Characters"
 */
function getTileTitle(suit, value) {
  switch (suit) {
    case 'wan':
      return `${TILE_NAMES.wan[value - 1]}万 ${TILE_ENGLISH.wan[value - 1]} of Characters`;
    case 'tiao':
      if (value === 1) {
        return '一条 One of Bamboo';
      }
      return `${value}条 ${TILE_ENGLISH.tiao[value - 1]} of Bamboo`;
    case 'tong':
      return `${TILE_NAMES.tong[value - 1]} ${TILE_ENGLISH.tong[value - 1]} of Dots`;
    case 'feng':
      return `${TILE_NAMES.feng[value - 1]} ${WIND_ENGLISH_TITLE[value - 1]} Wind`;
    case 'jian':
    case 'dragon':
      return `${DRAGON_NAMES[value - 1]} ${DRAGON_ENGLISH_TITLE[value - 1]}`;
    default:
      return '';
  }
}

/**
 * 渲染单张麻将牌
 * @param {object} tile - 牌对象 {id, suit, value, display}
 * @param {object} options - 选项 {highlight, onClick, size, position}
 * @returns {string} HTML 字符串
 */
export function renderTile(tile, options = {}) {
  const { highlight = false, onClick = null, size = 'normal', position = null, isLastDiscard = false } = options;
  const { suit, value, id } = tile;
  
  // 获取悬停提示文字
  const titleText = getTileTitle(suit, value);
  
  // 按原UI设计稿尺寸：
  // - 手牌（自己）：40px×56px（手机）/ 56px×80px（桌面）
  // - 小牌（弃牌/副露）：24px×36px（手机）/ 32px×48px（桌面）- 都竖着，方便看清
  // - 手牌背面：东西玩家横着，北边竖着（在 renderHiddenHand 中处理）
  let sizeClass;
  
  if (size === 'normal') {
    sizeClass = 'w-10 h-14 sm:w-14 sm:h-20';
  } else {
    // 小牌：都竖着，方便玩家看清
    sizeClass = 'w-6 h-9 sm:w-8 sm:h-12';
  }
  
  // 高亮效果：普通高亮 vs 最后打出牌的高亮（黄框+闪烁）
  let highlightClass;
  if (isLastDiscard) {
    // 最后打出的牌：黄框 + 脉冲闪烁动画
    highlightClass = 'bg-white border-b-4 sm:border-b-8 border-gray-300 ring-4 ring-yellow-400 animate-pulse-last-discard';
  } else if (highlight) {
    // 普通高亮（摸到的牌）
    highlightClass = 'bg-white border-b-4 border-gray-300 ring-2 ring-amber-400';
  } else {
    highlightClass = 'bg-white border-b-4 sm:border-b-8 border-gray-300';
  }
  const clickAttr = onClick ? `onclick="${onClick}"` : '';
  const titleAttr = titleText ? `title="${titleText}"` : '';
  
  const isSmall = size === 'small';
  let content = '';
  
  switch (suit) {
    case 'wan':
      if (isSmall) {
        content = `
          <div class="flex flex-col items-center justify-center">
            <span class="text-[6px] sm:text-[8px] font-bold border border-black px-0.5">萬</span>
            <span class="text-[8px] sm:text-sm font-bold text-red-600">${TILE_NAMES.wan[value - 1]}</span>
          </div>
        `;
      } else {
        content = `
          <span class="text-sm sm:text-xl font-bold border border-black px-0.5 mb-0.5">萬</span>
          <span class="text-base sm:text-2xl font-bold text-red-600">${TILE_NAMES.wan[value - 1]}</span>
        `;
      }
      break;
      
    case 'tiao':
      if (isSmall) {
        // 小牌一条：显示小鸟图标
        if (value === 1) {
          content = `<span class="iconify text-sm sm:text-base text-green-700" data-icon="material-symbols:nature-rounded"></span>`;
        } else {
          content = renderBambooPattern(value, true);
        }
      } else if (value === 1) {
        content = `
          <span class="iconify text-lg sm:text-3xl text-green-700" data-icon="material-symbols:nature-rounded"></span>
          <span class="text-[8px] sm:text-[10px] text-green-700 mt-0.5">一条</span>
        `;
      } else {
        content = renderBambooPattern(value, false);
      }
      break;
      
    case 'tong':
      if (isSmall) {
        content = renderDotPattern(value, false);
      } else {
        content = renderDotPattern(value, false);
      }
      break;
      
    case 'feng':
      if (isSmall) {
        content = `
          <span class="text-sm sm:text-base font-bold text-gray-800">${['東', '南', '西', '北'][value - 1]}</span>
        `;
      } else {
        content = `
          <span class="text-xl sm:text-2xl font-bold text-gray-800">${['東', '南', '西', '北'][value - 1]}</span>
          <span class="text-[6px] sm:text-[8px] text-gray-400 mt-0.5">${WIND_ENGLISH_DISPLAY[value - 1]}</span>
        `;
      }
      break;
      
    case 'jian':
    case 'dragon':
      if (isSmall) {
        if (value === 1) {
          content = `<span class="text-sm sm:text-base font-bold text-red-600">中</span>`;
        } else if (value === 2) {
          content = `<span class="text-sm sm:text-base font-bold text-green-700">發</span>`;
        } else {
          content = `<div class="w-3 h-4 sm:w-4 sm:h-5 border-2 border-blue-200 rounded-sm"></div>`;
        }
      } else {
        if (value === 1) {
          content = `
            <span class="text-xl sm:text-2xl font-bold text-red-600">中</span>
            <span class="text-[6px] sm:text-[8px] text-red-400 opacity-50 mt-0.5">${DRAGON_ENGLISH_DISPLAY[value - 1]}</span>
          `;
        } else if (value === 2) {
          content = `
            <span class="text-xl sm:text-2xl font-bold text-green-700">發</span>
            <span class="text-[6px] sm:text-[8px] text-green-400 opacity-50 mt-0.5">${DRAGON_ENGLISH_DISPLAY[value - 1]}</span>
          `;
        } else {
          content = `
            <div class="w-6 h-8 sm:w-10 sm:h-14 border-2 border-blue-200 rounded-sm"></div>
            <span class="text-[6px] sm:text-[8px] text-blue-300 mt-1">${DRAGON_ENGLISH_DISPLAY[value - 1]}</span>
          `;
        }
      }
      break;
  }
  
  return `
    <div class="tile ${sizeClass} ${highlightClass} rounded-md flex flex-col items-center justify-center p-1 ${isSmall ? '' : 'sm:p-2'} shadow-md hover:shadow-lg transition-shadow" 
         data-tile-id="${id}" 
         data-suit="${suit}" 
         data-value="${value}"
         ${titleAttr}
         ${clickAttr}>
      ${content}
    </div>
  `;
}

/**
 * 渲染条子竹节图案
 * @param {number} value - 牌值 (2-9)
 * @param {boolean} isSmall - 是否小尺寸
 * @returns {string} HTML 字符串
 */
function renderBambooPattern(value, isSmall = false) {
  // 小尺寸用更紧凑的样式
  const wrapperClass = isSmall ? 'transform scale-75' : '';
  
  const patterns = {
    2: `<div class="flex flex-col gap-0.5 ${wrapperClass}">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    3: `<div class="flex flex-col gap-0.5 ${wrapperClass}">
          <div class="bamboo-stick"></div>
          <div class="flex gap-0.5">
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
          </div>
        </div>`,
    4: `<div class="grid grid-cols-2 gap-0.5 px-0.5 ${wrapperClass}">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    5: `<div class="grid grid-cols-2 gap-0.5 ${wrapperClass}">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick col-span-2 mx-auto"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    6: `<div class="grid grid-cols-2 gap-y-0.5 gap-x-1 ${wrapperClass}">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    7: `<div class="flex flex-col gap-0.5 ${wrapperClass}">
          <div class="bamboo-stick mx-auto"></div>
          <div class="grid grid-cols-3 gap-0.5">
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
          </div>
        </div>`,
    8: `<div class="grid grid-cols-2 gap-y-0.5 gap-x-1 ${wrapperClass}">
          <div class="bamboo-stick rotate-[15deg]"></div>
          <div class="bamboo-stick rotate-[-15deg]"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick rotate-[-15deg]"></div>
          <div class="bamboo-stick rotate-[15deg]"></div>
        </div>`,
    9: `<div class="grid grid-cols-3 gap-0.5 ${wrapperClass}">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
  };
  
  return patterns[value] || '';
}

/**
 * 渲染筒子圆点图案
 * @param {number} value - 牌值 (1-9)
 * @param {boolean} isSmall - 是否小尺寸
 * @returns {string} HTML 字符串
 */
function renderDotPattern(value, isSmall = false) {
  // 小尺寸用更紧凑的圆点
  const dotClass = isSmall ? 'dot-small' : 'dot';
  
  const patterns = {
    1: `<div class="${dotClass} bg-blue-700 ring-1 ring-blue-500 rounded-full"></div>`,
    2: `<div class="flex flex-col gap-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
    3: `<div class="flex flex-col gap-0.5 items-center">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
    4: `<div class="grid grid-cols-2 gap-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
    5: `<div class="grid grid-cols-2 gap-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-red-600 scale-110 z-10"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
    6: `<div class="grid grid-cols-2 gap-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
    7: `<div class="grid grid-cols-2 gap-x-0.5 gap-y-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700 col-span-2 mx-auto"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-red-600"></div>
        </div>`,
    8: `<div class="grid grid-cols-2 gap-x-0.5 gap-y-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
    9: `<div class="grid grid-cols-3 gap-0.5">
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-red-600"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
          <div class="${dotClass} bg-blue-700"></div>
        </div>`,
  };
  
  return patterns[value] || '';
}

/**
 * 渲染手牌区域
 * @param {Array} tiles - 手牌数组
 * @param {object|null} drawnTile - 刚摸到的牌
 * @param {object} options - 选项
 * @returns {string} HTML 字符串
 */
export function renderHand(tiles, drawnTile = null, options = {}) {
  const { onTileClick = null } = options;
  
  // 排序手牌：万 > 条 > 筒 > 风 > 箭
  const suitOrder = { wan: 0, tiao: 1, tong: 2, feng: 3, jian: 4, dragon: 4 };
  const sortedTiles = [...tiles].sort((a, b) => {
    const suitA = suitOrder[a.suit] ?? 5;
    const suitB = suitOrder[b.suit] ?? 5;
    if (suitA !== suitB) return suitA - suitB;
    return a.value - b.value;
  });
  
  let html = '';
  
  // 渲染手牌（不含摸到的牌）
  sortedTiles.forEach((tile, index) => {
    if (drawnTile && tile.id === drawnTile.id) return; // 跳过摸到的牌，单独渲染
    const clickHandler = onTileClick ? `window.handleTileClick('${tile.id}')` : '';
    html += renderTile(tile, { onClick: clickHandler });
  });
  
  // 如果有刚摸到的牌，单独渲染（高亮显示）
  if (drawnTile) {
    html += '<div class="w-2 sm:w-4"></div>'; // 间隔
    const clickHandler = onTileClick ? `window.handleTileClick('${drawnTile.id}')` : '';
    html += renderTile(drawnTile, { highlight: true, onClick: clickHandler });
  }
  
  return html;
}

/**
 * 渲染弃牌区（其他玩家的弃牌）
 * @param {Array} tiles - 弃牌数组
 * @param {string} position - 位置 'north' | 'west' | 'east'
 * @returns {string} HTML 字符串
 */
export function renderDiscardPile(tiles, position) {
  const isVertical = position === 'west' || position === 'east';
  const wrapperClass = isVertical 
    ? 'flex flex-col gap-1' 
    : 'flex gap-1';
  
  let html = `<div class="${wrapperClass}">`;
  
  tiles.forEach(tile => {
    if (isVertical) {
      html += `
        <div class="w-9 h-6 bg-gray-200 rounded-sm ${position === 'west' ? 'border-r-4' : 'border-l-4'} border-gray-400 shadow-md"></div>
      `;
    } else {
      html += `
        <div class="w-6 h-9 sm:w-8 sm:h-12 bg-gray-200 rounded-sm border-b-4 border-gray-400 shadow-md"></div>
      `;
    }
  });
  
  html += '</div>';
  return html;
}

/**
 * 渲染副露（吃碰杠的组合）
 * @param {object} meld - 副露对象 {type, tiles}
 * @param {string} position - 位置 'north' | 'west' | 'east' | 'south'
 * @returns {string} HTML 字符串
 */
export function renderMeld(meld, position = 'north') {
  const { type, tiles } = meld;
  
  let html = '<div class="flex gap-0.5 items-end">';
  
  tiles.forEach((tile, index) => {
    const tileHtml = renderTile(tile, { size: 'small', position });
    html += tileHtml;
  });
  
  html += '</div>';
  return html;
}

/**
 * 渲染操作按钮
 * @param {object} options - 选项 {canDraw, canChi, canPeng, canGang, canHu, canPass}
 * @returns {string} HTML 字符串
 */
export function renderActionButtons(options = {}) {
  const { canDraw = false, canChi = false, canPeng = false, canGang = false, canHu = false, canPass = false } = options;
  
  const buttonConfig = [
    { action: 'draw', label: '摸', color: 'yellow', enabled: canDraw },
    { action: 'chi', label: '吃', color: 'blue', enabled: canChi },
    { action: 'peng', label: '碰', color: 'green', enabled: canPeng },
    { action: 'gang', label: '杠', color: 'purple', enabled: canGang },
    { action: 'hu', label: '胡', color: 'red', enabled: canHu },
    { action: 'pass', label: '过', color: 'gray', enabled: canPass },
  ];
  
  // 过滤只显示可用的按钮
  const enabledButtons = buttonConfig.filter(config => config.enabled);
  
  // 如果没有可用按钮，不显示
  if (enabledButtons.length === 0) {
    return '<div class="flex justify-center gap-3 mb-4 sm:mb-8" id="action-buttons"></div>';
  }
  
  let html = '<div class="flex justify-center gap-3 mb-4 sm:mb-8" id="action-buttons">';
  
  enabledButtons.forEach(config => {
    const { action, label, color } = config;
    
    // 所有按钮默认大小一样
    const sizeClass = 'w-14 h-14 sm:w-20 sm:h-20 text-lg sm:text-xl';
    
    html += `
      <button class="${sizeClass} rounded-full bg-${color}-600 text-white font-bold border-4 border-${color}-400 shadow-lg transition-all hover:scale-125 hover:animate-bounce active:scale-95"
              onclick="window.handleAction('${action}')">
        ${label}
      </button>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * 渲染倒扣的牌（其他玩家手牌背面）
 * @param {number} count - 牌数量
 * @param {string} position - 位置 'north' | 'west' | 'east'
 * @returns {string} HTML 字符串
 */
export function renderHiddenHand(count, position) {
  // 按原UI设计稿：
  // - 北边：竖牌 w-6 h-9 sm:w-8 sm:h-12
  // - 西/东：横牌 w-9 h-6 sm:w-12 sm:h-8
  const isVertical = position === 'north';
  
  let html = '';
  
  for (let i = 0; i < count; i++) {
    if (isVertical) {
      // 竖牌（北边）
      html += `<div class="w-6 h-9 sm:w-8 sm:h-12 bg-gray-200 rounded-sm border-b-4 border-gray-400 shadow-md"></div>`;
    } else {
      // 横牌（西/东）
      html += `<div class="w-9 h-6 sm:w-12 sm:h-8 bg-gray-200 rounded-sm ${position === 'west' ? 'border-r-4' : 'border-l-4'} border-gray-400 shadow-md"></div>`;
    }
  }
  
  return html;
}

// 导出 CSS 样式（用于竹节和圆点）
export const tileStyles = `
/* 竹节样式 - 正常尺寸 */
.bamboo-stick {
  width: 2px;
  height: 8px;
  background: #15803d;
  border-radius: 1px;
}
@media (min-width: 640px) {
  .bamboo-stick {
    width: 4px;
    height: 12px;
  }
}

/* 圆点样式 - 正常尺寸 */
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
@media (min-width: 640px) {
  .dot {
    width: 10px;
    height: 10px;
  }
}

/* 圆点样式 - 小尺寸 */
.dot-small {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}
@media (min-width: 640px) {
  .dot-small {
    width: 6px;
    height: 6px;
  }
}

/* 最后打出牌的闪烁动画 */
@keyframes pulse-last-discard {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7), 0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    box-shadow: 0 0 8px 4px rgba(245, 158, 11, 0.6), 0 0 16px 8px rgba(245, 158, 11, 0.3);
  }
}
.animate-pulse-last-discard {
  animation: pulse-last-discard 1.5s ease-in-out infinite;
}

/* 当前玩家头像闪动动画 */
@keyframes pulse-avatar {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 10px 3px rgba(245, 158, 11, 0.6);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 25px 8px rgba(245, 158, 11, 0.9);
  }
}
.animate-pulse-avatar {
  animation: pulse-avatar 1s ease-in-out infinite;
}
`;

export default {
  renderTile,
  renderHand,
  renderDiscardPile,
  renderMeld,
  renderActionButtons,
  renderHiddenHand,
  tileStyles,
};
