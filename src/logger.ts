import { appendFileSync, existsSync } from "fs";
import { join } from "path";

import { OPENFLEET_DIR } from "./config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_FILE = join(OPENFLEET_DIR, "openfleet.log");

let dirVerified = false;

function writeLog(level: LogLevel, msg: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : "";
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${msg}${formattedArgs}\n`;

  if (!dirVerified) {
    if (!existsSync(OPENFLEET_DIR)) {
      throw new Error(
        `[openfleet] .openfleet directory not initialized. Call initializeDirectories() first.`,
      );
    }
    dirVerified = true;
  }

  appendFileSync(LOG_FILE, logLine, "utf-8");
}

const logger = {
  debug: (msg: string, ...args: unknown[]) => writeLog("debug", msg, ...args),
  info: (msg: string, ...args: unknown[]) => writeLog("info", msg, ...args),
  warn: (msg: string, ...args: unknown[]) => writeLog("warn", msg, ...args),
  error: (msg: string, ...args: unknown[]) => writeLog("error", msg, ...args),
};

export { logger, type LogLevel };
