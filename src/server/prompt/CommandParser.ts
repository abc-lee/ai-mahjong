/**
 * 指令解析器
 * 解析 AI Agent 发来的 JSON 指令
 */

import commands from './commands.json';

// Agent 指令类型
export interface AgentCommand {
  cmd: string;
  [key: string]: any;
}

// 指令定义
interface CommandDef {
  name: string;
  params: string[];
  description: string;
}

/**
 * 指令解析器类
 */
export class CommandParser {
  private validCommands: Set<string>;
  private commandDefs: CommandDef[];

  constructor() {
    this.commandDefs = commands.commands as CommandDef[];
    this.validCommands = new Set(this.commandDefs.map(c => c.name));
  }

  /**
   * 解析 JSON 字符串为指令对象
   */
  parse(json: string): AgentCommand | null {
    try {
      const obj = JSON.parse(json);
      if (obj && typeof obj === 'object' && obj.cmd && this.validCommands.has(obj.cmd)) {
        return obj as AgentCommand;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 解析对象为指令
   */
  parseObject(obj: any): AgentCommand | null {
    if (obj && typeof obj === 'object' && obj.cmd && this.validCommands.has(obj.cmd)) {
      return obj as AgentCommand;
    }
    return null;
  }

  /**
   * 验证指令是否有效
   */
  validate(command: AgentCommand): boolean {
    return this.validCommands.has(command.cmd);
  }

  /**
   * 获取指令定义
   */
  getCommandDef(name: string): CommandDef | undefined {
    return this.commandDefs.find(c => c.name === name);
  }

  /**
   * 获取所有有效指令名称
   */
  getValidCommands(): string[] {
    return Array.from(this.validCommands);
  }

  /**
   * 生成指令帮助文档
   */
  generateHelp(): string {
    const lines = this.commandDefs.map(cmd => {
      const params = cmd.params.length > 0 ? `(${cmd.params.join(', ')})` : '';
      return `- ${cmd.name}${params}: ${cmd.description}`;
    });
    return '可用指令：\n' + lines.join('\n');
  }
}

// 导出单例
export const commandParser = new CommandParser();
