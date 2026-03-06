const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // 1. 访问大厅页面
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'game-ui-1-lobby.png' });
    console.log('✓ 大厅截图已保存');
    
    // 2. 点击"创建房间"按钮
    await page.click('button:has-text("创建房间")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'game-ui-2-modal.png' });
    console.log('✓ 创建房间对话框截图已保存');
    
    // 3. 输入玩家名称并创建
    await page.fill('input[placeholder="请输入名称..."]', '测试玩家');
    await page.click('button:has-text("创建")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'game-ui-3-room.png' });
    console.log('✓ 房间截图已保存');
    
    // 4. 点击"准备"按钮开始游戏
    await page.click('button:has-text("准备")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'game-ui-4-gameplay.png' });
    console.log('✓ 游戏界面截图已保存');
    
    // 5. 等待游戏进行一段时间
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'game-ui-5-playing.png' });
    console.log('✓ 游戏进行中截图已保存');
    
  } catch (error) {
    console.error('错误:', error.message);
    await page.screenshot({ path: 'game-ui-error.png' });
  }
  
  await browser.close();
})();
