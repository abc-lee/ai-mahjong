/**
 * LLM 服务层 - 使用 Vercel AI SDK 统一处理不同提供商
 * 自动处理思考链模型（MiniMax M2.5, DeepSeek R1 等）
 *
 * 本地模型并发=1 时，多个 AI 同时请求会排队/超时导致"不说话"。
 * 添加全局信号量：默认最多3个同时请求，超过的排队等30秒。
 * 可通过环境变量 LLM_MAX_CONCURRENT / LLM_MAX_WAIT_MS 调整。
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, wrapLanguageModel, extractReasoningMiddleware } from 'ai';

// LLM 配置
export interface LLMProviderConfig {
  provider: string;      // minimax, deepseek, qwen, openai, anthropic, etc.
  apiKey: string;
  baseURL: string;
  model: string;
}

// ===== 并发信号量 =====
// 本地模型（ollama/llama.cpp 等）并发=1，远端模型并发=3
const MAX_CONCURRENT = parseInt(process.env.LLM_MAX_CONCURRENT || '', 10) || 3;
const MAX_WAIT_MS = parseInt(process.env.LLM_MAX_WAIT_MS || '', 10) || 30_000;

class Semaphore {
  private running = 0;
  private queue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex(q => q.reject === reject);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error(`LLM 排队超时（${MAX_WAIT_MS / 1000}s），本地模型可能正忙`));
      }, MAX_WAIT_MS);
      this.queue.push({
        resolve: () => { clearTimeout(timer); this.running++; resolve(); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
    });
  }

  release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.resolve();
    }
  }
}

const llmSemaphore = new Semaphore(MAX_CONCURRENT);
console.log(`[LLM] 并发限制: ${MAX_CONCURRENT}，排队超时: ${MAX_WAIT_MS / 1000}s`);

// ===== 提供商缓存 =====
const providers = new Map<string, any>();

/**
 * 获取或创建 LLM 提供商
 */
function getProvider(config: LLMProviderConfig) {
  // 缓存 key 包含 apiKey，避免空 key 被缓存
  const key = `${config.provider}:${config.baseURL}:${config.apiKey?.substring(0, 8) || 'no-key'}`;
  
  if (!providers.has(key)) {
    // 根据类型选择不同的 SDK
    if (config.provider === 'anthropic') {
      // Anthropic SDK 需要 apiKey 参数，不是 headers
      providers.set(key, createAnthropic({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      }));
    } else {
      providers.set(key, createOpenAICompatible({
        baseURL: config.baseURL,
        name: config.provider,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      }));
    }
  }
  
  return providers.get(key)!;
}

/**
 * 创建带思考链提取的模型
 * SDK 会自动：
 * - 提取 莱斯... 内容到 reasoningText
 * - 将实际响应放到 text
 */
function createModelWithReasoning(config: LLMProviderConfig) {
  const provider = getProvider(config);
  
  // Anthropic 用 messages(), 其他用 chatModel()
  const baseModel = config.provider === 'anthropic' 
    ? provider.messages(config.model)
    : provider.chatModel(config.model);
  
  // 使用中间件提取思考链
  return wrapLanguageModel({
    model: baseModel,
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  });
}

/**
 * 调用 LLM 生成文本（经过信号量控制并发）
 * SDK 会自动处理响应格式差异
 * 
 * @returns { text: 实际内容, reasoningText?: 思考链内容 }
 */
export async function generateLLMText(
  config: LLMProviderConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<{ text: string; reasoningText?: string }> {
  await llmSemaphore.acquire();
  try {
    const model = createModelWithReasoning(config);
    
    const result = await generateText({
      model,
      messages,
      temperature: options?.temperature ?? 0.9,
      maxOutputTokens: options?.maxTokens ?? 800,  // AI SDK 5.0 用 maxOutputTokens
    } as any);
    
    
    return {
      text: result.text,
      reasoningText: (result as any).reasoningText,
    };
  } catch (error: any) {
    console.error('[LLMService] generateText error:', error.message);
    throw error;
  } finally {
    llmSemaphore.release();
  }
}

/**
 * 快速单轮对话（用于测试、名字生成等）
 */
export async function quickChat(
  config: LLMProviderConfig,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const result = await generateLLMText(
    config,
    [{ role: 'user', content: prompt }],
    options
  );
  return result.text;
}

/**
 * 带系统提示的对话
 */
export async function chatWithSystem(
  config: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ text: string; reasoningText?: string }> {
  return generateLLMText(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], options);
}

// 清除提供商缓存（配置变更时调用）
export function clearProviderCache(): void {
  providers.clear();
}
