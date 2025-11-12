import * as fs from 'fs';
import * as path from 'path';
import { Catalog, isCatalog } from './schema';

/**
 * 加载并缓存 Fluxon 函数目录
 */
export class CatalogLoader {
  private catalog: Catalog | null = null;
  private catalogPath: string | null = null;
  private fallbackPath: string | null = null;

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
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.catalog !== null;
  }
}
