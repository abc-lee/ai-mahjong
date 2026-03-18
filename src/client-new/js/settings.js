/**
 * Settings Module
 * LLM and Player configuration
 */

import * as socket from './socket.js';

// State
let llmPresets = [];
let llmConfigs = [];
let activeLlmId = null;      // 当前使用中的配置
let selectedLlmId = null;    // 下拉框中选中的配置（用于底部显示）

let playerConfig = {
  humanCount: 1,
  aiCount: 0,
  npcCount: 0,
  aiPlayers: []
};

// AI Character presets from server
const AI_PERSONALITIES = [
  { id: 'chatty', name: '话痨', traits: '话多、喜欢分析、热心肠' },
  { id: 'aggressive', name: '激进', traits: '果断、冒险、敢于做大牌' },
  { id: 'cautious', name: '谨慎', traits: '稳重、细心、爱犹豫' },
  { id: 'balanced', name: '平衡', traits: '随和、灵活、心态好' },
  { id: 'sarcastic', name: '毒舌', traits: '冷淡、讽刺、实力强' },
  { id: 'tsundere', name: '傲娇', traits: '不服输、心口不一' },
  { id: 'lucky', name: '幸运星', traits: '运气好、乐天派、开心' },
  { id: 'serious', name: '认真', traits: '计算型、话少、冷静' },
  { id: 'dramatic', name: '戏精', traits: '戏多、夸张、爱表演' },
];

const AI_GENDERS = [
  { id: 'male', name: '男', emoji: '♂️' },
  { id: 'female', name: '女', emoji: '♀️' },
  { id: 'unknown', name: '未知', emoji: '❓' },
];

const AI_AGES = [
  { id: 'young', name: '青年', desc: '18-30岁' },
  { id: 'middle', name: '中年', desc: '30-50岁' },
  { id: 'senior', name: '老年', desc: '50岁以上' },
  { id: 'unknown', name: '未知', desc: '年龄不详' },
];

// Initialize
export async function init() {
  // Load data
  await loadLlmPresets();
  loadLlmConfigs();  // 先加载 localStorage 的配置
  await loadFromBackend(); // 再从后端读取，合并
  loadPlayerConfig();
  
  // 渲染
  renderLlmPresets();
  renderLlmConfigs();
  
  // Bind events
  bindEvents();
  
  console.log('[Settings] Initialized, llmConfigs:', llmConfigs.length);
}

// 从后端配置文件加载
async function loadFromBackend() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    
    // 加载语言列表
    if (data.availableLanguages) {
      renderLanguageSelect(data.availableLanguages, data.currentLanguage);
    }
    
    if (data.llm) {
      // 从 localStorage 读取之前保存的 apiKey
      const savedConfigs = JSON.parse(localStorage.getItem('llm-configs') || '{"configs":[]}');
      const savedConfig = savedConfigs.configs?.find(c => c.id === data.llm.id);
      
      // 合并：后端配置 + localStorage 的 apiKey
      const mergedConfig = {
        ...data.llm,
        apiKey: savedConfig?.apiKey || data.llm.apiKey || ''
      };
      
      // 添加到配置列表
      const existingIndex = llmConfigs.findIndex(c => c.id === mergedConfig.id);
      if (existingIndex >= 0) {
        llmConfigs[existingIndex] = mergedConfig;
      } else {
        llmConfigs.push(mergedConfig);
      }
      activeLlmId = mergedConfig.id;
      selectedLlmId = mergedConfig.id;  // 初始选中当前使用的配置
      saveLlmConfigs();
      console.log('[Settings] Loaded LLM config from backend:', mergedConfig.name);
      
      // 填充表单
      fillLlmForm(mergedConfig);
    }
    
    if (data.players) {
      playerConfig = data.players;
      savePlayerConfig();
      console.log('[Settings] Loaded player config from backend');
    }
    
    // 保存当前语言到 localStorage
    if (data.currentLanguage) {
      localStorage.setItem('app-language', data.currentLanguage);
    }
  } catch (e) {
    console.error('[Settings] Failed to load from backend:', e);
  }
}

