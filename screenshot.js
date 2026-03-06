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
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // 等待页面完全渲染
    
    await page.screenshot({ path: 'game-ui.png', fullPage: true });
    console.log('截图已保存到 game-ui.png');
  } catch (error) {
    console.error('错误:', error.message);
  }
  
  await browser.close();
})();
