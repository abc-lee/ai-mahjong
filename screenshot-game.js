const { chromium } = require('playwright');
const { io } = require('socket.io-client');

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  // 先添加 3 个 AI 玩家到房间
  const aiAgents = [];
  const aiNames = ['紫璃', '白泽', '李瞳'];
  
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
    
    // 3. 输入玩家名称并提交表单
    console.log('输入玩家名称...');
    await page.fill('input#playerName', '测试玩家');
    await page.waitForTimeout(500);
    await page.press('input#playerName', 'Enter');
    console.log('提交表单...');
    
    // 等待页面跳转并获取房间ID
    await page.waitForTimeout(3000);
    const url = await page.url();
    const roomId = url.split('/room/')[1];
    console.log('当前URL:', url);
    console.log('房间ID:', roomId);
    await page.screenshot({ path: 'game-ui-3-room.png' });
    console.log('✓ 房间截图已保存');
    
    // 4. 通过 Socket.io 添加 AI 玩家
    console.log('添加 AI 玩家到房间...');
    
    for (let i = 0; i < 3; i++) {
      const aiSocket = io('http://localhost:3000');
      
      await new Promise((resolve, reject) => {
        aiSocket.on('connect', () => {
          console.log(`AI ${aiNames[i]} 已连接到服务器`);
          
          // 加入房间
          aiSocket.emit('room:joinAI', {
            roomId: roomId,
            agentId: `ai-${i}-${Date.now()}`,
            agentName: aiNames[i],
            type: 'ai-auto' // 使用自动托管模式
          }, (response) => {
            if (response.message) {
              console.error(`AI ${aiNames[i]} 加入失败:`, response.message);
              reject(new Error(response.message));
            } else {
              console.log(`AI ${aiNames[i]} 成功加入房间，位置:`, response.position);
              aiAgents.push(aiSocket);
              resolve(response);
            }
          });
        });
        
        setTimeout(() => reject(new Error('连接超时')), 10000);
      });
      
      await wait(500);
    }
    
    console.log('3 个 AI 玩家已添加');
    await wait(2000);
    await page.screenshot({ path: 'game-ui-4-room-with-ai.png' });
    console.log('✓ 房间（含AI）截图已保存');
    
    // 5. 检查并点击准备按钮（如果需要）
    console.log('检查准备状态...');
    const readyButton = await page.locator('button.ready-btn, button:has-text("准备")').first();
    const buttonText = await readyButton.textContent().catch(() => '');
    console.log('准备按钮文本:', buttonText);
    
    if (buttonText.includes('准备') && !buttonText.includes('取消')) {
      console.log('点击准备按钮...');
      await readyButton.click();
      await wait(1000);
    } else {
      console.log('玩家已准备或按钮不可用');
    }
    
    await wait(2000);
    await page.screenshot({ path: 'game-ui-5-ready.png' });
    console.log('✓ 准备后截图已保存');
    
    // 6. 点击开始游戏（房主可见）
    console.log('点击开始游戏...');
    const startButton = await page.locator('button.start-btn, button:has-text("开始游戏")').first();
    const isEnabled = await startButton.isEnabled().catch(() => false);
    console.log('开始游戏按钮状态:', isEnabled ? '启用' : '禁用');
    
    if (isEnabled) {
      await startButton.click();
      console.log('游戏开始！');
      await wait(5000);
    } else {
      console.log('开始游戏按钮未启用，等待几秒钟再试...');
      await wait(5000);
      
      // 再试一次
      const isEnabled2 = await startButton.isEnabled().catch(() => false);
      if (isEnabled2) {
        await startButton.click();
        console.log('游戏开始！');
        await wait(5000);
      } else {
        console.log('开始游戏按钮仍然未启用');
      }
    }
    
    // 7. 截图游戏界面
    await page.screenshot({ path: 'game-ui-6-gameplay.png' });
    console.log('✓ 游戏界面截图已保存');
    
    // 8. 等待游戏进行
    await wait(15000);
    await page.screenshot({ path: 'game-ui-7-playing.png' });
    console.log('✓ 游戏进行中截图已保存');
    
    // 9. 再等待一段时间看吃碰杠胡按钮
    await wait(15000);
    await page.screenshot({ path: 'game-ui-8-actions.png' });
    console.log('✓ 操作按钮截图已保存');
    
  } catch (error) {
    console.error('错误:', error.message);
    await page.screenshot({ path: 'game-ui-error.png' });
  }
  
  // 清理 AI 连接
  aiAgents.forEach(socket => socket.disconnect());
  
  await browser.close();
})();
