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

// 风牌英文
const WIND_ENGLISH = ['EAST', 'SOUTH', 'WEST', 'NORTH'];
const DRAGON_ENGLISH = ['ZHONG', 'FA', 'BAI'];

/**
 * 渲染单张麻将牌
 * @param {object} tile - 牌对象 {id, suit, value, display}
 * @param {object} options - 选项 {highlight, onClick, size}
 * @returns {string} HTML 字符串
 */
export function renderTile(tile, options = {}) {
  const { highlight = false, onClick = null, size = 'normal' } = options;
  const { suit, value, id } = tile;
  
  const isSmall = size === 'small';
  const sizeClass = isSmall ? 'w-6 h-8' : 'w-10 h-14 sm:w-14 sm:h-20';
  const highlightClass = highlight ? 'bg-white border-b-4 border-gray-300 ring-2 ring-amber-400' : 'bg-white border-b-4 sm:border-b-8 border-gray-300';
  const clickAttr = onClick ? `onclick="${onClick}"` : '';
  
  let content = '';
  
  if (isSmall) {
    // 小尺寸：简化的内容
    switch (suit) {
      case 'wan':
        content = `
          <span class="text-[6px] font-bold border border-black px-px">萬</span>
          <span class="text-[10px] font-bold text-red-600">${TILE_NAMES.wan[value - 1]}</span>
        `;
        break;
      case 'tiao':
        if (value === 1) {
          content = `<span class="iconify text-xs text-green-700" data-icon="material-symbols:nature-rounded"></span>`;
        } else {
          // 条子小尺寸用汉字数字
          content = `<span class="text-[10px] font-bold text-green-700">${TILE_NAMES.tiao[value - 1]}</span>`;
        }
        break;
      case 'tong':
        // 筒子小尺寸用汉字
        content = `<span class="text-[10px] font-bold text-blue-700">${TILE_NAMES.tong[value - 1]}</span>`;
        break;
      case 'feng':
        content = `<span class="text-[10px] font-bold text-gray-800">${['東', '南', '西', '北'][value - 1]}</span>`;
        break;
      case 'jian':
      case 'dragon':
        const colors = ['text-red-600', 'text-green-700', 'text-blue-600'];
        const chars = ['中', '發', '白'];
        content = `<span class="text-[10px] font-bold ${colors[value - 1]}">${chars[value - 1]}</span>`;
        break;
    }
  } else {
    // 正常尺寸
    switch (suit) {
      case 'wan':
        content = `
          <span class="text-sm sm:text-xl font-bold border border-black px-0.5 mb-0.5">萬</span>
          <span class="text-base sm:text-2xl font-bold text-red-600">${TILE_NAMES.wan[value - 1]}</span>
        `;
        break;
        
      case 'tiao':
        if (value === 1) {
          content = `
            <span class="iconify text-lg sm:text-3xl text-green-700" data-icon="material-symbols:nature-rounded"></span>
            <span class="text-[8px] sm:text-[10px] text-green-700 mt-0.5">一条</span>
          `;
        } else {
          content = renderBambooPattern(value);
        }
        break;
        
      case 'tong':
        content = renderDotPattern(value);
        break;
        
      case 'feng':
        content = `
          <span class="text-xl sm:text-2xl font-bold text-gray-800">${['東', '南', '西', '北'][value - 1]}</span>
          <span class="text-[6px] sm:text-[8px] text-gray-400 mt-0.5">${WIND_ENGLISH[value - 1]}</span>
        `;
        break;
        
      case 'jian':
      case 'dragon':
        if (value === 1) {
          content = `
            <span class="text-xl sm:text-2xl font-bold text-red-600">中</span>
            <span class="text-[6px] sm:text-[8px] text-red-400 opacity-50 mt-0.5">ZHONG</span>
          `;
        } else if (value === 2) {
          content = `
            <span class="text-xl sm:text-2xl font-bold text-green-700">發</span>
            <span class="text-[6px] sm:text-[8px] text-green-400 opacity-50 mt-0.5">FA</span>
          `;
        } else {
          content = `
            <div class="w-6 h-8 sm:w-10 sm:h-14 border-2 border-blue-200 rounded-sm"></div>
            <span class="text-[6px] sm:text-[8px] text-blue-300 mt-1">BAI</span>
          `;
        }
        break;
    }
  }
  
  return `
    <div class="tile ${sizeClass} ${highlightClass} rounded-md flex flex-col items-center justify-center p-1 ${isSmall ? '' : 'sm:p-2'} shadow-md hover:shadow-lg transition-shadow" 
         data-tile-id="${id}" 
         data-suit="${suit}" 
         data-value="${value}"
         ${clickAttr}>
      ${content}
    </div>
  `;
}

