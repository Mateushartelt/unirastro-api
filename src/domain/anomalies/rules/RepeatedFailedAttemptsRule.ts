/**
 * Tentativas de entrega frustradas.
 *
 * Uma tentativa perdida acontece. Duas indicam que o endereco ou o horario estao errados, e
 * uma terceira tentativa cega tende a falhar igual. O valor aqui e sugerir contato antes.
 */

import type { Anomaly, Order, TrackingEvent } from '../../../types';
import type { AnomalyRule } from '../AnomalyRule';

/** A partir da segunda tentativa frustrada, insistir sem falar com o cliente tende a falhar. */
const FAILED_ATTEMPTS_THRESHOLD = 2;

const ORDINALS = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta'];

export class RepeatedFailedAttemptsRule implements AnomalyRule {
  readonly name = 'Tentativa frustrada';
  readonly triggerId = 'fail';

  private readonly threshold: number;

  constructor(threshold: number = FAILED_ATTEMPTS_THRESHOLD) {
    this.threshold = threshold;
  }

  evaluate(order: Order): Anomaly | null {
    const attempts = order.timeline.filter(isFailedAttempt);
    if (attempts.length < this.threshold) return null;

    const place = attempts[0].place;

    return {
      rule: this.name,
      severity: 'Crítico',
      title: `${ordinal(attempts.length)} tentativa frustrada em ${place}`,
      description:
        `Foram ${attempts.length} tentativas sem sucesso no mesmo endereço. ` +
        'Sugerido contato com o destinatário para confirmar endereço e janela de entrega ' +
        'antes da próxima tentativa.',
    };
  }
}

function isFailedAttempt(event: TrackingEvent): boolean {
  const t = event.title.toLowerCase();
  return t.includes('tentativa') && (t.includes('não efetuada') || t.includes('frustrada'));
}

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}ª`;
}
