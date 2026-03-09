/**
 * Coordinator 命令解析器
 * 
 * 解析 Coordinator 发送的命令格式，执行相应操作
 * 
 * 支持的命令：
 * - [COMMAND:create_team]name=xxx[/COMMAND]
 * - [COMMAND:assign_task]team=xxx|title=xxx[/COMMAND]
 * - [COMMAND:broadcast]message=xxx[/COMMAND]
 * - [COMMAND:send_message]team=xxx|message=xxx[/COMMAND]
 * - [COMMAND:inject_prompt]team=xxx|template=backend/frontend/fullstack[/COMMAND]
 */

interface Command {
  type: 'create_team' | 'assign_task' | 'broadcast' | 'send_message' | 'inject_prompt';
  params: Record<string, string>;
  rawMessage: string;
}

interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * 解析命令格式
 */
export function parseCommand(message: string): Command | null {
  const commandRegex = /\[COMMAND:(\w+)\]([\s\S]*?)\[\/COMMAND\]/;
  const match = message.match(commandRegex);
  
  if (!match) {
    return null;
  }
  
  const [, type, paramStr] = match;
  const validTypes = ['create_team', 'assign_task', 'broadcast', 'send_message', 'inject_prompt'];
  
  if (!validTypes.includes(type)) {
    return null;
  }
  
  // 解析参数 (key=value|key2=value2 格式)
  const params: Record<string, string> = {};
  const paramPairs = paramStr.split('|');
  
  for (const pair of paramPairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      params[key.trim()] = valueParts.join('=').trim();
    }
  }
  
  return {
    type: type as Command['type'],
    params,
    rawMessage: message,
  };
}

/**
 * 执行命令
 */
export async function executeCommand(command: Command): Promise<CommandResult> {
  try {
    switch (command.type) {
      case 'create_team': {
        const name = command.params.name;
        if (!name) {
          return {
            success: false,
            message: '缺少参数：name',
          };
        }
        // TODO: 调用 TeamManager 创建团队
        return {
          success: true,
          message: `团队 "${name}" 创建成功`,
          data: { name },
        };
      }
      
      case 'assign_task': {
        const team = command.params.team;
        const title = command.params.title;
        if (!team || !title) {
          return {
            success: false,
            message: '缺少参数：team 或 title',
          };
        }
        // TODO: 调用 TaskManager 分配任务
        return {
          success: true,
          message: `任务 "${title}" 已分配给 @${team}`,
          data: { team, title },
        };
      }
      
      case 'broadcast': {
        const message = command.params.message;
        if (!message) {
          return {
            success: false,
            message: '缺少参数：message',
          };
        }
        // TODO: 广播到 Hive
        return {
          success: true,
          message: `已广播到 Hive: ${message}`,
          data: { message },
        };
      }
      
      case 'send_message': {
        const team = command.params.team;
        const message = command.params.message;
        if (!team || !message) {
          return {
            success: false,
            message: '缺少参数：team 或 message',
          };
        }
        // TODO: 发送消息到指定团队
        return {
          success: true,
          message: `已发送消息给 @${team}: ${message}`,
          data: { team, message },
        };
      }
      
      case 'inject_prompt': {
        const team = command.params.team;
        const template = command.params.template;
        if (!team || !template) {
          return {
            success: false,
            message: '缺少参数：team 或 template',
          };
        }
        // TODO: 调用 PromptManager 注入角色提示词
        return {
          success: true,
          message: `已注入 "${template}" 提示词模板给 @${team}`,
          data: { team, template },
        };
      }
      
      default:
        return {
          success: false,
          message: `未知命令类型：${command.type}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `命令执行失败：${errorMessage}`,
    };
  }
}

/**
 * 处理 Coordinator 消息
 */
export async function handleCoordinatorMessage(message: string): Promise<CommandResult> {
  const command = parseCommand(message);
  
  if (!command) {
    return {
      success: false,
      message: '不是有效的命令格式',
    };
  }
  
  return executeCommand(command);
}

// 导出解析和执行的工具函数
export default {
  parseCommand,
  executeCommand,
  handleCoordinatorMessage,
};
