/**
 * Risco de atraso preditivo.
 *
 * A regra mais valiosa das quatro, porque dispara enquanto ainda da tempo de agir. Se o prazo
 * termina hoje ou amanha e o pacote sequer saiu para entrega, o atraso e praticamente certo,
 * mesmo que nada ate aqui pareca errado.
 */

import type { Anomaly, Order } from '../../../types';
import { calendarDaysUntil } from '../../time';
import type { AnomalyRule } from '../AnomalyRule';

/** Dentro dessa janela, um pacote que ainda nao saiu para entrega dificilmente chega no prazo. */
const PREDICTIVE_DELAY_DAYS = 1;

export class PredictiveDelayRiskRule implements AnomalyRule {
  readonly name = 'Risco de atraso preditivo';
  readonly triggerId = 'late';

  private readonly windowDays: number;

  constructor(windowDays: number = PREDICTIVE_DELAY_DAYS) {
    this.windowDays = windowDays;
  }

  evaluate(order: Order, now: Date): Anomaly | null {
    if (order.status === 'Entregue' || order.status === 'Saiu p/ entrega') return null;

    const daysLeft = calendarDaysUntil(order.dueAt, now);
    if (daysLeft > this.windowDays) return null;

    const when = daysLeft < 0 ? 'venceu' : daysLeft === 0 ? 'vence hoje' : 'vence amanhã';

    const situation =
      daysLeft < 0
        ? `Prazo vencido há ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) === 1 ? '' : 's'}`
        : daysLeft === 0
          ? 'Prazo termina hoje'
          : 'Prazo termina amanhã';

    return {
      rule: this.name,
      severity: 'Crítico',
      title: `Prazo ${when} e pacote ainda não saiu para entrega`,
      description:
        `${situation} e o status ainda é "${order.status}". ` +
        'Janela suficiente para avisar o cliente final com nova estimativa antes da reclamação.',
    };
  }
}
