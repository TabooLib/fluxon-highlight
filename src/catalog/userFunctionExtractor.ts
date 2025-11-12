import * as vscode from 'vscode';

/**
 * 用户自定义函数元数据
 */
export interface UserFunction {
  /** 函数名称 */
  name: string;
  /** 参数数量（最小值，最大值） */
  params: [number, number];
  /** 是否为异步函数 */
  isAsync: boolean;
  /** 是否为同步函数 */
  isSync: boolean;
  /** 定义位置 */
  range: vscode.Range;
}

/**
 * 从文档中提取用户定义的函数
 */
export class UserFunctionExtractor {
  private cache: Map<string, UserFunction[]> = new Map();

  /**
   * 扫描文档，提取所有函数定义
   */
  extractFromDocument(document: vscode.TextDocument): UserFunction[] {
    const functions: UserFunction[] = [];
    
    // 逐行扫描
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);
      const lineText = line.text.trim();
      
      // 跳过空行和注释行
      if (!lineText || lineText.startsWith('//') || lineText.startsWith('#')) {
        continue;
      }
      
      // 正则匹配函数定义
      // 支持:
      // 1. 带括号: def name(x, y) = ...
      // 2. 无括号: def name x y = ...
      // 3. 无参数: def name = ...
      const functionMatch = lineText.match(/^(async\s+|sync\s+)?(def|fun)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(.*)$/);
      
      if (functionMatch) {
        const modifier = functionMatch[1]?.trim() || '';
        const keyword = functionMatch[2];
        const name = functionMatch[3];
        const rest = functionMatch[4].trim();
        
        let paramCount = 0;
        
        // 情况1: 带括号参数 (x, y, z)
        const parenMatch = rest.match(/^\(([^)]*)\)/);
        if (parenMatch) {
          const paramsStr = parenMatch[1].trim();
          paramCount = paramsStr === '' ? 0 : paramsStr.split(',').length;
        } 
        // 情况2: 无括号参数，检查 = 或 { 之前的内容
        else if (rest && !rest.startsWith('=') && !rest.startsWith('{')) {
          // 提取 = 或 { 之前的参数部分
          const beforeAssign = rest.split(/[={]/)[0].trim();
          if (beforeAssign) {
            // 参数可以用逗号或空格分隔: x, y, z 或 x y z
            const params = beforeAssign.split(/[,\s]+/).filter(p => p && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p));
            paramCount = params.length;
          }
        }
        // 情况3: 无参数 (直接是 = 或 {)
        // paramCount 保持为 0
        
        functions.push({
          name,
          params: [paramCount, paramCount], // 固定参数数量
          isAsync: modifier === 'async',
          isSync: modifier === 'sync',
          range: new vscode.Range(lineNum, 0, lineNum, line.text.length),
        });
      }
    }
    
    return functions;
  }

  /**
   * 更新文档的函数缓存
   */
  updateCache(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    const functions = this.extractFromDocument(document);
    this.cache.set(uri, functions);
    console.log(`[UserFunctionExtractor] Found ${functions.length} functions in ${document.fileName}`);
  }

  /**
   * 获取文档的缓存函数列表
   */
  getCached(document: vscode.TextDocument): UserFunction[] {
    const uri = document.uri.toString();
    return this.cache.get(uri) || [];
  }

  /**
   * 清除文档缓存
   */
  clearCache(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}
