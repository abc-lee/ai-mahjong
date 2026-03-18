import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocket, getRoomManager, getIO, toClientRoom } from './socket/index';
import { LLMClient, LLMConfig } from './llm/LLMClient';
import { promptLoader } from './prompt/PromptLoader';

// 启动时加载保存的语言设置
try {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(process.cwd(), 'llm-config.json');
  if (fs.existsSync(configPath)) {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (data.language) {
      promptLoader.setLanguage(data.language);
    }
  }
} catch (e) {
  // 忽略错误，使用默认语言
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取等待中的房间列表
app.get('/api/rooms', (req, res) => {
  const roomManager = getRoomManager();
  if (!roomManager) {
    res.json({ rooms: [] });
    return;
  }
  
  const rooms = roomManager.getRooms()
    .filter(r => r.state === 'waiting')
    .map(r => ({
      id: r.id,
      name: r.name,
      host: r.host,
      playerCount: r.players.length,
      players: r.players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        type: p.type,
        isReady: p.isReady,
      })),
    }));
  
  res.json({ rooms });
});

// LLM connection test
app.post('/api/llm/test', async (req, res) => {
  try {
    const { type, apiBase, model, apiKey } = req.body;
    
    if (!apiBase || !model) {
      res.json({ success: false, error: 'Missing required fields' });
      return;
    }
    
    const client = new LLMClient({
      provider: type || 'openai',
      type: type || 'openai',
      apiBase,
      model,
      apiKey: apiKey || 'test'
    } as LLMConfig);
    
    // Simple test - send a minimal request
    const result = await client.chat('Say "ok" in one word.');
    res.json({ success: true, response: result });
  } catch (e: any) {
    console.error('[LLM Test] Error:', e.message);
    res.json({ success: false, error: e.message });
  }
});

// AI name generation - 从配置文件读取LLM配置
app.post('/api/ai/generate-name', async (req, res) => {
  try {
    const { gender, personality } = req.body;
    
    // 从配置文件读取LLM配置
    let llmConfig = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'llm-config.json');
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        llmConfig = configData.llm;
      }
    } catch (e) {
      console.error('[AI Name] Failed to read config file:', e);
    }
    
    if (!llmConfig || !llmConfig.apiKey) {
      // 无LLM配置或无API Key，使用fallback
      const fallbackMale = ['阿杰', '大伟', '小刚', '明轩', '天宇', '浩然'];
      const fallbackFemale = ['小雪', '美琪', '晓琳', '思雨', '婉儿', '紫萱'];
      const fallbackOther = ['小宝', '阿福', '乐乐', '天天', '星星', '月月'];
      
      let names = fallbackOther;
      if (gender === 'male') names = fallbackMale;
      else if (gender === 'female') names = fallbackFemale;
      
      return res.json({ success: true, name: names[Math.floor(Math.random() * names.length)] });
    }
    
    const client = new LLMClient({
      provider: llmConfig.type || 'openai',
      ...llmConfig
    } as LLMConfig);
    
    const genderText = gender === 'male' ? '男性' : gender === 'female' ? '女性' : '中性';
    const personalityText = {
      chatty: '话痨型',
      sarcastic: '毒舌型',
      tsundere: '傲娇型',
      lucky: '幸运型',
      serious: '认真型',
      dramatic: '戏精型',
    }[personality] || '普通';
    
    const prompt = `${genderText}麻将AI，${personalityText}性格。起一个2-4字中文名。只输出名字。`;

    const name = await client.chat(prompt);
    console.log('[AI Name] LLM raw response:', name);
    
    // 解析响应 - 提取中文名字
    let cleanName = '';
    let responseText = name || '';
    
    // 去掉思考链 (MiniMax 格式)
    const thinkEnd = responseText.lastIndexOf('CLE>');
    if (thinkEnd >= 0) {
      responseText = responseText.substring(thinkEnd + 5).trim();
    }
    
    // 提取中文名字 (2-4个字)
    const chineseMatches = responseText.match(/[\u4e00-\u9fa5]{2,4}/g);
    if (chineseMatches && chineseMatches.length > 0) {
      cleanName = chineseMatches[chineseMatches.length - 1];
    }
    
    // 清理
    cleanName = cleanName.trim().substring(0, 4);
    
    console.log('[AI Name] Cleaned name:', cleanName);
    res.json({ success: true, name: cleanName || '小宝' });
  } catch (e: any) {
    console.error('[AI Name] Error:', e.message);
    // Fallback names by gender
    const gender = req.body.gender;
    const fallbackMale = ['阿杰', '大伟', '小刚', '明轩', '天宇', '浩然'];
    const fallbackFemale = ['小雪', '美琪', '晓琳', '思雨', '婉儿', '紫萱'];
    const fallbackOther = ['小宝', '阿福', '乐乐', '天天', '星星', '月月'];
    
    let names = fallbackOther;
    if (gender === 'male') names = fallbackMale;
    else if (gender === 'female') names = fallbackFemale;
    
    res.json({ success: true, name: names[Math.floor(Math.random() * names.length)] });
  }
});

