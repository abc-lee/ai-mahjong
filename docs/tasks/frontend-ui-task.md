# 前端 UI 样式需求 - 开发任务书

## 设计风格

**中国像素风**

- 复古游戏感
- 暖色调为主
- 简约但有特色

---

## 1. 配色方案

```css
:root {
  /* 主色 */
  --color-primary: #C44536;     /* 中国红 */
  --color-secondary: #F5E6D3;   /* 米白 */
  --color-accent: #D4A574;      /* 金黄 */
  
  /* 背景色 */
  --bg-dark: #1A1A2E;           /* 深蓝黑 */
  --bg-medium: #16213E;         /* 中蓝 */
  --bg-light: #0F3460;          /* 浅蓝 */
  
  /* 牌面色 */
  --tile-bg: #F5E6D3;           /* 牌底色（米白） */
  --tile-border: #8B4513;       /* 牌边框（棕色） */
  --tile-wan: #C44536;          /* 万字色 */
  --tile-tiao: #2E8B57;         /* 条子色 */
  --tile-tong: #4169E1;         /* 筒子色 */
  --tile-feng: #8B008B;         /* 风牌色 */
  --tile-jian: #FF6347;         /* 箭牌色 */
  
  /* 文字色 */
  --text-primary: #F5E6D3;
  --text-secondary: #A0A0A0;
  --text-highlight: #FFD700;
  
  /* 状态色 */
  --success: #4CAF50;
  --warning: #FFC107;
  --error: #F44336;
}
```

---

## 2. 牌面设计

### 2.1 尺寸规格

| 规格 | 尺寸 | 用途 |
|------|------|------|
| large | 48×64 px | 手牌、主要展示 |
| medium | 36×48 px | 副露区、牌河 |
| small | 24×32 px | 弃牌区缩略 |

### 2.2 像素风格

- 每张牌是 16×16 或 32×32 像素图放大
- 边缘有像素锯齿感
- 字体用像素字体

### 2.3 牌面元素

```
┌────────────────┐
│                │
│    一 万       │  ← 数字 + 花色
│                │
│    🀇          │  ← 可选：图案
│                │
└────────────────┘
```

### 2.4 各花色样式

| 花色 | 背景色 | 字/图案色 | 图案 |
|------|--------|-----------|------|
| 万 | 白底 | 红色 | 汉字"一~九万" |
| 条 | 白底 | 绿色 | 竹节图案 |
| 筒 | 白底 | 蓝色 | 圆圈图案 |
| 风 | 白底 | 紫色 | 东南西北汉字 |
| 箭 | 白底 | 红色 | 中发白汉字 |

---

## 3. 牌桌布局

### 3.1 桌面背景

```css
.table {
  background: linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%);
  border: 8px solid #8B4513;
  border-radius: 16px;
  box-shadow: inset 0 0 100px rgba(0, 0, 0, 0.5);
}
```

### 3.2 玩家座位布局

```
        [北家]
      ↗        ↖
[西家]   牌河   [东家]
      ↘        ↙
        [南家]
         你
```

### 3.3 响应式断点

| 断点 | 布局调整 |
|------|----------|
| > 1200px | 标准布局 |
| 768-1200px | 压缩间距 |
| < 768px | 单列布局 |

---

## 4. 玩家座位样式

### 4.1 座位容器

```css
.player-seat {
  /* 当前玩家高亮 */
  &.current {
    border: 2px solid var(--color-accent);
    animation: pulse 1.5s infinite;
  }
  
  /* 不同位置 */
  &.bottom { transform: rotate(0deg); }
  &.right { transform: rotate(90deg); }
  &.top { transform: rotate(180deg); }
  &.left { transform: rotate(-90deg); }
}
```

### 4.2 玩家信息

```css
.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--color-accent);
  }
  
  .name {
    font-size: 14px;
    color: var(--text-primary);
  }
  
  .score {
    font-size: 12px;
    color: var(--color-accent);
  }
}
```

---

## 5. 按钮样式

### 5.1 操作按钮

```css
.action-btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-family: 'PixelFont', monospace;
  font-size: 16px;
  transition: all 0.2s;
  
  &.enabled {
    background: var(--color-primary);
    color: white;
    cursor: pointer;
    
    &:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(196, 69, 54, 0.4);
    }
  }
  
  &.disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
  }
}
```

### 5.2 按钮颜色

