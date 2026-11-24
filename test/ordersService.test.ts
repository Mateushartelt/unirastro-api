/**
 * Teste de unidade do OrdersService com dublês nas portas.
 *
 * So e possivel porque o servico depende de interfaces (DIP): a transportadora e o publicador
 * de alertas sao trocados por objetos de teste sem tocar no servico.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnomalyDetector } from '../src/domain/anomalies/AnomalyDetector';
import { RepeatedFailedAttemptsRule } from '../src/domain/anomalies/rules/RepeatedFailedAttemptsRule';
import { StalledInTransitRule } from '../src/domain/anomalies/rules/StalledInTransitRule';
import { CarrierDetector } from '../src/domain/carriers/CarrierDetector';
import { CARRIER_PATTERNS } from '../src/domain/carriers/carrierPatterns';
import { NotificationPolicy } from '../src/domain/incidents/NotificationPolicy';
import type { Anomaly, NotificationTrigger, Order } from '../src/types';
import { OrdersService } from '../src/application/OrdersService';
import { InMemoryOrderRepository } from '../src/repositories/InMemoryOrderRepository';
import { InMemoryTriggerRepository } from '../src/repositories/InMemoryTriggerRepository';
import { InMemoryWorkerMonitor } from '../src/repositories/InMemoryWorkerMonitor';
import type { ICarrierTrackingGateway, TrackingUpdate } from '../src/repositories/ports';

/** Transportadora que devolve um evento de 50 horas atras: o pacote ja nasce parado. */
const stalledCarrier: ICarrierTrackingGateway = {
  fetchUpdate: async () => ({
    events: [
      {
        title: 'Objeto em trânsito',
        place: 'Cajamar, SP',
        at: new Date(Date.now() - 50 * 3600_000).toISOString(),
        rawCode: 'TRN',
      },
    ],
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

const input = { code: 'BR444444444444A', recipient: 'Ana', city: 'Curitiba, PR' };

test('anomalia com gatilho ligado publica alerta', async () => {
  const { service, published } = setup(true);
  const result = await service.create('tenant-x', input);

  assert.ok(result.ok);
  assert.equal(result.data.hasAnomaly, true);
  assert.equal(published.length, 1);
  assert.equal(published[0].anomalies[0].rule, 'Parada prolongada');
});

test('anomalia com gatilho desligado nao publica alerta', async () => {
  const { service, published } = setup(false);
  const result = await service.create('tenant-x', input);

  assert.ok(result.ok);
  assert.equal(result.data.hasAnomaly, true);
  assert.equal(published.length, 0);
});

/* ---------------- Alertas em consultas posteriores (RF02 + RF05) ---------------- */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

/** Transportadora roteirizada: cada consulta devolve o proximo item da lista. */
function scriptedCarrier(steps: (TrackingUpdate | null)[]): ICarrierTrackingGateway {
  let i = 0;
  return { fetchUpdate: async () => steps[i++] ?? null };
}

const failedAttempt = (h: number) => ({
  title: 'Tentativa de entrega não efetuada',
  place: 'Curitiba, PR',
  at: hoursAgo(h),
  rawCode: 'FAIL',
});

function setupScripted(steps: (TrackingUpdate | null)[], triggersOn = true) {
  const rules = [new StalledInTransitRule(), new RepeatedFailedAttemptsRule()];
  const published: string[][] = [];
  const triggers = new InMemoryTriggerRepository([
    { id: 'stall', label: 'Parada prolongada', hint: '', enabled: triggersOn },
    { id: 'fail', label: 'Tentativa frustrada', hint: '', enabled: triggersOn },
  ]);

  const service = new OrdersService({
    orders: new InMemoryOrderRepository([]),
    triggers,
    tracking: scriptedCarrier(steps),
    alerts: { publish: (_order, anomalies) => published.push(anomalies.map((a) => a.rule)) },
    workers: new InMemoryWorkerMonitor({ lastSyncAt: new Date(), queueSize: 0 }),
    anomalies: new AnomalyDetector(rules),
    carriers: new CarrierDetector(CARRIER_PATTERNS),
    notifications: new NotificationPolicy(rules),
  });

  return { service, published, triggers };
}

test('a mesma anomalia nao gera alerta de novo a cada consulta', async () => {
  const stalled = { events: [{ title: 'Objeto em trânsito', place: 'Cajamar, SP', at: hoursAgo(50), rawCode: 'TRN' }], status: 'Em trânsito' as const };
  const { service, published } = setupScripted([stalled, null, null]);

  await service.create('t', input);
  await service.refresh('t', input.code);
  await service.refresh('t', input.code);

  assert.deepEqual(published, [['Parada prolongada']]);
});

test('anomalia que surge numa consulta posterior publica alerta', async () => {
  const { service, published } = setupScripted([
    { events: [failedAttempt(30)], status: 'Entrega frustrada' },
    { events: [failedAttempt(2)], status: 'Entrega frustrada' },
  ]);

  await service.create('t', input);
  assert.deepEqual(published, [], 'uma tentativa frustrada so nao dispara');

  const result = await service.refresh('t', input.code);
  assert.ok(result.ok);
  assert.deepEqual(published, [['Tentativa frustrada']]);
  assert.deepEqual(result.data.alertedRules, ['Tentativa frustrada']);
});

test('gatilho ligado depois avisa na proxima consulta, mesmo sem evento novo', async () => {
  const stalled = { events: [{ title: 'Objeto em trânsito', place: 'Cajamar, SP', at: hoursAgo(50), rawCode: 'TRN' }], status: 'Em trânsito' as const };
  const { service, published, triggers } = setupScripted([stalled, null], false);

  await service.create('t', input);
  assert.deepEqual(published, []);

  const stall = triggers.findById('stall');
  assert.ok(stall);
  triggers.update({ ...stall, enabled: true });
  await service.refresh('t', input.code);

  assert.deepEqual(published, [['Parada prolongada']]);
});
