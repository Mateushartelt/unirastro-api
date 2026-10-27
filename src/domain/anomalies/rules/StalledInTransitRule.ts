/**
 * Parada prolongada.
 *
 * Mede ha quanto tempo o ultimo evento foi registrado. Se o pacote nao se move ha mais que o
 * limite e ainda nao foi entregue, algo travou: extravio interno, falta de veiculo na rota,
 * ou carga retida.
 */

import type { Anomaly, Order } from '../../../types';
import { calendarDaysUntil, hoursBetween } from '../../time';
import type { AnomalyRule } from '../AnomalyRule';

/**
 * Acima disso, um pacote parado na mesma unidade deixa de ser transito normal e vira
 * incidente. O valor espelha o gatilho "> 36h na mesma unidade" configurado na tela de
 * alertas: o que o operador parametriza e o que a regra aplica precisam ser o mesmo numero.
 */
export const STALL_THRESHOLD_HOURS = 36;

/** Tempo medio de permanencia numa unidade de tratamento, usado so para dar escala ao texto. */
const AVERAGE_HUB_DWELL_HOURS = 16;

export class StalledInTransitRule implements AnomalyRule {
  readonly name = 'Parada prolongada';
  readonly triggerId = 'stall';

  private readonly thresholdHours: number;

  constructor(thresholdHours: number = STALL_THRESHOLD_HOURS) {
    this.thresholdHours = thresholdHours;
  }

  evaluate(order: Order, now: Date): Anomaly | null {
    if (order.status === 'Entregue') return null;

    const last = order.timeline[0];
    if (!last) return null;

    const stalledHours = Math.floor(hoursBetween(last.at, now));
    if (stalledHours <= this.thresholdHours) return null;

    const ratio = (stalledHours / AVERAGE_HUB_DWELL_HOURS).toFixed(1).replace('.', ',');
    const daysLeft = calendarDaysUntil(order.dueAt, now);
    const deadline =
      daysLeft <= 1
        ? ` Prazo final ${daysLeft === 0 ? 'hoje' : 'em 1 dia'} — risco concreto de atraso.`
        : '';

    return {
      rule: this.name,
      severity: daysLeft <= 1 ? 'Crítico' : 'Atenção',
      title: `Pacote parado ${stalledHours}h em ${last.place}`,
      description:
        `Tempo na unidade ${ratio}× acima da média histórica.` +
        deadline +
        ' Recomendado acionar a transportadora antes de comunicar nova estimativa.',
    };
  }
}