/**
 * 渲染条子竹节图案
 * @param {number} value - 牌值 (2-9)
 * @returns {string} HTML 字符串
 */
function renderBambooPattern(value) {
  const patterns = {
    2: `<div class="flex flex-col gap-0.5 sm:gap-1">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    3: `<div class="flex flex-col gap-0.5 sm:gap-1">
          <div class="bamboo-stick"></div>
          <div class="flex gap-0.5 sm:gap-1">
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
          </div>
        </div>`,
    4: `<div class="grid grid-cols-2 gap-0.5 sm:gap-1 px-1">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    5: `<div class="grid grid-cols-2 gap-0.5 sm:gap-1">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick col-span-2 mx-auto"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    6: `<div class="grid grid-cols-2 gap-y-0.5 sm:gap-y-1 gap-x-1 sm:gap-x-2">
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
        </div>`,
    7: `<div class="flex flex-col gap-0.5 sm:gap-1">
          <div class="bamboo-stick mx-auto"></div>
          <div class="grid grid-cols-3 gap-0.5 sm:gap-1">
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
            <div class="bamboo-stick"></div>
          </div>
        </div>`,
    8: `<div class="grid grid-cols-2 gap-y-0.5 sm:gap-y-1 gap-x-1 sm:gap-x-2">
          <div class="bamboo-stick rotate-[15deg]"></div>
          <div class="bamboo-stick rotate-[-15deg]"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick"></div>
          <div class="bamboo-stick rotate-[-15deg]"></div>
          <div class="bamboo-stick rotate-[15deg]"></div>
        </div>`,
    9: `<div class="grid grid-cols-3 gap-0.5 sm:gap-1">
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
 * @returns {string} HTML 字符串
 */
function renderDotPattern(value) {
  const patterns = {
    1: `<div class="dot w-4 h-4 sm:w-7 sm:h-7 bg-blue-700 ring-1 sm:ring-2 ring-blue-500 rounded-full"></div>`,
    2: `<div class="flex flex-col gap-1 sm:gap-2">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
        </div>`,
    3: `<div class="flex flex-col gap-0.5 sm:gap-1 items-center">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
        </div>`,
    4: `<div class="grid grid-cols-2 gap-1 sm:gap-2">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
        </div>`,
    5: `<div class="grid grid-cols-2 gap-1 sm:gap-2">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-red-600 scale-110 sm:scale-125 z-10"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
        </div>`,
    6: `<div class="grid grid-cols-2 gap-1 sm:gap-2">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
        </div>`,
    7: `<div class="grid grid-cols-2 gap-x-1 sm:gap-x-2 gap-y-0.5 sm:gap-y-1">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700 col-span-2 mx-auto"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-red-600"></div>
        </div>`,
    8: `<div class="grid grid-cols-2 gap-x-1 sm:gap-x-2 gap-y-0.5 sm:gap-y-1">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
        </div>`,
    9: `<div class="grid grid-cols-3 gap-0.5 sm:gap-1">
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-red-600"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
          <div class="dot bg-blue-700"></div>
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
 * @returns {string} HTML 字符串
 */
export function renderMeld(meld) {
  const { type, tiles } = meld;
  
  let html = '<div class="flex gap-0.5 items-end">';
  
  tiles.forEach((tile, index) => {
    // 杠牌时第四张横放
    const isHorizontal = type === 'gang' && index === 3;
    const tileHtml = renderTile(tile, { size: 'small' });
    
    if (isHorizontal) {
      html += `<div class="transform -rotate-90 origin-center -ml-2 -mr-2">${tileHtml}</div>`;
    } else {
      html += tileHtml;
    }
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
 * @param {string} position - 位置
 * @returns {string} HTML 字符串
 */
export function renderHiddenHand(count, position) {
  const isVertical = position === 'west' || position === 'east';
  
  let html = '';
  
  for (let i = 0; i < count; i++) {
    if (isVertical) {
      // 竖着的牌（左右玩家）- 宽度小于高度
      html += `<div class="w-7 h-5 bg-gradient-to-b from-teal-100 to-teal-200 rounded-sm shadow-md border border-teal-300"></div>`;
    } else {
      // 横着的牌（上下玩家）- 高度大于宽度
      html += `<div class="w-5 h-7 bg-gradient-to-b from-teal-100 to-teal-200 rounded-sm shadow-md border border-teal-300"></div>`;
    }
  }
  
  return html;
}

// 导出 CSS 样式（用于竹节和圆点）
export const tileStyles = `
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
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
@media (min-width: 640px) {
  .dot {
    width: 12px;
    height: 12px;
  }
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
