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
    // 监听 console 消息
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // 1. 访问大厅页面
    console.log('导航到大厅页面...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'game-ui-1-lobby.png' });
    console.log('✓ 大厅截图已保存');
    
    // 2. 点击"创建房间"按钮
    console.log('点击创建房间按钮...');
    await page.click('button:has-text("创建房间")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'game-ui-2-modal.png' });
    console.log('✓ 创建房间对话框截图已保存');
    
    // 3. 输入玩家名称并按回车提交
    console.log('输入玩家名称...');
    await page.fill('input#playerName', '测试玩家');
    await page.waitForTimeout(500);
    // 按回车提交表单
    await page.press('input#playerName', 'Enter');
    console.log('提交表单...');
    
    // 等待页面跳转
    await page.waitForTimeout(3000);
    console.log('当前URL:', await page.url());
    await page.screenshot({ path: 'game-ui-3-room.png' });
    console.log('✓ 房间截图已保存');
    
    // 4. 查找并点击准备按钮（使用更宽松的选择器）
    console.log('查找准备按钮...');
    const readyButton = await page.locator('button').filter({ hasText: /准备|取消准备/ }).first();
    if (await readyButton.isVisible().catch(() => false)) {
      console.log('点击准备按钮...');
      await readyButton.click();
    } else {
      console.log('未找到准备按钮，尝试截图查看当前状态...');
    }
    
    await page.waitForTimeout(3000);
    console.log('当前URL:', await page.url());
    await page.screenshot({ path: 'game-ui-4-gameplay.png' });
    console.log('✓ 游戏界面截图已保存');
    
    // 5. 等待游戏进行
    await page.waitForTimeout(15000);
    await page.screenshot({ path: 'game-ui-5-playing.png' });
    console.log('✓ 游戏进行中截图已保存');
    
  } catch (error) {
    console.error('错误:', error.message);
    await page.screenshot({ path: 'game-ui-error.png' });
  }
  
  await browser.close();
})();
