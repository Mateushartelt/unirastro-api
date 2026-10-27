/**
 * Autenticacao e autorizacao das rotas.
 *
 * `authenticate` confere o token Bearer e guarda as claims em `res.locals.auth`. `authorize`
 * consulta a matriz de permissoes do dominio (src/domain/permissions.ts), a mesma que a
 * interface usa para esconder botoes. A diferenca e que aqui a regra e de fato aplicada.
 */

import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission } from '../domain/permissions';
import { sendFailure } from './envelope';
import type { AuthClaims, TokenSigner } from './TokenSigner';

export function authenticate(signer: TokenSigner) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const claims = token ? signer.verify(token) : null;

    if (!claims) {
      sendFailure(res, 401, 'Sessão expirada.', ['Faça login novamente.']);
      return;
    }

    res.locals.auth = claims;
    next();
  };
}

export function authorize(permission: Permission) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!hasPermission(authOf(res).role, permission)) {
      sendFailure(res, 403, 'Sem permissão.', ['Seu papel não permite esta ação.']);
      return;
    }
    next();
  };
}

/** Claims da requisicao atual. So existe depois de `authenticate`. */
export function authOf(res: Response): AuthClaims {
  return res.locals.auth as AuthClaims;
}
