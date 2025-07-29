declare global {
  const process: {
    env: Record<string, string | undefined>;
    exit: (code?: number) => never;
    pid: number;
    platform: string;
    argv: string[];
    cwd: () => string;
    uptime: () => number;
    on: (
      event: string,
      listener: (...args: unknown[]) => void
    ) => NodeJS.Process;
  };

  interface BunServeOptions {
    port?: number;
    hostname?: string;
    development?: boolean;
    error?: (error: Error) => Response | Promise<Response>;
    fetch: (request: Request, server: unknown) => Response | Promise<Response>;
  }

  interface BunServer {
    port: number;
    hostname: string;
    stop(): void;
  }

  const Bun: {
    main?: string;
    serve: (options: BunServeOptions) => BunServer;
    [key: string]: unknown;
  };

  interface ImportMeta {
    main?: boolean;
  }
}

export {};