// 渲染语言选择下拉框
function renderLanguageSelect(languages, currentLanguage) {
  const select = document.getElementById('language-select');
  if (!select) return;
  
  select.innerHTML = languages.map(lang => 
    `<option value="${lang.code}" ${lang.code === currentLanguage ? 'selected' : ''}>${lang.name}</option>`
  ).join('');
  
  // 绑定事件
  select.addEventListener('change', async (e) => {
    const newLang = e.target.value;
    await saveLanguage(newLang);
  });
}

// 保存语言设置
async function saveLanguage(language) {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language })
    });
    
    if (res.ok) {
      localStorage.setItem('app-language', language);
      console.log('[Settings] Language saved:', language);
      // 刷新页面以应用新语言
      location.reload();
    }
  } catch (e) {
    console.error('[Settings] Failed to save language:', e);
  }
}

async function loadLlmPresets() {
  try {
    const res = await fetch('/llm-presets.json');
    const data = await res.json();
    llmPresets = data.presets || [];
    console.log('[Settings] Loaded presets:', llmPresets.length);
  } catch (e) {
    console.error('[Settings] Failed to load LLM presets:', e);
  }
}

function loadLlmConfigs() {
  try {
    const saved = localStorage.getItem('llm-configs');
    if (saved) {
      const data = JSON.parse(saved);
      llmConfigs = data.configs || [];
      activeLlmId = data.activeConfigId;
      selectedLlmId = data.activeConfigId;  // 初始选中当前使用的配置
    }
    renderLlmConfigs();
  } catch (e) {
    console.error('[Settings] Failed to load LLM configs:', e);
  }
}

function saveLlmConfigs() {
  localStorage.setItem('llm-configs', JSON.stringify({
    configs: llmConfigs,
    activeConfigId: activeLlmId
  }));
}

function loadPlayerConfig() {
  try {
    const saved = localStorage.getItem('player-config');
    if (saved) {
      playerConfig = JSON.parse(saved);
    }
    renderPlayerConfig();
    renderAiConfigList();
  } catch (e) {
    console.error('[Settings] Failed to load player config:', e);
  }
}

function savePlayerConfig() {
  localStorage.setItem('player-config', JSON.stringify(playerConfig));
}

// Event binding
function bindEvents() {
  // Modal toggle
  document.getElementById('settings-btn')?.addEventListener('click', openModal);
  document.getElementById('settings-close-btn')?.addEventListener('click', closeModal);
  
  // Tabs
  document.getElementById('tab-llm')?.addEventListener('click', () => switchTab('llm'));
  document.getElementById('tab-player')?.addEventListener('click', () => switchTab('player'));
  
  // LLM form
  document.getElementById('llm-save-btn')?.addEventListener('click', saveLlmConfig);
  document.getElementById('llm-test-btn')?.addEventListener('click', testLlmConnection);
  
  // Player count buttons
  document.querySelectorAll('.player-num-btn').forEach(btn => {
    btn.addEventListener('click', handlePlayerCountChange);
  });
  
  // Save buttons
  document.getElementById('settings-save-btn')?.addEventListener('click', handleSave);
}

function openModal() {
  document.getElementById('settings-modal')?.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('settings-modal')?.classList.add('hidden');
}

