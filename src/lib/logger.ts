type LogLevel = "info" | "warn" | "error";

interface LogContext {
  route?: string;
  role?: string;
  userId?: string;
  familyId?: string;
  durationMs?: number;
  status?: number;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, ctx?: LogContext): string {
  return JSON.stringify({ level, msg: message, ...ctx, ts: new Date().toISOString() });
}

export const log = {
  info(msg: string, ctx?: LogContext) {
    console.log(formatLog("info", msg, ctx));
  },
  warn(msg: string, ctx?: LogContext) {
    console.warn(formatLog("warn", msg, ctx));
  },
  error(msg: string, ctx?: LogContext) {
    console.error(formatLog("error", msg, ctx));
  },
};

export function routeLogger(method: string, path: string) {
  const route = `${method} ${path}`;
  const start = Date.now();
  return {
    info(msg: string, ctx?: Omit<LogContext, "route">) {
      log.info(msg, { route, ...ctx });
    },
    warn(msg: string, ctx?: Omit<LogContext, "route">) {
      log.warn(msg, { route, ...ctx });
    },
    error(msg: string, ctx?: Omit<LogContext, "route">) {
      log.error(msg, { route, ...ctx });
    },
    done(msg: string, ctx?: Omit<LogContext, "route" | "durationMs">) {
      log.info(msg, { route, durationMs: Date.now() - start, ...ctx });
    },
  };
}