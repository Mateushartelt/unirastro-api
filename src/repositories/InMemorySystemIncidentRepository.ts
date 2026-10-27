/** Incidentes de infraestrutura em memoria. */

import type { Incident, TenantId } from '../types';
import type { ISystemIncidentRepository } from './ports';

export class InMemorySystemIncidentRepository implements ISystemIncidentRepository {
  private readonly incidents: Incident[];

  constructor(seed: readonly Incident[]) {
    this.incidents = structuredClone([...seed]);
  }

  listByTenant(tenantId: TenantId): Incident[] {
    return this.incidents.filter((i) => i.tenantId === tenantId);
  }
}
