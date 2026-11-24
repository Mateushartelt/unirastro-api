/**
 * Transportadora aceita no cadastro, mas sem integracao de rastreio real.
 *
 * Nunca traz movimentacao: a encomenda fica com o que foi cadastrado. Quando houver API para a
 * transportadora, ela ganha um gateway proprio no CarrierRouterGateway e sai daqui.
 */

import type { ICarrierTrackingGateway, TrackingUpdate } from '../repositories/ports';

export class UntrackedCarrierGateway implements ICarrierTrackingGateway {
  async fetchUpdate(): Promise<TrackingUpdate | null> {
    return null;
  }
}
