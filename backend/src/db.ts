export interface QueryResult<T = any> {
  all: () => Promise<T[]>;
  get: () => Promise<T | null>;
  run: () => Promise<{ changes: number; lastInsertRowid?: number | string }>;
}

export interface UniversalDb {
  isD1: boolean;
  prepare: (query: string) => {
    bind: (...params: any[]) => QueryResult;
    all: (...params: any[]) => Promise<any[]>;
    get: (...params: any[]) => Promise<any | null>;
    run: (...params: any[]) => Promise<any>;
  };
  exec: (query: string) => Promise<void>;
}

function getActiveLocalDbPath(): string {
  try {
    const fs = (globalThis as any).process?.getBuiltinModule?.("node:fs") || 
      ((globalThis as any).require ? (globalThis as any).require("node:fs") : null);
    const path = (globalThis as any).process?.getBuiltinModule?.("node:path") || 
      ((globalThis as any).require ? (globalThis as any).require("node:path") : null);

    if (fs && path) {
      const dir = path.resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
      if (fs.existsSync(dir)) {
        const files: string[] = fs.readdirSync(dir);
        // Find the database sqlite file that is not metadata.sqlite
        const dbFile = files.find((f: string) => f.endsWith(".sqlite") && !f.startsWith("metadata"));
        if (dbFile) {
          return path.join(dir, dbFile);
        }
      }
    }
  } catch {}
  return "C:/Users/imthi/OneDrive/Desktop/cafe4x/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4f6297955562fa647a7ffb8b4b13b38cc5c1b683cc275e7168665524bde388ef.sqlite";
}

let localSqliteInstance: any = null;

function getLocalSqlite(): any {
  if (!localSqliteInstance) {
    let DatabaseSync: any = null;
    try {
      DatabaseSync = (globalThis as any).process?.getBuiltinModule?.("node:sqlite")?.DatabaseSync;
      if (!DatabaseSync) {
        try {
          const { createRequire } = (globalThis as any).process?.getBuiltinModule?.("node:module") || {};
          if (createRequire) {
            DatabaseSync = createRequire(process.cwd())("node:sqlite")?.DatabaseSync;
          }
        } catch {}
      }
      if (!DatabaseSync) {
        const req = (globalThis as any).require;
        if (req) {
          DatabaseSync = req("node:sqlite")?.DatabaseSync;
        }
      }
    } catch {}

    if (DatabaseSync) {
      try {
        const targetDbPath = getActiveLocalDbPath();
        localSqliteInstance = new DatabaseSync(targetDbPath);
      } catch (e) {
        console.warn("Could not instantiate local node:sqlite:", e);
      }
    }
  }
  return localSqliteInstance;
}

export function getUniversalDb(d1Binding?: D1Database): UniversalDb {
  if (d1Binding && typeof (d1Binding as any).prepare === "function") {
    return {
      isD1: true,
      prepare: (query: string) => {
        return {
          bind: (...params: any[]) => {
            const stmt = d1Binding.prepare(query).bind(...params);
            return {
              all: async () => {
                const res = await stmt.all();
                return res.results || [];
              },
              get: async () => {
                const res = await stmt.first();
                return res || null;
              },
              run: async () => {
                const res = await stmt.run();
                return { changes: res.meta?.changes || 0, lastInsertRowid: res.meta?.last_row_id };
              },
            };
          },
          all: async (...params: any[]) => {
            const stmt = params.length > 0 ? d1Binding.prepare(query).bind(...params) : d1Binding.prepare(query);
            const res = await stmt.all();
            return res.results || [];
          },
          get: async (...params: any[]) => {
            const stmt = params.length > 0 ? d1Binding.prepare(query).bind(...params) : d1Binding.prepare(query);
            const res = await stmt.first();
            return res || null;
          },
          run: async (...params: any[]) => {
            const stmt = params.length > 0 ? d1Binding.prepare(query).bind(...params) : d1Binding.prepare(query);
            const res = await stmt.run();
            return { changes: res.meta?.changes || 0, lastInsertRowid: res.meta?.last_row_id };
          },
        };
      },
      exec: async (query: string) => {
        await d1Binding.exec(query);
      },
    };
  }

  // Fallback to local node:sqlite (when running via tsx src/server.ts)
  const localDb = getLocalSqlite();
  if (localDb) {
    return {
      isD1: false,
      prepare: (query: string) => ({
        bind: (...params: any[]) => ({
          all: async () => localDb.prepare(query).all(...params),
          get: async () => localDb.prepare(query).get(...params) ?? null,
          run: async () => localDb.prepare(query).run(...params),
        }),
        all: async (...params: any[]) => localDb.prepare(query).all(...params),
        get: async (...params: any[]) => localDb.prepare(query).get(...params) ?? null,
        run: async (...params: any[]) => localDb.prepare(query).run(...params),
      }),
      exec: async (query: string) => {
        localDb.exec(query);
      },
    };
  }

  // Memory fallback if nothing is available
  return {
    isD1: false,
    prepare: () => ({
      bind: () => ({
        all: async () => [],
        get: async () => null,
        run: async () => ({ changes: 0 }),
      }),
      all: async () => [],
      get: async () => null,
      run: async () => ({ changes: 0 }),
    }),
    exec: async () => {},
  };
}

export function getDb(): any {
  return getUniversalDb();
}
