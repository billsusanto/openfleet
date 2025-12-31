import { Hono } from "hono";
import { cors } from "hono/cors";

import { logger } from "../logger";
import { setupRoutes } from "./routes";

const DEFAULT_PORT = 4242;
const MAX_PORT_ATTEMPTS = 10;

export class ReviewServer {
  private app: Hono;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private port: number;
  private startTime: number = 0;

  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use("*", cors());

    this.app.use("*", async (c, next) => {
      const start = Date.now();
      await next();
      logger.debug("HTTP request", {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: Date.now() - start,
      });
    });
  }

  private setupRoutes(): void {
    setupRoutes(
      this.app,
      () => this.getUptime(),
      () => this.port,
    );
  }

  async start(): Promise<string> {
    if (this.server) {
      return `http://localhost:${this.port}`;
    }

    let attempts = 0;
    while (attempts < MAX_PORT_ATTEMPTS) {
      try {
        this.server = Bun.serve({
          port: this.port,
          hostname: "127.0.0.1",
          fetch: this.app.fetch,
        });
        this.startTime = Date.now();
        logger.info("Review server started", { port: this.port });
        return `http://localhost:${this.port}`;
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === "EADDRINUSE") {
          this.port++;
          attempts++;
          logger.debug("Port in use, trying next", { port: this.port });
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Could not find available port after ${MAX_PORT_ATTEMPTS} attempts`);
  }

  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
      logger.info("Review server stopped");
    }
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getUptime(): number {
    return this.server ? Date.now() - this.startTime : 0;
  }
}

let serverInstance: ReviewServer | null = null;

export function getReviewServer(): ReviewServer {
  if (!serverInstance) {
    serverInstance = new ReviewServer();
  }
  return serverInstance;
}

export async function startReviewServer(): Promise<string> {
  return getReviewServer().start();
}
