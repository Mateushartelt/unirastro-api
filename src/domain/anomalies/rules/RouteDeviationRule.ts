/**
 * Desvio de rota.
 *
 * Compara cada parada registrada com o plano de rota informado pela transportadora. Uma
 * parada fora do plano costuma significar carga embarcada no veiculo errado, e quase sempre
 * custa dias.
 */

import type { Anomaly, Order } from '../../../types';
import { calendarDaysUntil } from '../../time';
import type { AnomalyRule } from '../AnomalyRule';

export class RouteDeviationRule implements AnomalyRule {
  readonly name = 'Rota desviada';
  readonly triggerId = 'route';

  evaluate(order: Order, now: Date): Anomaly | null {
    if (order.status === 'Entregue') return null;
    if (order.plannedRoute.length === 0) return null;

    const planned = new Set(order.plannedRoute);
    const offRoute = order.timeline.filter((e) => !planned.has(e.place));
    if (offRoute.length === 0) return null;

    const worst = offRoute[0];
    const daysLeft = calendarDaysUntil(order.dueAt, now);

    return {
      rule: this.name,
      severity: daysLeft <= 1 ? 'Crítico' : 'Atenção',
      title: `Desvio de rota detectado (${worst.place})`,
      description:
        `Pacote com destino ${order.city} registrado em ${worst.place}, fora do trajeto ` +
        `previsto (${order.plannedRoute.join(' → ')}).` +
        (daysLeft > 1 ? ' Prazo ainda dentro da margem.' : ' Prazo comprometido.'),
    };
  }
}
