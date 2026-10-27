/**
 * Central de incidentes (RF04, RF06).
 *
 * Incidentes sao derivados das encomendas a cada consulta (funcoes puras de
 * src/domain/incidents). O que persiste e so a decisao humana de resolver.
 */

import type { AnomalyDetector } from '../domain/anomalies/AnomalyDetector';
import { compareIncidents, incidentsFromOrder } from '../domain/incidents/incidents';
import type { NotificationPolicy } from '../domain/incidents/NotificationPolicy';
import type { Incident, TenantId } from '../types';
import type {
  IIncidentResolutionRepository,
  IOrderRepository,
  ISystemIncidentRepository,
  ITriggerRepository,
} from '../repositories/ports';
import { success, type Result } from './result';

export interface IncidentsServiceDeps {
  orders: IOrderRepository;
  systemIncidents: ISystemIncidentRepository;
  resolutions: IIncidentResolutionRepository;
  triggers: ITriggerRepository;
  anomalies: AnomalyDetector;
  notifications: NotificationPolicy;
}

export class IncidentsService {
  private readonly deps: IncidentsServiceDeps;

  constructor(deps: IncidentsServiceDeps) {
    this.deps = deps;
  }

  list(tenantId: TenantId): Result<Incident[]> {
    const { orders, systemIncidents, resolutions, triggers, anomalies, notifications } = this.deps;

    const now = new Date();
    const activeTriggers = triggers.list();
    const context = {
      now,
      isResolved: (id: string) => resolutions.isResolved(tenantId, id),
      wasNotified: (rule: string) => notifications.wasNotified(rule, activeTriggers),
    };

    const derived = orders
      .listByTenant(tenantId)
      .flatMap((order) => incidentsFromOrder(order, anomalies.detect(order, now), context));

    const system = systemIncidents
      .listByTenant(tenantId)
      .map((i) => ({ ...i, resolved: context.isResolved(i.id) }));

    return success([...derived, ...system].sort(compareIncidents));
  }

  resolve(tenantId: TenantId, id: string): Result<null> {
    this.deps.resolutions.markResolved(tenantId, id);
    return success(null, 'Incidente marcado como resolvido');
  }

  reopen(tenantId: TenantId, id: string): Result<null> {
    this.deps.resolutions.reopen(tenantId, id);
    return success(null, 'Incidente reaberto');
  }
}
