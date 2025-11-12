import * as fs from 'fs';
import * as path from 'path';
import { Catalog, CatalogFunction, isCatalog } from './schema';

/**
 * 加载并缓存 Fluxon 函数目录
 */
export class CatalogLoader {
  private catalog: Catalog | null = null;
  private catalogPath: string | null = null;
  private fallbackPath: string | null = null;
  private mergedExtensions: CatalogFunction[] | null = null;

  /**
   * 初始化加载器，指定目录文件路径
   * @param catalogFilePath 用户自定义路径（优先）
   * @param fallbackPath 内置默认路径（回退）
   */
  init(catalogFilePath: string, fallbackPath: string): void {
    this.catalogPath = catalogFilePath || fallbackPath;
    this.fallbackPath = fallbackPath;
    this.reload();
  }

  /**
   * 重新加载目录（用于开发期热重载或配置变更）
   * @param newPath 可选，指定新路径
   */
  reload(newPath?: string): void {
    if (newPath !== undefined) {
      this.catalogPath = newPath || this.fallbackPath;
    }
    if (!this.catalogPath) {
      throw new Error('CatalogLoader not initialized. Call init() first.');
    }
    
    // 尝试用户路径，失败则回退
    let targetPath = this.catalogPath;
    if (!fs.existsSync(targetPath) && this.fallbackPath && fs.existsSync(this.fallbackPath)) {
      targetPath = this.fallbackPath;
    }
    
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Catalog file not found: ${targetPath}`);
    }
    
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isCatalog(parsed)) {
      throw new Error(`Invalid catalog schema in ${targetPath}`);
    }
    this.catalog = parsed;
    this.mergedExtensions = null; // 清除缓存，下次访问时重新合并
  }

  /**
   * 获取系统函数列表
   */
  getSystemFunctions(): Catalog['system'] {
    if (!this.catalog) {
      throw new Error('Catalog not loaded. Call init() and reload() first.');
    }
    return this.catalog.system;
  }

  /**
   * 获取扩展函数映射
   */
  getExtensionFunctions(): Catalog['extensions'] {
    if (!this.catalog) {
      throw new Error('Catalog not loaded. Call init() and reload() first.');
    }
    return this.catalog.extensions;
  }

  /**
   * 根据宿主类型获取扩展函数
   */
  getExtensionsForHost(hostType: string): Catalog['system'] {
    const extensions = this.getExtensionFunctions();
    return extensions[hostType] || [];
  }

  /**
   * 获取所有扩展函数（合并后）
   * 相同名字的函数会合并它们的参数范围和属性
   */
  getMergedExtensionFunctions(): CatalogFunction[] {
    if (!this.catalog) {
      throw new Error('Catalog not loaded. Call init() and reload() first.');
    }
    // 使用缓存
    if (this.mergedExtensions) {
      return this.mergedExtensions;
    }
    const functionMap = new Map<string, CatalogFunction>();
    // 遍历所有宿主类型的扩展函数
    Object.values(this.catalog.extensions).forEach(fnList => {
      fnList.forEach(fn => {
        const key = `${fn.namespace || ''}:${fn.name}`;
        
        if (functionMap.has(key)) {
          // 合并已存在的函数
          const existing = functionMap.get(key)!;
          // 合并参数范围
          const mergedParams = this.mergeParams(existing.params, fn.params);
          // 更新函数信息（保留更宽松的属性）
          functionMap.set(key, {
            name: fn.name,
            namespace: fn.namespace,
            params: mergedParams,
            async: existing.async || fn.async,
            primarySync: existing.primarySync || fn.primarySync,
          });
        } else {
          // 添加新函数
          functionMap.set(key, { ...fn });
        }
      });
    });
    this.mergedExtensions = Array.from(functionMap.values());
    return this.mergedExtensions;
  }

  /**
   * 合并两个参数数组
   * params 中的每个数字都是一个独立支持的参数数量
   * 例如：[1, 3] 表示支持1个或3个参数（不支持2个）
   * 合并 [1, 3] 和 [2] 应该得到 [1, 2, 3]
   */
  private mergeParams(params1: number[], params2: number[]): number[] {
    // 使用 Set 去重并合并
    const paramSet = new Set<number>([...params1, ...params2]);
    // 排序后返回
    return Array.from(paramSet).sort((a, b) => a - b);
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.catalog !== null;
  }
}
