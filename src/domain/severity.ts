/**
 * Ordem de gravidade das severidades.
 *
 * Existia duplicada em lib/anomalyRules.ts e em services/alertsService.ts. Duas copias da
 * mesma regra de negocio acabam divergindo, entao ela passa a morar num lugar so.
 */

import type { Severity } from '../types';

export const SEVERITY_WEIGHT: Record<Severity, number> = { 'Crítico': 0, 'Atenção': 1, Info: 2 };

/** Comparador: mais grave primeiro. */
export function bySeverity(a: { severity: Severity }, b: { severity: Severity }): number {
  return SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
}