// Config sync
app.post('/api/config', (req, res) => {
  const { llm, players, language } = req.body;
  
  // Store in global
  (global as any).gameConfig = { llm, players };
  
  // 更新语言设置
  if (language) {
    promptLoader.setLanguage(language);
  }
  
  // Persist to config file
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'llm-config.json');
    
    // 读取现有配置，合并新配置
    let existingData: any = {};
    if (fs.existsSync(configPath)) {
      existingData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    // 只更新传入的字段
    const configData = {
      ...existingData,
      ...(llm !== undefined && { llm }),
      ...(players !== undefined && { players }),
      ...(language !== undefined && { language }),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    console.log('[Config] Saved to file:', { llm: llm?.name, players, language });
  } catch (e) {
    console.error('[Config] Failed to save file:', e);
  }
  
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'llm-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data);
      // 添加可用语言列表
      config.availableLanguages = promptLoader.getAvailableLanguages();
      config.currentLanguage = promptLoader.getLanguage();
      res.json(config);
    } else {
      res.json({ 
        availableLanguages: promptLoader.getAvailableLanguages(),
        currentLanguage: promptLoader.getLanguage()
      });
    }
  } catch (e) {
    res.json((global as any).gameConfig || {});
  }
});

// 添加 AI/NPC 玩家到房间
app.post('/api/room/add-player', async (req, res) => {
  try {
    const { roomId, name, personality, type } = req.body;
    const playerType = type || 'npc';  // 默认 NPC
    
    if (!roomId) {
      res.json({ success: false, error: '缺少 roomId' });
      return;
    }
    
    const roomManager = getRoomManager();
    if (!roomManager) {
      res.json({ success: false, error: '服务器未初始化' });
      return;
    }
    
    const room = roomManager.getRoom(roomId);
    if (!room) {
      res.json({ success: false, error: '房间不存在' });
      return;
    }
    
    if (room.players.length >= 4) {
      res.json({ success: false, error: '房间已满' });
      return;
    }
    
    // 读取 LLM 配置
    let llmConfig = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'llm-config.json');
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        llmConfig = configData.llm;
      }
    } catch (e) {
      console.error('[API] 读取 LLM 配置失败:', e);
    }
    
    // 构建 AI 配置
    const aiConfig = {
      personality: personality || 'balanced',
      llmEnabled: playerType === 'ai-agent' && !!llmConfig?.apiKey,
      llmProviderType: llmConfig?.type || 'openai',  // openai 或 anthropic
      llmEndpoint: llmConfig?.apiBase ? 
        (llmConfig.type === 'anthropic' ? 
          `${llmConfig.apiBase}/v1/messages` : 
          `${llmConfig.apiBase}/chat/completions`) 
        : undefined,
      llmApiKey: llmConfig?.apiKey,
      llmModel: llmConfig?.model,
      timeout: 10000,
      thinkTimeMin: 500,
      thinkTimeMax: 2000,
      maxRetries: 3,
    };
    
    // 添加玩家
    const newPlayer = roomManager.addAIPlayer(roomId, {
      agentId: `${playerType}-${Date.now()}`,
      name: name || `${playerType.toUpperCase()}${room.players.length}`,
      personality: personality || 'balanced',
      type: playerType,
      aiConfig,  // 传入 AI 配置
    });
    
    console.log(`[API] 添加 ${playerType}: ${newPlayer.name} (llmEnabled: ${aiConfig.llmEnabled}) 到房间 ${roomId}`);
    
    // 广播房间更新
    const io = getIO();
    if (io) {
      io.in(roomId).emit('room:updated', { room: toClientRoom(room) });
    }
    
    res.json({ success: true, player: { id: newPlayer.id, name: newPlayer.name, position: newPlayer.position, type: playerType, llmEnabled: aiConfig.llmEnabled } });
  } catch (e: any) {
    console.error('[API] 添加玩家失败:', e);
    res.json({ success: false, error: e.message });
  }
});

// Setup Socket.io
setupSocket(io);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mahjong server running on port ${PORT}`);
});
