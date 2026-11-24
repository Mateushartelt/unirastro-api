/**
 * Escolhe a transportadora por encomenda: as de demonstracao (semente) continuam na
 * transportadora simulada, e qualquer codigo cadastrado de verdade vai para a API real.
 *
 * Sem isso, ligar o rastreio real congelaria os dados de demonstracao, porque os codigos da
 * semente nao existem em transportadora nenhuma.
 */

import type { Order } from '../types';
import type { ICarrierTrackingGateway, TrackingUpdate } from '../repositories/ports';

export class DemoAwareCarrierGateway implements ICarrierTrackingGateway {
  private readonly real: ICarrierTrackingGateway;
  private readonly demo: ICarrierTrackingGateway;
  private readonly demoCodes: ReadonlySet<string>;

  constructor(real: ICarrierTrackingGateway, demo: ICarrierTrackingGateway, demoCodes: Iterable<string>) {
    this.real = real;
    this.demo = demo;
    this.demoCodes = new Set(demoCodes);
  }

  fetchUpdate(order: Order): Promise<TrackingUpdate | null> {
    const gateway = this.demoCodes.has(order.code) ? this.demo : this.real;
    return gateway.fetchUpdate(order);
  }
}
