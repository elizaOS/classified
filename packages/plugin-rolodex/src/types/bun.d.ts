declare module 'bun:sqlite' {
  export interface Database {
    query: (sql: string) => any;
    run: (sql: string) => any;
    close: () => void;
  }

  export default class Database {
    constructor(path: string);
    query: (sql: string) => any;
    run: (sql: string) => any;
    close: () => void;
  }
}
