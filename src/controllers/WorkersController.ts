/** Rota do status dos workers de rastreio. */

import type { Request, Response } from 'express';
import type { WorkerStatusService } from '../application/WorkerStatusService';
import { send } from '../http/envelope';

export class WorkersController {
  private readonly workers: WorkerStatusService;

  constructor(workers: WorkerStatusService) {
    this.workers = workers;
  }

  status = (_req: Request, res: Response) => {
    send(res, this.workers.get());
  };
}
