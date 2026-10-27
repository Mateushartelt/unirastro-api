/**
 * Rotas de encomendas. So traduz HTTP <-> caso de uso: o tenant vem do token, o corpo vira
 * NewOrderInput, e o Result vira status + envelope. Nenhuma regra de negocio aqui.
 */

import type { Request, Response } from 'express';
import type { OrdersService } from '../application/OrdersService';
import { authOf } from '../http/authMiddleware';
import { send } from '../http/envelope';

export class OrdersController {
  private readonly orders: OrdersService;

  constructor(orders: OrdersService) {
    this.orders = orders;
  }

  list = (_req: Request, res: Response) => {
    send(res, this.orders.list(authOf(res).tenantId));
  };

  get = (req: Request<{ code: string }>, res: Response) => {
    send(res, this.orders.get(authOf(res).tenantId, req.params.code));
  };

  create = (req: Request, res: Response) => {
    const { code, recipient, city } = req.body ?? {};
    const input = { code: String(code ?? ''), recipient: String(recipient ?? ''), city: String(city ?? '') };
    send(res, this.orders.create(authOf(res).tenantId, input), 201);
  };

  refresh = (req: Request<{ code: string }>, res: Response) => {
    send(res, this.orders.refresh(authOf(res).tenantId, req.params.code));
  };
}
