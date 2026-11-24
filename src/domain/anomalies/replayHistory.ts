/**
 * Reprocessa o historico de uma encomenda como se o UNIRASTRO a monitorasse desde o inicio.
 *
 * Para cada intervalo entre dois eventos, monta a encomenda como ela estava naquele momento
 * (so os eventos ate ali) e roda as regras de anomalia. Se uma regra dispara no intervalo, uma
 * busca binaria acha o instante em que ela teria disparado pela primeira vez: a parada
 * prolongada, por exemplo, nasce 36h depois do ultimo evento, nao no evento.
 *
 * Funcao pura: recebe a encomenda e o detector, devolve as anomalias passadas. O ultimo
 * intervalo (do evento mais recente ate agora) fica de fora, porque e o presente e as regras
 * ja o avaliam a cada consulta.
 */

import type { Order, PastAnomaly, TrackingEvent } from '../../types';
import type { AnomalyDetector } from './AnomalyDetector';

/** Precisao da busca pelo instante do disparo. */
const SEARCH_PRECISION_MS = 60_000;

export function replayHistory(order: Order, detector: AnomalyDetector): PastAnomaly[] {
  const events = chronological(order.timeline);
  const found: PastAnomaly[] = [];
  let activeBefore = new Set<string>();

  for (let i = 0; i < events.length - 1; i++) {
    const snapshot = orderAt(order, events.slice(0, i + 1));
    const gapStart = new Date(events[i].at).getTime();
    const gapEnd = new Date(events[i + 1].at).getTime();

    // O pior momento do intervalo e logo antes do proximo evento.
    const anomalies = detector.detect(snapshot, new Date(gapEnd - 1));
    const active = new Set(anomalies.map((a) => a.rule));

    for (const anomaly of anomalies) {
      // A mesma anomalia seguindo de um intervalo para o outro e um incidente so.
      if (activeBefore.has(anomaly.rule)) continue;

      const firedAt = firstFiring(snapshot, detector, anomaly.rule, gapStart, gapEnd);
      found.push({
        ...anomaly,
        detectedAt: new Date(firedAt).toISOString(),
        endedAt: events[i + 1].at,
      });
    }
    activeBefore = active;
  }

  return found;
}

/** A encomenda como estava depois destes eventos: nem entregue, nem com o futuro. */
function orderAt(order: Order, eventsSoFar: TrackingEvent[]): Order {
  return { ...order, status: 'Em trânsito', timeline: [...eventsSoFar].reverse() };
}

/** Primeiro instante do intervalo em que a regra dispara (as regras so pioram com o tempo). */
function firstFiring(
  snapshot: Order,
  detector: AnomalyDetector,
  rule: string,
  start: number,
  end: number,
): number {
  const fires = (t: number) => detector.detect(snapshot, new Date(t)).some((a) => a.rule === rule);
  if (fires(start)) return start;

  let low = start;
  let high = end - 1;
  while (high - low > SEARCH_PRECISION_MS) {
    const mid = Math.floor((low + high) / 2);
    if (fires(mid)) high = mid;
    else low = mid;
  }
  return high;
}

function chronological(timeline: readonly TrackingEvent[]): TrackingEvent[] {
  return [...timeline].sort((a, b) => a.at.localeCompare(b.at));
}
