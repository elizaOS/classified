import { type IAgentRuntime } from '@elizaos/core';
import cors from 'cors';
import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { AutonomyLogger } from './logging';
import { OODALoopService } from './ooda-service';
import type { OODAContext, OODAPhase, Goal, LogLevel } from './types';

interface QueryParams {
  runId?: string;
  phase?: OODAPhase;
  level?: LogLevel;
  limit?: string;
}

interface GoalUpdateBody {
  progress: number;
}

export class AutonomyAPIServer {
  private app: express.Application;
  private server: HttpServer;
  private io: Server;
  private logger: AutonomyLogger;
  private oodaService: OODALoopService | null = null;
  private port: number;

  constructor(
    private runtime: IAgentRuntime,
    port: number = 3001
  ) {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    this.logger = new AutonomyLogger(runtime);
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`API Request: ${req.method} ${req.path}`, {
        query: req.query,
        body: req.body,
      });
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        agent: this.runtime.agentId,
        oodaActive: this.oodaService !== null,
        timestamp: Date.now(),
      });
    });

    // Get current OODA context
    this.app.get('/api/ooda/context', (req: Request, res: Response) => {
      if (!this.oodaService) {
        return res.status(503).json({ error: 'OODA service not initialized' });
      }

      const context = (this.oodaService as unknown as { currentContext?: OODAContext })
        .currentContext;
      if (!context) {
        return res.status(404).json({ error: 'No active OODA context' });
      }

      res.json(context);
    });

    // Get OODA metrics
    this.app.get('/api/ooda/metrics', (req: Request, res: Response) => {
      if (!this.oodaService) {
        return res.status(503).json({ error: 'OODA service not initialized' });
      }

      const context = (this.oodaService as unknown as { currentContext?: OODAContext })
        .currentContext;
      if (!context) {
        return res.status(404).json({ error: 'No active OODA context' });
      }

      res.json(context.metrics);
    });

    // Get logs
    this.app.get('/api/logs', async (req: Request<{}, {}, {}, QueryParams>, res: Response) => {
      const { runId, phase, level, limit = '100' } = req.query;

      try {
        const logs = await this.logger.queryLogs({
          runId: runId as string,
          phase: phase as OODAPhase,
          level: level as LogLevel,
          limit: parseInt(limit, 10),
        });

        res.json(logs);
      } catch (error) {
        res
          .status(500)
          .json({ error: 'Failed to retrieve logs', details: (error as Error).message });
      }
    });

    // Get goals
    this.app.get('/api/goals', (req: Request, res: Response) => {
      if (!this.oodaService) {
        return res.status(503).json({ error: 'OODA service not initialized' });
      }

      const goals = (this.oodaService as unknown as { goals: Goal[] }).goals;
      res.json(goals);
    });

    // Update goal progress
    this.app.put(
      '/api/goals/:id/progress',
      (req: Request<{ id: string }, {}, GoalUpdateBody>, res: Response) => {
        if (!this.oodaService) {
          return res.status(503).json({ error: 'OODA service not initialized' });
        }

        const { id } = req.params;
        const { progress } = req.body;

        const goals = (this.oodaService as unknown as { goals: Goal[] }).goals;
        const goal = goals.find((g: Goal) => g.id === id);

        if (!goal) {
          return res.status(404).json({ error: 'Goal not found' });
        }

        goal.progress = progress;
        res.json(goal);
      }
    );

    // Get recent observations
    this.app.get('/api/observations', (req: Request, res: Response) => {
      if (!this.oodaService) {
        return res.status(503).json({ error: 'OODA service not initialized' });
      }

      const context = (this.oodaService as unknown as { currentContext?: OODAContext })
        .currentContext;
      if (!context) {
        return res.status(404).json({ error: 'No active OODA context' });
      }

      res.json(context.observations);
    });

    // Get recent actions
    this.app.get('/api/actions', (req: Request, res: Response) => {
      if (!this.oodaService) {
        return res.status(503).json({ error: 'OODA service not initialized' });
      }

      const context = (this.oodaService as unknown as { currentContext?: OODAContext })
        .currentContext;
      if (!context) {
        return res.status(404).json({ error: 'No active OODA context' });
      }

      res.json(context.actions);
    });

    // Error handler
    const errorHandler: ErrorRequestHandler = (
      err: Error,
      req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      this.logger.error('API Server Error', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    };
    this.app.use(errorHandler);
  }

  private setupWebSocket() {
    this.io.on('connection', (socket) => {
      this.logger.info('WebSocket client connected', { socketId: socket.id });

      // Send initial state
      if (this.oodaService) {
        const context = (this.oodaService as unknown as { currentContext?: OODAContext })
          .currentContext;
        if (context) {
          socket.emit('ooda:context', context);
        }
      }

      socket.on('disconnect', () => {
        this.logger.info('WebSocket client disconnected', { socketId: socket.id });
      });

      // Allow clients to request specific data
      socket.on('request:context', () => {
        if (this.oodaService) {
          const context = (this.oodaService as unknown as { currentContext?: OODAContext })
            .currentContext;
          socket.emit('ooda:context', context);
        }
      });

      socket.on('request:metrics', () => {
        if (this.oodaService) {
          const context = (this.oodaService as unknown as { currentContext?: OODAContext })
            .currentContext;
          if (context) {
            socket.emit('ooda:metrics', context.metrics);
          }
        }
      });
    });
  }

  setOODAService(service: OODALoopService) {
    this.oodaService = service;

    // Hook into OODA events to broadcast updates
    const serviceWithInternals = service as unknown as {
      executeOODACycle: () => Promise<unknown>;
      currentContext?: OODAContext;
    };
    const originalExecute = serviceWithInternals.executeOODACycle;

    serviceWithInternals.executeOODACycle = async function (this: AutonomyAPIServer) {
      const result = await originalExecute.call(serviceWithInternals);

      // Broadcast updates
      if (serviceWithInternals.currentContext) {
        this.io.emit('ooda:context', serviceWithInternals.currentContext);
        this.io.emit('ooda:metrics', serviceWithInternals.currentContext.metrics);
      }

      return result;
    }.bind(this);
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        this.logger.info(`Autonomy API Server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.io.disconnectSockets();
      this.server.close(() => {
        this.logger.info('Autonomy API Server stopped');
        resolve();
      });
    });
  }
}
