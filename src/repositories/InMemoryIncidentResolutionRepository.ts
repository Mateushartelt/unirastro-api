/** Decisoes "resolvido" do operador, em memoria. A chave inclui o tenant. */

import type { TenantId } from '../types';
import type { IIncidentResolutionRepository } from './ports';

export class InMemoryIncidentResolutionRepository implements IIncidentResolutionRepository {
  private readonly resolved = new Set<string>();

  constructor(seed: readonly { tenantId: TenantId; id: string }[] = []) {
    seed.forEach(({ tenantId, id }) => this.resolved.add(key(tenantId, id)));
  }

  isResolved(tenantId: TenantId, id: string): boolean {
    return this.resolved.has(key(tenantId, id));
  }

  markResolved(tenantId: TenantId, id: string): void {
    this.resolved.add(key(tenantId, id));
  }

  reopen(tenantId: TenantId, id: string): void {
    this.resolved.delete(key(tenantId, id));
  }
}

function key(tenantId: TenantId, id: string): string {
  return `${tenantId}|${id}`;
}
