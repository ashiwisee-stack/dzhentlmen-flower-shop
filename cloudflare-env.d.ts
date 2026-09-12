declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  };
}

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
  dump(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  get(key: string): Promise<unknown>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: unknown): Promise<unknown>;
  delete(key: string): Promise<void>;
}

interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta: {changes: number}; }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown[]>(): Promise<T[]>;
}
