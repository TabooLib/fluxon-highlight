import * as vscode from 'vscode';
import * as path from 'path';
import { CatalogLoader } from './catalog/loader';
import { FluxonCompletionProvider } from './provider/completionProvider';
import { Configuration } from './configuration';
import { UserFunctionExtractor } from './catalog/userFunctionExtractor';

let catalogLoader: CatalogLoader;
let userFunctionExtractor: UserFunctionExtractor;

/**
 * 扩展激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Fluxon extension is now active');

  // 初始化函数目录加载器
  catalogLoader = new CatalogLoader();
  const builtInPath = path.join(context.extensionPath, 'data', 'fluxon-functions.json');
  const userPath = Configuration.resolvePath(Configuration.getCatalogPath());
  
  try {
    catalogLoader.init(userPath, builtInPath);
    console.log('Fluxon function catalog loaded successfully');
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to load Fluxon function catalog: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  // 初始化用户函数提取器
  userFunctionExtractor = new UserFunctionExtractor();

  // 注册补全提供者
  const completionProvider = new FluxonCompletionProvider(catalogLoader, userFunctionExtractor);
  
  // 为 .fs 文件注册补全
  const fluxonProvider = vscode.languages.registerCompletionItemProvider(
    { language: 'fluxon', scheme: 'file' },
    completionProvider,
    ':', '@' // 冒号触发 :: 语法，@ 触发注解补全
  );

  // 为 YAML 文件中嵌入的 Fluxon 代码注册补全
  const yamlProvider = vscode.languages.registerCompletionItemProvider(
    { language: 'yaml', scheme: 'file' },
    completionProvider,
    ':', '@' // 同样支持 :: 和 @ 触发
  );

  context.subscriptions.push(fluxonProvider, yamlProvider);

  // 监听文档打开和变化，更新用户函数缓存
  const updateUserFunctions = (document: vscode.TextDocument) => {
    if (document.languageId === 'fluxon') {
      userFunctionExtractor.updateCache(document);
    }
  };

  // 打开的文档
  vscode.workspace.textDocuments.forEach(updateUserFunctions);

  // 监听文档打开
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(updateUserFunctions)
  );

  // 监听文档变化（防抖）
  let updateTimeout: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      updateTimeout = setTimeout(() => {
        updateUserFunctions(event.document);
      }, 500); // 500ms 防抖
    })
  );

  // 监听文档关闭，清除缓存
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      userFunctionExtractor.clearCache(document.uri);
    })
  );

  // 注册刷新命令
  const refreshCommand = vscode.commands.registerCommand('fluxon.refreshCatalog', () => {
    try {
      const userPath = Configuration.resolvePath(Configuration.getCatalogPath());
      catalogLoader.reload(userPath);
      vscode.window.showInformationMessage('Fluxon catalog refreshed successfully');
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh catalog: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  context.subscriptions.push(refreshCommand);

  // 监听配置变化
  const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('fluxonCompletion.catalogPath')) {
      try {
        const userPath = Configuration.resolvePath(Configuration.getCatalogPath());
        catalogLoader.reload(userPath);
        console.log('Catalog reloaded due to configuration change');
      } catch (error) {
        console.error('Failed to reload catalog on config change:', error);
      }
    }
  });

  context.subscriptions.push(configWatcher);

  // 开发模式：监听目录文件变化并热重载（可选）
  if (process.env.NODE_ENV === 'development') {
    const userPath = Configuration.resolvePath(Configuration.getCatalogPath());
    const watchPath = userPath || builtInPath;
    const watcher = vscode.workspace.createFileSystemWatcher(watchPath);
    watcher.onDidChange(() => {
      try {
        catalogLoader.reload();
        console.log('Fluxon catalog reloaded');
      } catch (error) {
        console.error('Failed to reload catalog:', error);
      }
    });
    context.subscriptions.push(watcher);
  }
}

/**
 * 扩展停用时调用
 */
export function deactivate() {
  console.log('Fluxon extension is now deactivated');
}
