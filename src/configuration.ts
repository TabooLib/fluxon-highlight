import * as vscode from 'vscode';

/**
 * 扩展配置读取工具
 */
export class Configuration {
  private static readonly SECTION = 'fluxonCompletion';

  /**
   * 获取用户配置的目录文件路径（可能包含变量）
   */
  static getCatalogPath(): string {
    return vscode.workspace.getConfiguration(this.SECTION).get<string>('catalogPath', '');
  }

  /**
   * 是否显示命名空间
   */
  static showNamespaces(): boolean {
    return vscode.workspace.getConfiguration(this.SECTION).get<boolean>('showNamespaces', true);
  }

  /**
   * 是否启用扩展函数补全
   */
  static enableExtensions(): boolean {
    return vscode.workspace.getConfiguration(this.SECTION).get<boolean>('enableExtensions', true);
  }

  /**
   * 日志级别
   */
  static getTraceLevel(): 'off' | 'basic' | 'verbose' {
    return vscode.workspace.getConfiguration(this.SECTION).get<'off' | 'basic' | 'verbose'>('trace', 'off');
  }

  /**
   * 是否包含用户自定义函数补全
   */
  static includeUserFunctions(): boolean {
    return vscode.workspace.getConfiguration(this.SECTION).get<boolean>('includeUserFunctions', true);
  }

  /**
   * 解析路径中的变量（如 ${workspaceFolder}）
   */
  static resolvePath(pathTemplate: string): string {
    if (!pathTemplate) {
      return '';
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    return pathTemplate.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
  }
}
