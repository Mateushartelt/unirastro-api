/**
 * Decorator que registra no console cada consulta a transportadora: qual codigo, quanto tempo
 * levou e o que voltou. Serve para enxergar que a chamada a API real acontece de fato.
 *
 * Envolve qualquer ICarrierTrackingGateway sem alterar a classe envolvida (OCP).
 */

import type { Order } from '../types';
import type { ICarrierTrackingGateway, TrackingUpdate } from '../repositories/ports';

export class LoggingCarrierGateway implements ICarrierTrackingGateway {
  private readonly inner: ICarrierTrackingGateway;
  private readonly label: string;
  private readonly log: (line: string) => void;

  constructor(inner: ICarrierTrackingGateway, label: string, log: (line: string) => void = console.log) {
    this.inner = inner;
    this.label = label;
    this.log = log;
  }

  async fetchUpdate(order: Order): Promise<TrackingUpdate | null> {
    const started = Date.now();
    const prefix = `[${this.label}] ${order.carrier} ${order.code}`;
    try {
      const update = await this.inner.fetchUpdate(order);
      this.log(`${prefix} -> ${describe(update)} (${Date.now() - started} ms)`);
      return update;
    } catch (error) {
      this.log(`${prefix} -> falhou: ${(error as Error).message} (${Date.now() - started} ms)`);
      throw error;
    }
  }
}

function describe(update: TrackingUpdate | null): string {
  if (!update) return 'sem movimentação nova';
  return `${update.events.length} evento(s) novo(s), status "${update.status}", último: ${update.events[0].title}`;
}
