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

import type { Order, TrackingEvent } from '../types';
import type { ICarrierTrackingGateway, TrackingUpdate } from '../repositories/ports';

type Step = Pick<TrackingEvent, 'title' | 'place' | 'rawCode'> & { status: Order['status'] };

export class SimulatedCarrierGateway implements ICarrierTrackingGateway {
  fetchUpdate(order: Order): TrackingUpdate | null {
    const step = nextStep(order);
    if (!step) return null;

    const { status, ...event } = step;
    return { event: { ...event, at: new Date().toISOString() }, status };
  }
}

function nextStep(order: Order): Step | null {
  if (order.status === 'Entregue') return null;

  if (order.timeline.every((e) => e.rawCode === 'LOCAL')) {
    return { title: 'Objeto postado', place: order.origin, rawCode: 'PST', status: 'Postado' };
  }

  if (order.status === 'Saiu p/ entrega') {
    return { title: 'Entregue', place: order.city, rawCode: 'DLV', status: 'Entregue' };
  }

  const visited = new Set(order.timeline.map((e) => e.place));
  const remaining = order.plannedRoute.filter((place) => !visited.has(place));
  const onlyDestinationLeft = remaining.length === 0 || remaining.at(-1) === order.city;

  if (!onlyDestinationLeft) {
    return { title: 'Objeto em trânsito', place: remaining[0], rawCode: 'TRN', status: 'Em trânsito' };
  }

  return arrivalStep(order.city, visited.has(order.city));
}

/** Perto do destino: chega na unidade e, na consulta seguinte, sai para entrega. */
function arrivalStep(city: string, alreadyArrived: boolean): Step {
  if (alreadyArrived) {
    return { title: 'Saiu para entrega', place: city, rawCode: 'OUT', status: 'Saiu p/ entrega' };
  }
  return {
    title: 'Chegada na unidade de destino',
    place: city,
    rawCode: 'ARR',
    status: 'Em trânsito',
  };
}
