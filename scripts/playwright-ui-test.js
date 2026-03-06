/**
 * Playwright UI 测试脚本
 * 1. 创建测试房间
 * 2. 加入 AI 玩家
 * 3. 使用 Playwright 模拟人类玩家加入并截图
 */
const { io } = require('socket.io-client');
const { chromium } = require('playwright');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:5173';
const SCREENSHOT_PATH = path.join(__dirname, '../tmp/game-ui.png');

class TestSetup {
  constructor() {
    this.socket = null;
    this.roomId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL);
      
      this.socket.on('connect', () => {
        console.log('[Setup] 连接服务器成功');
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('[Setup] 连接失败:', err.message);
        reject(err);
      });
    });
  }

  async createRoom() {
    return new Promise((resolve) => {
      // 使用 AI 创建房间，这样房主是 AI，游戏会自动开始
      this.socket.emit('room:createAI', {
        agentId: 'ai-host-' + Date.now(),
        agentName: '紫璃',
        type: 'ai-auto'
      }, (res) => {
        if (res.roomId) {
          this.roomId = res.roomId;
          console.log('[Setup] 房间创建成功:', res.roomId);
          resolve(res.roomId);
        } else {
          console.error('[Setup] 创建房间失败:', res.message || res.error);
          resolve(null);
        }
      });
    });
  }

  async addAIPlayers() {
    const aiNames = ['白泽', '李瞳'];
    
    for (const name of aiNames) {
      await this.addAIPlayer(name);
      await new Promise(r => setTimeout(r, 500));
    }
  }

  async addAIPlayer(name) {
    return new Promise((resolve) => {
      const aiSocket = io(SERVER_URL);
      const agentId = 'ai-' + name + '-' + Date.now();
      
      aiSocket.on('connect', () => {
        aiSocket.emit('room:joinAI', {
          roomId: this.roomId,
          agentId: agentId,
          agentName: name,
          type: 'ai-auto'
        }, (res) => {
          console.log(`[Setup] AI ${name} 加入:`, res.success ? '成功' : res.error);
          resolve();
        });
      });
    });
  }

  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

async function runPlaywrightTest(roomId) {
  console.log('[Playwright] 启动浏览器...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  try {
    // 1. 打开前端页面
    console.log('[Playwright] 访问前端页面...');
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(2000);
    
    // 2. 输入玩家名称
    console.log('[Playwright] 输入玩家名称...');
    const nameInput = await page.locator('input[type="text"], input[placeholder*="名字"], input[placeholder*="名称"]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('测试玩家');
      await page.waitForTimeout(500);
    }
    
    // 3. 查找并点击"加入房间"按钮
    console.log('[Playwright] 查找加入房间入口...');
    
    // 尝试多种可能的按钮文本
    const possibleButtons = [
      '加入房间',
      '进入房间', 
      '加入',
      '进入',
      'Join Room',
      'JOIN'
    ];
    
    let joined = false;
    for (const text of possibleButtons) {
      const button = await page.locator(`button:has-text("${text}")`).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        joined = true;
        console.log(`[Playwright] 点击了 "${text}" 按钮`);
        break;
      }
    }
    
    if (!joined) {
      // 如果没有找到按钮，尝试查找输入房间ID的输入框
      const roomInput = await page.locator('input[placeholder*="房间"], input[placeholder*="Room"]').first();
      if (await roomInput.isVisible().catch(() => false)) {
        await roomInput.fill(roomId);
        await page.waitForTimeout(500);
        
        // 查找确认按钮
        const confirmBtn = await page.locator('button:has-text("确定"), button:has-text("确认"), button:has-text("加入")').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          joined = true;
        }
      }
    }
    
    if (!joined) {
      console.log('[Playwright] 未能找到加入房间按钮，尝试直接访问房间URL...');
      // 尝试直接访问带房间ID的URL
      await page.goto(`${FRONTEND_URL}/?room=${roomId}`);
      await page.waitForTimeout(2000);
    }
    
    // 4. 等待页面加载
    await page.waitForTimeout(3000);
    
    // 5. 查找并点击"准备"按钮
    console.log('[Playwright] 查找准备按钮...');
    const readyTexts = ['准备', 'Ready', 'READY', '点击准备'];
    
    for (const text of readyTexts) {
      const button = await page.locator(`button:has-text("${text}")`).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        console.log(`[Playwright] 点击了 "${text}" 按钮`);
        break;
      }
    }
    
    // 6. 等待游戏开始（等待较长时间让AI自动开始游戏）
    console.log('[Playwright] 等待游戏开始...');
    await page.waitForTimeout(8000);
    
    // 7. 截图
    console.log('[Playwright] 截图保存到:', SCREENSHOT_PATH);
    await page.screenshot({ 
      path: SCREENSHOT_PATH, 
      fullPage: false 
    });
    
    console.log('[Playwright] 测试完成！');
    
    // 保持浏览器打开一会儿以便观察
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('[Playwright] 测试出错:', error);
    // 出错时也截图
    await page.screenshot({ 
      path: SCREENSHOT_PATH.replace('.png', '-error.png'), 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
  
  return SCREENSHOT_PATH;
}

async function main() {
  console.log('=== Playwright UI 测试 ===\n');
  
  const setup = new TestSetup();
  
  try {
    // 1. 连接服务器
    await setup.connect();
    await new Promise(r => setTimeout(r, 1000));
    
    // 2. 创建房间
    const roomId = await setup.createRoom();
    if (!roomId) {
      console.error('创建房间失败，退出');
      process.exit(1);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 3. 添加 AI 玩家
    await setup.addAIPlayers();
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`\n房间ID: ${roomId}`);
    console.log('准备启动 Playwright 测试...\n');
    
    // 4. 运行 Playwright 测试
    await runPlaywrightTest(roomId);
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await setup.disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().then(() => {
    console.log('\n测试完成');
    process.exit(0);
  }).catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
  });
}

module.exports = { runPlaywrightTest };
