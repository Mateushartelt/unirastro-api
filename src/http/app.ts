/**
 * Aplicacao Express: rotas, autenticacao e tratamento de erro.
 *
 * Recebe os controllers prontos. Nao cria nada: quem monta as pecas e o composition root.
 */

import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import type { AuthController } from '../controllers/AuthController';
import type { IncidentsController } from '../controllers/IncidentsController';
import type { OrdersController } from '../controllers/OrdersController';
import type { TriggersController } from '../controllers/TriggersController';
import type { WorkersController } from '../controllers/WorkersController';
import { authenticate, authorize } from './authMiddleware';
import { sendFailure } from './envelope';
import type { TokenSigner } from './TokenSigner';

export interface Controllers {
  auth: AuthController;
  orders: OrdersController;
  incidents: IncidentsController;
  triggers: TriggersController;
  workers: WorkersController;
}

export function createApp(controllers: Controllers, signer: TokenSigner) {
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(controllers, signer));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function createApiRouter(controllers: Controllers, signer: TokenSigner): Router {
  const { auth, orders, incidents, triggers, workers } = controllers;
  const api = express.Router();

  api.post('/auth/login', auth.login);
  api.post('/auth/logout', auth.logout);
  api.get('/demo-accounts', auth.demo);

  // Daqui para baixo, toda rota exige token e le o tenant dele
  api.use(authenticate(signer));

  api.get('/encomendas', orders.list);
  api.post('/encomendas', authorize('createOrders'), orders.create);
  api.get('/encomendas/:code', orders.get);
  api.post('/encomendas/:code/consultar', orders.refresh);

  api.get('/incidentes', incidents.list);
  api.post('/incidentes/:id/resolver', authorize('resolveIncidents'), incidents.resolve);
  api.post('/incidentes/:id/reabrir', authorize('resolveIncidents'), incidents.reopen);

  api.get('/gatilhos', triggers.list);
  api.patch('/gatilhos/:id', authorize('editTriggers'), triggers.toggle);

  api.get('/workers/status', workers.status);
  return api;
}

function notFoundHandler(_req: Request, res: Response): void {
  sendFailure(res, 404, 'Rota não encontrada.');
}

/** Erro inesperado vira envelope 500, nunca stack trace para o cliente. */
function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof SyntaxError) {
    sendFailure(res, 400, 'JSON inválido.');
    return;
  }
  console.error(err);
  sendFailure(res, 500, 'Erro interno.', ['Tente novamente em instantes.']);
}
