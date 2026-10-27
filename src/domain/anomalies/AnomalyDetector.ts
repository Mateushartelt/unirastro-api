/**
 * Executor das regras de anomalia (RF04).
 *
 * Antes, a lista de regras era um array fixo dentro de lib/anomalyRules.ts, e cada regra nova
 * obrigava a editar esse arquivo. Agora o detector recebe as regras pelo construtor e so sabe
 * aplica-las: quais regras existem e decisao do composition root (OCP + DIP).
 */

import type { Anomaly, Order } from '../../types';
import { bySeverity } from '../severity';
import type { AnomalyRule } from './AnomalyRule';

export class AnomalyDetector {
  private readonly rules: readonly AnomalyRule[];

  /** A ordem do registro desempata anomalias de mesma severidade. */
  constructor(rules: readonly AnomalyRule[]) {
    this.rules = rules;
  }

  /** Roda todas as regras e devolve as anomalias encontradas, das mais graves para as menos. */
  detect(order: Order, now: Date = new Date()): Anomaly[] {
    return this.rules
      .map((rule) => rule.evaluate(order, now))
      .filter((anomaly): anomaly is Anomaly => anomaly !== null)
      .sort(bySeverity);
  }
}
