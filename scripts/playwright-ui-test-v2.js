/**
 * Playwright UI 测试脚本 - 改进版
 * 更稳定的流程控制
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
      await new Promise(r => setTimeout(r, 800));
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
    slowMo: 200
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  try {
    // 1. 打开前端页面
    console.log('[Playwright] 访问前端页面...');
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(3000);
    
    // 截图 - 大厅页面
    await page.screenshot({ 
      path: SCREENSHOT_PATH.replace('.png', '-lobby.png'), 
      fullPage: true 
    });
    
    // 2. 输入玩家名称
    console.log('[Playwright] 输入玩家名称...');
    const nameInput = await page.locator('input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('测试玩家');
    await page.waitForTimeout(500);
    
    // 3. 点击"加入房间"按钮打开对话框
    console.log('[Playwright] 点击加入房间按钮...');
    const joinButton = await page.locator('button:has-text("加入房间")').first();
    await joinButton.click();
    await page.waitForTimeout(1000);
    
    // 4. 输入房间ID
    console.log('[Playwright] 输入房间ID:', roomId);
    const roomInput = await page.locator('input[placeholder*="房间"]').first();
    await roomInput.waitFor({ state: 'visible', timeout: 5000 });
    await roomInput.fill(roomId);
    await page.waitForTimeout(500);
    
    // 5. 点击确定加入
    const confirmButton = await page.locator('button:has-text("确定"), button:has-text("加入")').first();
    await confirmButton.click();
    console.log('[Playwright] 已点击确定按钮');
    
    // 6. 等待进入房间页面
    await page.waitForTimeout(3000);
    
    // 截图 - 房间页面
    await page.screenshot({ 
      path: SCREENSHOT_PATH.replace('.png', '-room.png'), 
      fullPage: true 
    });
    
    // 7. 查找并点击"准备"按钮
    console.log('[Playwright] 查找准备按钮...');
    const readyButton = await page.locator('button:has-text("准备")').first();
    await readyButton.waitFor({ state: 'visible', timeout: 10000 });
    await readyButton.click();
    console.log('[Playwright] 已点击准备按钮');
    
    // 8. 等待游戏开始（AI房主会自动开始游戏）
    console.log('[Playwright] 等待游戏开始...');
    await page.waitForTimeout(10000);
    
    // 9. 截图 - 游戏界面
    console.log('[Playwright] 截图保存到:', SCREENSHOT_PATH);
    await page.screenshot({ 
      path: SCREENSHOT_PATH, 
      fullPage: false 
    });
    
    // 等待几秒钟，可能游戏会有更多内容
    await page.waitForTimeout(3000);
    
    // 再次截图，确保捕获到完整游戏状态
    await page.screenshot({ 
      path: SCREENSHOT_PATH.replace('.png', '-final.png'), 
      fullPage: true 
    });
    
    console.log('[Playwright] 测试完成！');
    
    // 保持浏览器打开观察
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('[Playwright] 测试出错:', error);
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
