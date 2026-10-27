/**
 * Teste de unidade do OrdersService com dublês nas portas.
 *
 * So e possivel porque o servico depende de interfaces (DIP): a transportadora e o publicador
 * de alertas sao trocados por objetos de teste sem tocar no servico.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnomalyDetector } from '../src/domain/anomalies/AnomalyDetector';
import { StalledInTransitRule } from '../src/domain/anomalies/rules/StalledInTransitRule';
import { CarrierDetector } from '../src/domain/carriers/CarrierDetector';
import { CARRIER_PATTERNS } from '../src/domain/carriers/carrierPatterns';
import { NotificationPolicy } from '../src/domain/incidents/NotificationPolicy';
import type { Anomaly, NotificationTrigger, Order } from '../src/types';
import { OrdersService } from '../src/application/OrdersService';
import { InMemoryOrderRepository } from '../src/repositories/InMemoryOrderRepository';
import { InMemoryTriggerRepository } from '../src/repositories/InMemoryTriggerRepository';
import { InMemoryWorkerMonitor } from '../src/repositories/InMemoryWorkerMonitor';
import type { ICarrierTrackingGateway } from '../src/repositories/ports';

/** Transportadora que devolve um evento de 50 horas atras: o pacote ja nasce parado. */
const stalledCarrier: ICarrierTrackingGateway = {
  fetchUpdate: () => ({
    event: {
      title: 'Objeto em trânsito',
      place: 'Cajamar, SP',
      at: new Date(Date.now() - 50 * 3600_000).toISOString(),
      rawCode: 'TRN',
    },
    status: 'Em trânsito',
  }),
};

function setup(stallTriggerEnabled: boolean) {
  const rules = [new StalledInTransitRule()];
  const published: { order: Order; anomalies: readonly Anomaly[] }[] = [];
  const triggers: NotificationTrigger[] = [
    { id: 'stall', label: 'Parada prolongada', hint: '', enabled: stallTriggerEnabled },
  ];

  const service = new OrdersService({
    orders: new InMemoryOrderRepository([]),
    triggers: new InMemoryTriggerRepository(triggers),
    tracking: stalledCarrier,
    alerts: { publish: (order, anomalies) => published.push({ order, anomalies }) },
    workers: new InMemoryWorkerMonitor({ lastSyncAt: new Date(), queueSize: 0 }),
    anomalies: new AnomalyDetector(rules),
    carriers: new CarrierDetector(CARRIER_PATTERNS),
    notifications: new NotificationPolicy(rules),
  });

  return { service, published };
}

const input = { code: 'AB123456789BR', recipient: 'Ana', city: 'Curitiba, PR' };

test('anomalia com gatilho ligado publica alerta', () => {
  const { service, published } = setup(true);
  const result = service.create('tenant-x', input);

  assert.ok(result.ok);
  assert.equal(result.data.hasAnomaly, true);
  assert.equal(published.length, 1);
  assert.equal(published[0].anomalies[0].rule, 'Parada prolongada');
});

test('anomalia com gatilho desligado nao publica alerta', () => {
  const { service, published } = setup(false);
  const result = service.create('tenant-x', input);

  assert.ok(result.ok);
  assert.equal(result.data.hasAnomaly, true);
  assert.equal(published.length, 0);
});
