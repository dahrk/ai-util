// Shim for `@tauri-apps/plugin-store`. Settings live in the in-memory
// store managed by ./state.ts and surface through invoke(), so the
// plugin-store API isn't needed for our tests. Stub anyway in case
// future code imports it.
import "./index";

export class Store {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async set(_key: string, _value: unknown): Promise<void> {
    /* no-op */
  }
  async save(): Promise<void> {
    /* no-op */
  }
  async delete(_key: string): Promise<boolean> {
    return true;
  }
  async clear(): Promise<void> {
    /* no-op */
  }
  async keys(): Promise<string[]> {
    return [];
  }
}

export function load(_path: string): Promise<Store> {
  return Promise.resolve(new Store());
}
