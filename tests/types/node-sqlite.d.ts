/**
 * The slice of Node's built-in `node:sqlite` the repository tests use. Declared here instead of
 * adding Node's types to the whole program (app code runs on iOS, not Node).
 */
declare module 'node:sqlite' {
  type Value = string | number | bigint | null | Uint8Array;
  interface StatementSync {
    run(...params: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: Value[]): Record<string, Value> | undefined;
    all(...params: Value[]): Record<string, Value>[];
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
