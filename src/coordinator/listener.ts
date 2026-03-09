/**
 * OpenHive Coordinator 消息监听器
 * 
 * 监听 Coordinator 发送的消息，自动解析并执行命令
 */

import { handleCoordinatorMessage } from './index';

interface MessageListener {
  start: () => void;
  stop: () => void;
}

/**
 * 创建 Coordinator 消息监听器
 * 
 * @param eventSource OpenHive 事件源 URL
 * @param onCommandResult 命令执行结果回调
 */
export function createCoordinatorListener(
  eventSource: string = 'http://127.0.0.1:4096/event',
  onCommandResult?: (result: { success: boolean; message: string }) => void
): MessageListener {
  let eventSourceInstance: EventSource | null = null;
  let isRunning = false;

  const start = () => {
    if (isRunning) {
      console.log('[CoordinatorListener] 已经在运行中');
      return;
    }

    console.log(`[CoordinatorListener] 开始监听：${eventSource}`);
    eventSourceInstance = new EventSource(eventSource);
    isRunning = true;

    eventSourceInstance.onopen = () => {
      console.log('[CoordinatorListener] 已连接到 OpenHive 事件流');
    };

    eventSourceInstance.onerror = (error) => {
      console.error('[CoordinatorListener] 连接错误:', error);
      isRunning = false;
    };

    eventSourceInstance.addEventListener('coordinator:message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        const message = data.message || data.content;
        
        if (!message) {
          return;
        }

        console.log('[CoordinatorListener] 收到 Coordinator 消息:', message);
        
        const result = await handleCoordinatorMessage(message);
        
        console.log('[CoordinatorListener] 命令执行结果:', result);
        
        if (onCommandResult) {
          onCommandResult(result);
        }
        
        // TODO: 将结果发送回 Hive 或 Coordinator
      } catch (error) {
        console.error('[CoordinatorListener] 处理消息失败:', error);
      }
    });
  };

  const stop = () => {
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }
    isRunning = false;
    console.log('[CoordinatorListener] 已停止监听');
  };

  return { start, stop };
}

/**
 * 从消息中提取命令文本（去除命令标签）
 */
export function extractCommandText(message: string): string {
  const commandRegex = /\[COMMAND:\w+\]([\s\S]*?)\[\/COMMAND\]/g;
  return message.replace(commandRegex, '').trim();
}

/**
 * 格式化命令输出（用于显示在 Hive 中）
 */
export function formatCommandOutput(result: { success: boolean; message: string }): string {
  const icon = result.success ? '✅' : '❌';
  return `${icon} ${result.message}`;
}

export default {
  createCoordinatorListener,
  extractCommandText,
  formatCommandOutput,
};
