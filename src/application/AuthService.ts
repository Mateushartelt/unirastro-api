/**
 * Autenticacao (RF10).
 *
 * So confere credenciais e monta a sessao. Emitir e validar token e detalhe do transporte HTTP
 * (http/TokenSigner), e permissao e regra de dominio (src/domain/permissions.ts).
 */

import type { Session, User } from '../types';
import type { IUserDirectory } from '../repositories/ports';
import { failure, success, type Result } from './result';

export class AuthService {
  private readonly users: IUserDirectory;

  constructor(users: IUserDirectory) {
    this.users = users;
  }

  login(email: string, password: string): Result<Session> {
    const normalized = (email ?? '').trim().toLowerCase();

    if (!normalized || !password) {
      return failure('invalid', 'Informe e-mail e senha.', ['E-mail e senha são obrigatórios.']);
    }

    const user = this.users.findByEmail(normalized);

    // Mensagem unica para usuario inexistente e senha errada: nao vale entregar a um
    // desconhecido a informacao de quais e-mails existem na base.
    if (!user || user.password !== password) {
      return failure('unauthorized', 'Credenciais inválidas.', ['E-mail ou senha incorretos.']);
    }

    const session = this.toSession(user);
    return success(session, `Bem-vindo, ${session.name.split(' ')[0]}.`);
  }

  private toSession(user: User): Session {
    const tenant = this.users.findTenant(user.tenantId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: tenant?.name ?? 'Empresa',
    };
  }
}
