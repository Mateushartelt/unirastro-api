/** Rotas dos gatilhos de notificacao. */

import type { Request, Response } from 'express';
import type { TriggersService } from '../application/TriggersService';
import { send } from '../http/envelope';

export class TriggersController {
  private readonly triggers: TriggersService;

  constructor(triggers: TriggersService) {
    this.triggers = triggers;
  }

  list = (_req: Request, res: Response) => {
    send(res, this.triggers.list());
  };

  toggle = (req: Request<{ id: string }>, res: Response) => {
    send(res, this.triggers.toggle(req.params.id));
  };
}
