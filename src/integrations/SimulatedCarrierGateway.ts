/**
 * Transportadora simulada (RF02).
 *
 * Implementa ICarrierTrackingGateway, a mesma porta que uma integracao real (Correios,
 * Jadlog...) vai implementar. Trocar a simulacao pela API de verdade e escrever outra classe,
 * sem editar o servico de encomendas (OCP).
 *
 * Percorre a rota planejada e avanca uma parada por consulta, ate a entrega. A primeira consulta
 * de uma encomenda recem cadastrada devolve a postagem na origem.
 */

import type { Order } from '../types';
import type { ICarrierTrackingGateway, TrackingUpdate } from '../repositories/ports';

export class SimulatedCarrierGateway implements ICarrierTrackingGateway {
  fetchUpdate(order: Order): TrackingUpdate | null {
    if (order.status === 'Entregue') return null;

    const at = new Date().toISOString();

    if (order.timeline.every((e) => e.rawCode === 'LOCAL')) {
      return {
        event: { title: 'Objeto postado', place: order.origin, at, rawCode: 'PST' },
        status: 'Postado',
      };
    }

    const visited = new Set(order.timeline.map((e) => e.place));
    const remaining = order.plannedRoute.filter((place) => !visited.has(place));

    if (order.status === 'Saiu p/ entrega') {
      return {
        event: { title: 'Entregue', place: order.city, at, rawCode: 'DLV' },
        status: 'Entregue',
      };
    }

    if (remaining.length === 0 || remaining[remaining.length - 1] === order.city) {
      if (visited.has(order.city)) {
        return {
          event: { title: 'Saiu para entrega', place: order.city, at, rawCode: 'OUT' },
          status: 'Saiu p/ entrega',
        };
      }
      return {
        event: { title: 'Chegada na unidade de destino', place: order.city, at, rawCode: 'ARR' },
        status: 'Em trânsito',
      };
    }

    return {
      event: { title: 'Objeto em trânsito', place: remaining[0], at, rawCode: 'TRN' },
      status: 'Em trânsito',
    };
  }
}
