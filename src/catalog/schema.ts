/**
 * 函数目录 JSON 结构的 TypeScript 类型定义
 */

export interface CatalogFunction {
  /** 函数名称 */
  name: string;
  /** 命名空间（可为 null） */
  namespace: string | null;
  /** 支持的参数个数列表 */
  params: number[];
  /** 是否为异步函数 */
  async: boolean;
  /** 是否为主线程同步函数 */
  primarySync: boolean;
}

export interface Catalog {
  /** 生成时间戳 (ISO-8601) */
  generatedAt: string;
  /** 系统全局函数 */
  system: CatalogFunction[];
  /** 扩展函数，按宿主类型全限定名分组 */
  extensions: Record<string, CatalogFunction[]>;
}

/**
 * 校验 JSON 对象是否符合 Catalog 类型
 */
export function isCatalog(obj: unknown): obj is Catalog {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.generatedAt === 'string' &&
    Array.isArray(candidate.system) &&
    typeof candidate.extensions === 'object' &&
    candidate.extensions !== null
  );
}

/**
 * 校验函数条目是否符合 CatalogFunction 类型
 */
export function isCatalogFunction(obj: unknown): obj is CatalogFunction {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const fn = obj as Record<string, unknown>;
  return (
    typeof fn.name === 'string' &&
    (fn.namespace === null || typeof fn.namespace === 'string') &&
    Array.isArray(fn.params) &&
    typeof fn.async === 'boolean' &&
    typeof fn.primarySync === 'boolean'
  );
}
