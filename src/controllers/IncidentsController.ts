/** Rotas da central de incidentes. */

import type { Request, Response } from 'express';
import type { IncidentsService } from '../application/IncidentsService';
import { authOf } from '../http/authMiddleware';
import { send } from '../http/envelope';

export class IncidentsController {
  private readonly incidents: IncidentsService;

  constructor(incidents: IncidentsService) {
    this.incidents = incidents;
  }

  list = (_req: Request, res: Response) => {
    send(res, this.incidents.list(authOf(res).tenantId));
  };

  resolve = (req: Request<{ id: string }>, res: Response) => {
    send(res, this.incidents.resolve(authOf(res).tenantId, req.params.id));
  };

  reopen = (req: Request<{ id: string }>, res: Response) => {
    send(res, this.incidents.reopen(authOf(res).tenantId, req.params.id));
  };
}
