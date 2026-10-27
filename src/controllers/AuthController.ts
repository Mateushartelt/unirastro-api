/** Rotas de autenticacao. Traduz HTTP para o AuthService e emite o token da sessao. */

import type { Request, Response } from 'express';
import type { AuthService } from '../application/AuthService';
import { send } from '../http/envelope';
import type { TokenSigner } from '../http/TokenSigner';
import type { IDemoAccountDirectory } from '../repositories/ports';

export class AuthController {
  private readonly auth: AuthService;
  private readonly signer: TokenSigner;
  private readonly demoAccounts: IDemoAccountDirectory;

  constructor(auth: AuthService, signer: TokenSigner, demoAccounts: IDemoAccountDirectory) {
    this.auth = auth;
    this.signer = signer;
    this.demoAccounts = demoAccounts;
  }

  login = (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    const result = this.auth.login(String(email ?? ''), String(password ?? ''));

    if (!result.ok) return send(res, result);

    const session = result.data;
    const token = this.signer.sign({
      userId: session.id,
      tenantId: session.tenantId,
      role: session.role,
    });
    send(res, { ...result, data: { session, token } });
  };

  /** Token sem estado: encerrar a sessao e o cliente descartar o token. */
  logout = (_req: Request, res: Response) => {
    send(res, { ok: true, data: null, message: 'Sessão encerrada.' });
  };

  demo = (_req: Request, res: Response) => {
    send(res, { ok: true, data: this.demoAccounts.listDemoAccounts(), message: '' });
  };
}