| 按钮 | 颜色 | 说明 |
|------|------|------|
| 吃 | 绿色 | --color-success |
| 碰 | 蓝色 | --bg-light |
| 杠 | 紫色 | --tile-feng |
| 胡 | 红色 | --color-primary |
| 跳过 | 灰色 | #666 |

---

## 6. 聊天样式

### 6.1 对话气泡

```css
.chat-bubble {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 8px 12px;
  max-width: 200px;
  font-size: 14px;
  
  /* 小箭头指向玩家 */
  &::after {
    content: '';
    border: 8px solid transparent;
    border-top-color: white;
    position: absolute;
    bottom: -16px;
  }
  
  /* 动画 */
  animation: fadeIn 0.3s ease-out;
}
```

### 6.2 聊天面板

```css
.chat-panel {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 12px;
  
  .message-list {
    max-height: 200px;
    overflow-y: auto;
    
    /* 隐藏滚动条 */
    &::-webkit-scrollbar {
      display: none;
    }
  }
  
  .message {
    margin-bottom: 8px;
    
    .player-name {
      color: var(--color-accent);
      font-weight: bold;
    }
    
    .text {
      color: var(--text-primary);
    }
  }
}
```

---

## 7. 惩罚动画

### 7.1 输家变形动画

```css
.loser-animation {
  /* 等级1：冒烟 */
  &.level-1 {
    animation: shake 0.5s ease-out;
    filter: grayscale(0.3);
  }
  
  /* 等级2：绷带 */
  &.level-2 {
    animation: shake 0.5s ease-out;
    filter: grayscale(0.5);
    
    &::after {
      content: '🩹';
      position: absolute;
    }
  }
  
  /* 等级3：猪头 */
  &.level-3 {
    animation: transform 1s ease-out;
    
    .avatar {
      content: url('pig-head.png');
    }
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

### 7.2 KO 文字

```css
.ko-text {
  font-size: 64px;
  font-family: 'PixelFont', monospace;
  color: var(--color-primary);
  text-shadow: 
    2px 2px 0 #000,
    -2px -2px 0 #000;
  animation: zoomIn 0.5s ease-out;
}
```

---

## 8. 音效反馈（可选）

### 8.1 音效列表

| 事件 | 文件 | 说明 |
|------|------|------|
| 摸牌 | draw.mp3 | 短促的"啪"声 |
| 打牌 | discard.mp3 | "啪"声 |
| 吃 | chi.mp3 | "吃"音效 |
| 碰 | peng.mp3 | "碰"音效 |
| 杠 | gang.mp3 | "杠"音效 |
| 胡 | hu.mp3 | 欢快的音乐 |
| 按钮点击 | click.mp3 | 短促的点击声 |

---

## 9. 图标和装饰

### 9.1 像素风图标

| 图标 | 用途 |
|------|------|
| 🀄 | 游戏Logo |
| 🏠 | 返回大厅 |
| ⚙️ | 设置 |
| 🎤 | 语音输入 |
| 📷 | 截图 |
| 🏆 | 胜利 |

### 9.2 装饰元素

- 桌面四角：中式花纹
- 边框：云纹/祥云
- 背景：若隐若现的山水画

---

## 10. 字体

```css
@font-face {
  font-family: 'PixelFont';
  src: url('/fonts/pixel.woff2') format('woff2');
}

body {
  font-family: 'PixelFont', -apple-system, sans-serif;
}

/* 大标题 */
.title {
  font-size: 24px;
  letter-spacing: 2px;
}

/* 正文 */
.body {
  font-size: 14px;
  line-height: 1.5;
}
```

---

## 11. 加载状态

```css
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--text-secondary);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 12. 主题切换（可选）

可支持深色/浅色主题切换：

```typescript
interface Theme {
  name: 'dark' | 'light';
  colors: typeof darkColors | typeof lightColors;
}
```

---

## 资源清单

### 需要准备的素材

| 类型 | 数量 | 说明 |
|------|------|------|
| 牌面图片 | 34 张 | 每种牌一张像素图 |
| 牌背面 | 1 张 | 统一的花纹 |
| 头像 | 6+ 张 | AI 角色头像 |
| 猪头头像 | 1 张 | 惩罚用 |
| 背景图 | 1-2 张 | 牌桌背景 |
| 图标 | 10+ | 各种功能图标 |
| 音效 | 6+ | 游戏音效 |