function switchTab(tab) {
  const llmTab = document.getElementById('tab-llm');
  const playerTab = document.getElementById('tab-player');
  const llmPanel = document.getElementById('panel-llm');
  const playerPanel = document.getElementById('panel-player');
  
  if (tab === 'llm') {
    llmTab?.classList.add('border-b-2', 'border-yellow-500');
    llmTab?.classList.remove('text-white/60');
    llmTab?.classList.add('text-white');
    playerTab?.classList.remove('border-b-2', 'border-yellow-500', 'text-white');
    playerTab?.classList.add('text-white/60');
    llmPanel?.classList.remove('hidden');
    playerPanel?.classList.add('hidden');
  } else {
    playerTab?.classList.add('border-b-2', 'border-yellow-500');
    playerTab?.classList.remove('text-white/60');
    playerTab?.classList.add('text-white');
    llmTab?.classList.remove('border-b-2', 'border-yellow-500', 'text-white');
    llmTab?.classList.add('text-white/60');
    playerPanel?.classList.remove('hidden');
    llmPanel?.classList.add('hidden');
  }
}

// Render LLM presets dropdown
function renderLlmPresets() {
  const select = document.getElementById('llm-preset-select');
  if (!select) return;
  
  // Clear existing options except first
  select.innerHTML = '<option value="">-- 选择预设或自定义 --</option>';
  
  // Add preset options
  llmPresets.forEach(preset => {
    const option = document.createElement('option');
    option.value = `preset-${preset.id}`;
    option.textContent = preset.name;
    option.dataset.preset = JSON.stringify(preset);
    select.appendChild(option);
  });
  
  // Add divider
  const divider = document.createElement('option');
  divider.disabled = true;
  divider.textContent = '── 已保存的配置 ──';
  select.appendChild(divider);
  
  // Add saved configs
  llmConfigs.forEach(config => {
    const option = document.createElement('option');
    option.value = `custom-${config.id}`;
    option.textContent = `⭐ ${config.name}`;
    option.dataset.config = JSON.stringify(config);
    if (activeLlmId === config.id) {
      option.textContent = `✓ ${config.name} (使用中)`;
    }
    select.appendChild(option);
  });
  
  // Bind change event
  select.addEventListener('change', handlePresetChange);
}

function handlePresetChange(e) {
  const value = e.target.value;
  if (!value) return;
  
  const option = e.target.selectedOptions[0];
  
  if (value.startsWith('preset-')) {
    // 预设选择 - 填充表单，底部显示"未保存"提示
    const preset = JSON.parse(option.dataset.preset);
    fillLlmForm({
      id: preset.id,
      name: preset.name,
      type: preset.type || 'openai',
      apiBase: preset.apiBase,
      model: preset.model,
      apiKey: ''
    });
    selectedLlmId = null;  // 预设不算已保存的配置
    renderLlmConfigs();
    console.log('[Settings] 选择预设:', preset.name, 'type:', preset.type);
  } else if (value.startsWith('custom-')) {
    // 已保存配置选择 - 填充表单并更新底部显示
    const config = JSON.parse(option.dataset.config);
    fillLlmForm(config);
    selectedLlmId = config.id;  // 更新选中的配置
    renderLlmConfigs();
  }
}

function fillLlmForm(config) {
  document.getElementById('llm-edit-id').value = config.id || '';
  document.getElementById('llm-name').value = config.name || '';
  document.getElementById('llm-type').value = config.type || 'openai';
  document.getElementById('llm-api-base').value = config.apiBase || '';
  document.getElementById('llm-model').value = config.model || '';
  document.getElementById('llm-api-key').value = config.apiKey || '';
}

