/**
 * Promocao de anomalias a incidentes da central (RF06).
 *
 * Os incidentes nao sao uma tabela. Sao derivados das encomendas a cada consulta, aplicando as
 * regras de anomalia. Uma lista gravada envelheceria em silencio, e um pacote que voltasse a
 * se mover continuaria aparecendo como parado. O que persiste e apenas a decisao humana:
 * quais incidentes o operador marcou como resolvidos.
 *
 * Esta logica morava dentro de services/alertsService.ts, misturada com acesso ao store,
 * latencia simulada e CRUD de gatilhos. Aqui ela fica pura: recebe dados, devolve dados.
 */

import type { Anomaly, Incident, Order } from '../../types';
import { SEVERITY_WEIGHT } from '../severity';

/**
 * Um incidente derivado precisa de identidade estavel entre consultas, senao "resolver" nao
 * gruda: a lista seria recalculada e o item voltaria como novo.
 */
export function incidentId(code: string, rule: string): string {
  return `${code}::${rule}`;
}

/** O que a derivacao precisa saber alem da encomenda e das anomalias dela. */
export interface IncidentContext {
  isResolved: (id: string) => boolean;
  wasNotified: (ruleName: string) => boolean;
  now: Date;
}

export function incidentsFromOrder(
  order: Order,
  anomalies: readonly Anomaly[],
  context: IncidentContext,
): Incident[] {
  return anomalies.map((anomaly) => {
    const id = incidentId(order.code, anomaly.rule);
    return {
      ...anomaly,
      id,
      tenantId: order.tenantId,
      code: order.code,
      carrier: order.carrier,
      // O incidente e tao recente quanto o evento que o revelou.
      detectedAt: order.timeline[0]?.at ?? context.now.toISOString(),
      notified: context.wasNotified(anomaly.rule),
      resolved: context.isResolved(id),
    };
  });
}

/** Abertos antes de resolvidos, mais graves antes de menos graves, recentes antes de antigos. */
export function compareIncidents(a: Incident, b: Incident): number {
  if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;

  const bySeverity = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
  if (bySeverity !== 0) return bySeverity;

  return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
}
