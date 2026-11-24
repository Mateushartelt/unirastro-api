/**
 * Encaminha cada encomenda para a integracao da sua transportadora.
 *
 * Cada transportadora com API propria (ex.: Shopee Xpress) tem um gateway; as demais caem no
 * gateway padrao (o agregador). Transportadora nova = uma entrada no mapa do composition root.
 */

import type { Carrier, Order } from '../types';
import type { ICarrierTrackingGateway, TrackingUpdate } from '../repositories/ports';

export class CarrierRouterGateway implements ICarrierTrackingGateway {
  private readonly byCarrier: Partial<Record<Carrier, ICarrierTrackingGateway>>;
  private readonly fallback: ICarrierTrackingGateway;

  constructor(byCarrier: Partial<Record<Carrier, ICarrierTrackingGateway>>, fallback: ICarrierTrackingGateway) {
    this.byCarrier = byCarrier;
    this.fallback = fallback;
  }

  fetchUpdate(order: Order): Promise<TrackingUpdate | null> {
    return (this.byCarrier[order.carrier] ?? this.fallback).fetchUpdate(order);
  }
}
