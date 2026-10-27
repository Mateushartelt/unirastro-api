/**
 * Contas e empresas em memoria (RF10).
 *
 * Implementa duas portas: IUserDirectory, usada pela autenticacao, e IDemoAccountDirectory,
 * usada pela rota que lista as contas de teste na tela de login.
 */

import type { Tenant, TenantId, User } from '../types';
import type { IDemoAccountDirectory, IUserDirectory } from './ports';

export class InMemoryUserDirectory implements IUserDirectory, IDemoAccountDirectory {
  private readonly users: readonly User[];
  private readonly tenants: readonly Tenant[];

  constructor(users: readonly User[], tenants: readonly Tenant[]) {
    this.users = users;
    this.tenants = tenants;
  }

  findByEmail(email: string): User | null {
    const normalized = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }

  findTenant(tenantId: TenantId): Tenant | null {
    return this.tenants.find((t) => t.id === tenantId) ?? null;
  }

  listDemoAccounts() {
    return this.users.map((u) => ({
      email: u.email,
      password: u.password,
      role: u.role,
      tenant: this.findTenant(u.tenantId)?.name ?? 'Empresa',
    }));
  }
}
