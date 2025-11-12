import * as vscode from 'vscode';

/**
 * 补全上下文类型
 */
export enum ContextType {
  /** 顶层标识符补全 */
  TopLevel = 'TopLevel',
  /** 扩展函数补全（obj::method） */
  Extension = 'Extension',
  /** 单冒号后，提示补全第二个冒号 */
  SingleColon = 'SingleColon',
  /** import 语句中的命名空间补全 */
  Import = 'Import',
  /** 注解补全（@...） */
  Annotation = 'Annotation',
  /** 在注释或字符串内，不提供补全 */
  Ignored = 'Ignored',
}

export interface ContextResult {
  type: ContextType;
  /** 若为 Extension 类型，返回 '*' 表示提供所有扩展函数 */
  hostType?: string;
}

/**
 * 检测光标所在位置的补全上下文
 */
export function detectContext(
  document: vscode.TextDocument,
  position: vscode.Position
): ContextResult {
  const line = document.lineAt(position.line).text;
  const cursorIndex = position.character;
  const prefix = line.substring(0, cursorIndex);
  console.log('[Fluxon Detector] Analyzing line:', JSON.stringify(line), 'Cursor at:', cursorIndex);

  // 如果是 YAML 文件，检查是否在 Fluxon 代码块内（: ; 开头）
  if (document.languageId === 'yaml') {
    // 检查当前行是否是 Fluxon 嵌入块（包含 : ; 模式）
    const yamlFluxonPattern = /:\s*;/;
    if (!yamlFluxonPattern.test(line)) {
      // 不在 Fluxon 块内，不提供补全
      return { type: ContextType.Ignored };
    }
    // 在 Fluxon 块内，继续后续检测
  }

  // 跳过注释（行内 # 或 //）
  if (/^\s*(#|\/\/)/.test(prefix)) {
    return { type: ContextType.Ignored };
  }

  // 检测 import 上下文：必须在字符串检查之前，因为 import "xxx 会有未闭合引号
  // 支持 import 'ns' 或 import "ns" 或 import ns
  const importMatch = prefix.match(/\bimport\s+(['"])?([\w:._-]*)$/);
  if (importMatch) {
    return { type: ContextType.Import };
  }

  // 跳过字符串内部（检测未闭合引号）
  const singleQuotes = (prefix.match(/'/g) || []).length;
  const doubleQuotes = (prefix.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
    return { type: ContextType.Ignored };
  }

  // 检测单冒号（在非 :: 情况下）
  // 匹配模式：非空白字符 + 单个冒号（后面不是冒号）
  const singleColonMatch = prefix.match(/(\S+):$/);
  if (singleColonMatch && !prefix.endsWith('::')) {
    return { type: ContextType.SingleColon };
  }

  // 检测上下文调用（::）
  // 匹配模式：任意非空白字符 + :: + 可选的标识符前缀
  const extensionMatch = prefix.match(/(\S+)\s*::(\w*)$/);
  if (extensionMatch) {
    // 策略：只要在扩展上下文内，就返回特殊标记 '*'，表示提供所有扩展函数
    return { type: ContextType.Extension, hostType: '*' };
  }

  // 检测注解（@）
  // 匹配模式：@ + 可选的注解名称前缀
  const annotationMatch = prefix.match(/@(\w*)$/);
  if (annotationMatch) {
    return { type: ContextType.Annotation };
  }

  // 默认顶层补全
  return { type: ContextType.TopLevel };
}