// Render saved LLM configs list - 只显示当前选中的一个
function renderLlmConfigs() {
  const container = document.getElementById('llm-saved-list');
  if (!container) return;
  
  // 如果没有选中任何已保存的配置，显示提示
  if (!selectedLlmId) {
    container.innerHTML = '<div class="text-white/40 text-sm text-center py-2">选择预设后点击"保存配置"添加</div>';
    return;
  }
  
  // 只显示当前选中的配置
  const config = llmConfigs.find(c => c.id === selectedLlmId);
  if (!config) {
    container.innerHTML = '<div class="text-white/40 text-sm text-center py-2">配置不存在</div>';
    return;
  }
  
  const isActive = activeLlmId === config.id;
  
  container.innerHTML = `
    <div class="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2 ${isActive ? 'ring-2 ring-yellow-500' : ''}">
      <div>
        <div class="text-white font-bold">${config.name}</div>
        <div class="text-white/40 text-xs">${config.model}</div>
      </div>
      <div class="flex gap-2">
        ${isActive ? '<span class="text-yellow-500 text-xs px-2 py-1">✓ 使用中</span>' : 
          `<button id="use-config-btn" class="text-xs bg-yellow-600/50 hover:bg-yellow-600 px-3 py-1 rounded text-white">选用</button>`}
        <button id="delete-config-btn" class="text-xs bg-red-600/30 hover:bg-red-600 px-3 py-1 rounded text-white">删除</button>
      </div>
    </div>
  `;
  
  // Bind events
  document.getElementById('use-config-btn')?.addEventListener('click', () => {
    setActiveLlm(config.id);
  });
  
  document.getElementById('delete-config-btn')?.addEventListener('click', () => {
    deleteLlmConfig(config.id);
  });
}

function setActiveLlm(id) {
  activeLlmId = id;
  selectedLlmId = id;  // 选用后也选中它
  saveLlmConfigs();
  renderLlmPresets();
  renderLlmConfigs();
}

function saveLlmConfig() {
  const id = document.getElementById('llm-edit-id').value || 'custom-' + Date.now();
  const name = document.getElementById('llm-name').value;
  const type = document.getElementById('llm-type').value;
  const apiBase = document.getElementById('llm-api-base').value;
  const model = document.getElementById('llm-model').value;
  const apiKey = document.getElementById('llm-api-key').value;
  
  if (!name || !apiBase || !model) {
    alert('请填写完整配置');
    return;
  }
  
  const config = { id, name, type, apiBase, model, apiKey };
  
  // 更新或添加配置
  const existingIndex = llmConfigs.findIndex(c => c.id === id);
  if (existingIndex >= 0) {
    llmConfigs[existingIndex] = config;
  } else {
    llmConfigs.push(config);
  }
  
  // 设为当前配置和选中配置
  activeLlmId = id;
  selectedLlmId = id;
  
  saveLlmConfigs();
  renderLlmPresets();
  renderLlmConfigs();
  
  console.log('[Settings] LLM config saved:', name);
}

function deleteLlmConfig(id) {
  if (confirm('确定删除此配置？')) {
    llmConfigs = llmConfigs.filter(c => c.id !== id);
    if (activeLlmId === id) {
      activeLlmId = llmConfigs[0]?.id || null;
    }
    // 删除后选中下一个配置或清空
    selectedLlmId = llmConfigs[0]?.id || null;
    saveLlmConfigs();
    renderLlmPresets();
    renderLlmConfigs();
    // 如果还有配置，填充第一个
    if (selectedLlmId) {
      const config = llmConfigs.find(c => c.id === selectedLlmId);
      if (config) fillLlmForm(config);
    }
  }
}

