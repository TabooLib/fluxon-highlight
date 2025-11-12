import * as vscode from 'vscode';
import { CatalogLoader } from '../catalog/loader';
import { CatalogFunction } from '../catalog/schema';
import { detectContext, ContextType } from '../context/detector';
import { UserFunctionExtractor, UserFunction } from '../catalog/userFunctionExtractor';
import { Configuration } from '../configuration';

/**
 * Fluxon 语言关键字定义
 */
const FLUXON_KEYWORDS = {
  // 控制流关键字
  control: ['if', 'then', 'else', 'when', 'is', 'for', 'in', 'while', 'break', 'continue', 'return', 'try', 'catch', 'finally'],
  // 声明和修饰符关键字
  declaration: ['import', 'def', 'fun', 'val', 'var', 'async', 'sync', 'await'],
  // 常量
  constants: ['true', 'false', 'null'],
};

/**
 * Fluxon 注解定义
 */
const FLUXON_ANNOTATIONS = [
  {
    name: 'except',
    params: [],
    description: '使 Async 函数自动打印遇到的异常',
  },
];

/**
 * Fluxon 函数补全提供者
 */
export class FluxonCompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private catalogLoader: CatalogLoader,
    private userFunctionExtractor: UserFunctionExtractor
  ) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    if (!this.catalogLoader.isLoaded()) {
      return [];
    }

    const ctx = detectContext(document, position);
    if (ctx.type === ContextType.Ignored) {
      return [];
    }

    const items: vscode.CompletionItem[] = [];
    if (ctx.type === ContextType.TopLevel) {
      // 顶层补全：提供关键字 + 系统函数 + 用户函数
      // 1. 添加关键字
      items.push(...this.createKeywordCompletions());
      
      // 2. 添加系统函数
      const systemFunctions = this.catalogLoader.getSystemFunctions();
      systemFunctions.forEach(fn => {
        items.push(this.createCompletionItem(fn));
      });

      // 3. 添加用户自定义函数
      if (Configuration.includeUserFunctions()) {
        const userFunctions = this.userFunctionExtractor.getCached(document);
        userFunctions.forEach(fn => {
          items.push(this.createUserFunctionCompletionItem(fn));
        });
      }
    } else if (ctx.type === ContextType.Extension) {
      // 扩展函数补全：提供所有扩展函数（不区分类型）
      if (ctx.hostType === '*') {
        const allExtensions = this.catalogLoader.getExtensionFunctions();
        Object.values(allExtensions).forEach(fnList => {
          fnList.forEach(fn => {
            items.push(this.createCompletionItem(fn));
          });
        });
      } else if (ctx.hostType) {
        // 如果未来需要按类型过滤，保留此分支
        const extensionFunctions = this.catalogLoader.getExtensionsForHost(ctx.hostType);
        extensionFunctions.forEach(fn => {
          items.push(this.createCompletionItem(fn));
        });
      }
      // 同时提供系统函数（优先级降低）
      const systemFunctions = this.catalogLoader.getSystemFunctions();
      systemFunctions.forEach(fn => {
        items.push(this.createCompletionItem(fn, true));
      });
    } else if (ctx.type === ContextType.SingleColon) {
      // 单冒号补全：提示用户输入第二个冒号以访问扩展函数
      const colonItem = new vscode.CompletionItem(':', vscode.CompletionItemKind.Operator);
      colonItem.detail = 'extension method operator';
      colonItem.insertText = ':';
      colonItem.documentation = new vscode.MarkdownString(
        'Complete to `::` to access extension methods'
      );
      colonItem.sortText = '0_colon';
      colonItem.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Trigger completion again'
      };
      items.push(colonItem);
    } else if (ctx.type === ContextType.Annotation) {
      // 注解补全：提供所有注解
      items.push(...this.createAnnotationCompletions());
    } else if (ctx.type === ContextType.Import) {
      // import 语句补全：提供所有已知命名空间
      // 检测当前行前缀以判断是否已经有起始引号
      const line = document.lineAt(position.line).text;
      const prefix = line.substring(0, position.character);
      const importMatch = prefix.match(/\bimport\s+(['"])?([\w:._-]*)$/);
      const quoteChar = importMatch && importMatch[1] ? importMatch[1] : null;

      const nsSet = new Set<string>();
      // 系统函数中的命名空间
      const systemFunctions = this.catalogLoader.getSystemFunctions();
      systemFunctions.forEach(fn => {
        if (fn.namespace) nsSet.add(fn.namespace);
      });
      // 扩展函数中的命名空间
      const allExtensions = this.catalogLoader.getExtensionFunctions();
      Object.values(allExtensions).forEach(fnList => {
        fnList.forEach(fn => {
          if (fn.namespace) nsSet.add(fn.namespace);
        });
      });

      const namespaces = Array.from(nsSet).sort();
      namespaces.forEach(ns => {
        const item = new vscode.CompletionItem(ns, vscode.CompletionItemKind.Module);
        item.detail = 'namespace';
        item.sortText = `0_${ns}`;
        
        // 处理引号：import 语句必须使用引号
        if (quoteChar) {
          // 用户已输入起始引号（如 import "），只补全命名空间和闭合引号
          item.insertText = new vscode.SnippetString(`${ns}${quoteChar}`);
        } else {
          // 用户未输入引号（如 import ），补全为完整的带引号命名空间
          // 默认使用双引号
          item.insertText = new vscode.SnippetString(`"${ns}"`);
        }
        
        // 添加文档说明
        item.documentation = new vscode.MarkdownString(
          `Import namespace: \`${ns}\`\n\nUsage: \`import "${ns}"\``
        );
        
        items.push(item);
      });
    }
    return items;
  }

  /**
   * 创建关键字补全项
   */
  private createKeywordCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // 控制流关键字
    FLUXON_KEYWORDS.control.forEach(keyword => {
      const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
      item.detail = 'keyword';
      item.sortText = `0_${keyword}`; // 高优先级
      items.push(item);
    });

    // 声明关键字
    FLUXON_KEYWORDS.declaration.forEach(keyword => {
      const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
      item.detail = 'keyword';
      item.sortText = `0_${keyword}`;
      items.push(item);
    });

    // 常量
    FLUXON_KEYWORDS.constants.forEach(constant => {
      const item = new vscode.CompletionItem(constant, vscode.CompletionItemKind.Constant);
      item.detail = 'constant';
      item.sortText = `0_${constant}`;
      items.push(item);
    });
    return items;
  }

  /**
   * 创建注解补全项
   */
  private createAnnotationCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    FLUXON_ANNOTATIONS.forEach(annotation => {
      const item = new vscode.CompletionItem(annotation.name, vscode.CompletionItemKind.Property);
      item.detail = 'annotation';
      
      // 生成 Snippet：@name(param1, param2, ...)
      if (annotation.params.length > 0) {
        const paramPlaceholders = annotation.params.map((param, index) => 
          `\${${index + 1}:${param}}`
        ).join(', ');
        item.insertText = new vscode.SnippetString(`${annotation.name}(${paramPlaceholders})`);
      } else {
        item.insertText = new vscode.SnippetString(`${annotation.name}$0`);
      }
      
      item.sortText = `0_${annotation.name}`;
      
      // 文档说明
      item.documentation = new vscode.MarkdownString(
        `**@${annotation.name}**\n\n${annotation.description}\n\n**Parameters:** ${annotation.params.join(', ')}`
      );

      items.push(item);
    });

    return items;
  }

  /**
   * 将 CatalogFunction 转换为 CompletionItem
   */
  private createCompletionItem(fn: CatalogFunction, isSystemInExtensionContext = false): vscode.CompletionItem {
    const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
    
    // 构建详细信息
    const parts: string[] = [];
    if (fn.namespace) {
      parts.push(`namespace: ${fn.namespace}`);
    }
    if (fn.params.length > 0) {
      parts.push(`params: [${fn.params.join(', ')}]`);
    }
    if (fn.async) {
      parts.push('async');
    }
    if (fn.primarySync) {
      parts.push('primarySync');
    }
    item.detail = parts.join(' | ');

    // 插入文本：使用 Snippet 格式，基于最小参数数量
    // params 可能是:
    // - [2] 表示固定2个参数
    // - [0, 1] 表示0-1个参数范围
    // - [2, 3] 表示2-3个参数范围
    let minArgs = 0;
    
    if (fn.params.length === 1) {
      // 单个数字：固定参数数量
      minArgs = fn.params[0];
    } else if (fn.params.length >= 2) {
      // 两个数字：[minArgs, maxArgs] 范围
      minArgs = fn.params[0];
    }
    
    if (minArgs === 0) {
      // 最小0个参数：只补括号，光标在括号内
      item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
    } else {
      // 按最小参数数量补全，逗号数量 = minArgs - 1
      const placeholders: string[] = [];
      for (let i = 0; i < minArgs; i++) {
        placeholders.push(`\${${i + 1}:arg${i + 1}}`);
      }
      item.insertText = new vscode.SnippetString(`${fn.name}(${placeholders.join(', ')})`);
    }

    // 排序优先级：系统函数在扩展上下文中降低优先级
    item.sortText = isSystemInExtensionContext ? `1_${fn.name}` : `0_${fn.name}`;

    // 文档说明
    let paramInfo = '';
    if (fn.params.length === 1) {
      paramInfo = `${fn.params[0]} parameter(s)`;
    } else if (fn.params.length >= 2) {
      const minP = fn.params[0];
      const maxP = fn.params[1];
      paramInfo = minP === maxP ? `${minP} parameter(s)` : `${minP}-${maxP} parameters`;
    } else {
      paramInfo = 'No parameters';
    }
    
    const docParts: string[] = [];
    if (fn.namespace) {
      docParts.push(`**Namespace:** \`${fn.namespace}\``);
    }
    docParts.push(`**Parameters:** ${paramInfo}`);
    if (fn.async) {
      docParts.push(`**Async:** Yes`);
    }
    
    item.documentation = new vscode.MarkdownString(docParts.join('\n\n'));

    return item;
  }

  /**
   * 将用户自定义函数转换为 CompletionItem
   */
  private createUserFunctionCompletionItem(fn: UserFunction): vscode.CompletionItem {
    const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
    
    // 详细信息
    const parts: string[] = ['user-defined'];
    if (fn.isAsync) {
      parts.push('async');
    }
    if (fn.isSync) {
      parts.push('sync');
    }
    parts.push(`params: [${fn.params.join(', ')}]`);
    item.detail = parts.join(' | ');

    // 插入文本：使用 Snippet 格式
    const paramCount = fn.params[0]; // 固定参数数量
    if (paramCount === 0) {
      item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
    } else {
      const placeholders: string[] = [];
      for (let i = 0; i < paramCount; i++) {
        placeholders.push(`\${${i + 1}:arg${i + 1}}`);
      }
      item.insertText = new vscode.SnippetString(`${fn.name}(${placeholders.join(', ')})`);
    }

    // 用户函数优先级略低于系统函数
    item.sortText = `2_${fn.name}`;

    // 文档说明
    item.documentation = new vscode.MarkdownString(
      `**User-defined function**\n\n**Parameters:** ${paramCount}`
    );

    return item;
  }
}