async function testLlmConnection() {
  const btn = document.getElementById('llm-test-btn');
  btn.textContent = '测试中...';
  btn.disabled = true;
  
  try {
    const config = {
      type: document.getElementById('llm-type').value,
      apiBase: document.getElementById('llm-api-base').value,
      model: document.getElementById('llm-model').value,
      apiKey: document.getElementById('llm-api-key').value,
    };
    
    const res = await fetch('/api/llm/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const result = await res.json();
    if (result.success) {
      btn.textContent = '连接成功!';
      btn.classList.remove('bg-blue-600');
      btn.classList.add('bg-green-600');
    } else {
      throw new Error(result.error || '连接失败');
    }
  } catch (e) {
    btn.textContent = '连接失败';
    btn.classList.remove('bg-blue-600');
    btn.classList.add('bg-red-600');
    console.error('[Settings] LLM test failed:', e);
  } finally {
    setTimeout(() => {
      btn.textContent = '测试连接';
      btn.disabled = false;
      btn.classList.remove('bg-green-600', 'bg-red-600');
      btn.classList.add('bg-blue-600');
    }, 2000);
  }
}

// Player config
function renderPlayerConfig() {
  document.getElementById('human-count').textContent = playerConfig.humanCount;
  document.getElementById('ai-count').textContent = playerConfig.aiCount;
  document.getElementById('npc-count').textContent = playerConfig.npcCount;
}

function handlePlayerCountChange(e) {
  const type = e.target.dataset.type;
  const action = e.target.dataset.action;
  
  const total = playerConfig.humanCount + playerConfig.aiCount + playerConfig.npcCount;
  
  if (action === 'inc' && total >= 4) {
    return; // Max 4 players
  }
  
  if (type === 'human') {
    if (action === 'inc') playerConfig.humanCount++;
    else if (action === 'dec' && playerConfig.humanCount > 0) playerConfig.humanCount--;
  } else if (type === 'ai') {
    if (action === 'inc') playerConfig.aiCount++;
    else if (action === 'dec' && playerConfig.aiCount > 0) playerConfig.aiCount--;
  } else if (type === 'npc') {
    if (action === 'inc') playerConfig.npcCount++;
    else if (action === 'dec' && playerConfig.npcCount > 0) playerConfig.npcCount--;
  }
  
  // Update AI players list
  while (playerConfig.aiPlayers.length < playerConfig.aiCount) {
    playerConfig.aiPlayers.push({
      id: 'ai-' + Date.now() + '-' + playerConfig.aiPlayers.length,
      name: '',
      gender: 'unknown',
      age: 'young',
      personality: 'balanced'
    });
  }
  while (playerConfig.aiPlayers.length > playerConfig.aiCount) {
    playerConfig.aiPlayers.pop();
  }
  
  renderPlayerConfig();
  renderAiConfigList();
}

function renderAiConfigList() {
  const container = document.getElementById('ai-config-list');
  if (!container) return;
  
  if (playerConfig.aiCount === 0) {
    container.innerHTML = '<div class="text-white/40 text-sm text-center py-4">添加 AI 玩家后可配置</div>';
    return;
  }
  
  container.innerHTML = playerConfig.aiPlayers.map((ai, index) => `
    <div class="bg-slate-700/50 rounded-lg p-4" data-ai-index="${index}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-white font-bold">AI #${index + 1}</span>
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div>
          <label class="text-white/60 text-xs block mb-1">名字</label>
          <input type="text" class="ai-name-input w-full bg-slate-600 rounded px-2 py-1 text-white text-sm" 
            value="${ai.name}" placeholder="留空自动生成" data-index="${index}">
        </div>
        <div>
          <label class="text-white/60 text-xs block mb-1">性别</label>
          <select class="ai-gender-select w-full bg-slate-600 rounded px-2 py-1 text-white text-sm" data-index="${index}">
            ${AI_GENDERS.map(g => `<option value="${g.id}" ${ai.gender === g.id ? 'selected' : ''}>${g.emoji} ${g.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-white/60 text-xs block mb-1">年龄</label>
          <select class="ai-age-select w-full bg-slate-600 rounded px-2 py-1 text-white text-sm" data-index="${index}">
            ${AI_AGES.map(a => `<option value="${a.id}" ${ai.age === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-white/60 text-xs block mb-1">性格</label>
          <select class="ai-personality-select w-full bg-slate-600 rounded px-2 py-1 text-white text-sm" data-index="${index}">
            ${AI_PERSONALITIES.map(p => `<option value="${p.id}" ${ai.personality === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mt-2 text-right">
        <button class="generate-name-btn text-xs bg-purple-600/50 hover:bg-purple-600 px-3 py-1 rounded text-white" data-index="${index}">
          🎲 AI 生成名字
        </button>
      </div>
    </div>
  `).join('');
  
  // Bind events
  container.querySelectorAll('.ai-name-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      playerConfig.aiPlayers[index].name = e.target.value;
    });
  });
  
  container.querySelectorAll('.ai-gender-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      playerConfig.aiPlayers[index].gender = e.target.value;
    });
  });
  
  container.querySelectorAll('.ai-age-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      playerConfig.aiPlayers[index].age = e.target.value;
    });
  });
  
  container.querySelectorAll('.ai-personality-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      playerConfig.aiPlayers[index].personality = e.target.value;
    });
  });
  
  container.querySelectorAll('.generate-name-btn').forEach(btn => {
    btn.addEventListener('click', () => generateAiName(parseInt(btn.dataset.index)));
  });
}

async function generateAiName(index) {
  const ai = playerConfig.aiPlayers[index];
  if (!ai) return;
  
  const btn = document.querySelector(`.generate-name-btn[data-index="${index}"]`);
  btn.textContent = '生成中...';
  btn.disabled = true;
  
  try {
    // 后端从配置文件读取LLM配置，不需要前端传递
    const res = await fetch('/api/ai/generate-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: ai.gender,
        personality: ai.personality
      })
    });
    
    const result = await res.json();
    if (result.name) {
      ai.name = result.name;
      document.querySelector(`.ai-name-input[data-index="${index}"]`).value = result.name;
      btn.textContent = '✓ 已生成';
    } else {
      throw new Error(result.error || '生成失败');
    }
  } catch (e) {
    btn.textContent = '生成失败';
    console.error('[Settings] Generate name failed:', e);
  } finally {
    setTimeout(() => {
      btn.textContent = '🎲 AI 生成名字';
      btn.disabled = false;
    }, 2000);
  }
}

function handleSave() {
  // 先收集当前表单的LLM配置
  const llmId = document.getElementById('llm-edit-id')?.value || '';
  const llmName = document.getElementById('llm-name')?.value || '';
  const llmType = document.getElementById('llm-type')?.value || '';
  const llmApiBase = document.getElementById('llm-api-base')?.value || '';
  const llmModel = document.getElementById('llm-model')?.value || '';
  const llmApiKey = document.getElementById('llm-api-key')?.value || '';
  
  // 如果表单有内容，保存到配置列表
  if (llmName && llmApiBase && llmModel) {
    const config = { 
      id: llmId || 'custom-' + Date.now(), 
      name: llmName, 
      type: llmType, 
      apiBase: llmApiBase, 
      model: llmModel, 
      apiKey: llmApiKey 
    };
    
    const existingIndex = llmConfigs.findIndex(c => c.id === config.id);
    if (existingIndex >= 0) {
      llmConfigs[existingIndex] = config;
    } else {
      llmConfigs.push(config);
    }
    activeLlmId = config.id;
    selectedLlmId = config.id;  // 更新选中的配置
    console.log('[Settings] LLM config from form:', config.name);
  }
  
  savePlayerConfig();
  saveLlmConfigs();
  
  // Sync to backend
  syncToBackend();
  
  closeModal();
  console.log('[Settings] Config saved');
}

async function syncToBackend() {
  try {
    // 找到当前激活的配置
    let activeConfig = llmConfigs.find(c => c.id === activeLlmId);
    
    // 如果不在自定义配置里，检查是否是预设
    if (!activeConfig) {
      const preset = llmPresets.find(p => p.id === activeLlmId);
      if (preset) {
        // 从表单获取用户填写的 apiKey
        const apiKey = document.getElementById('llm-api-key')?.value || '';
        activeConfig = { ...preset, apiKey };
      }
    }
    
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm: activeConfig,
        players: playerConfig
      })
    });
    
    console.log('[Settings] Synced to backend:', activeConfig?.name);
  } catch (e) {
    console.error('[Settings] Failed to sync to backend:', e);
  }
}

// Export
export default {
  init,
  openModal,
  getPlayerConfig: () => playerConfig,
  getLlmConfig: () => [...llmPresets, ...llmConfigs].find(c => c.id === activeLlmId)
};
