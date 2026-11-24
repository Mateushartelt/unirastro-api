/** Reprocessamento do historico: as anomalias que o monitoramento teria visto no caminho. */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnomalyDetector } from '../src/domain/anomalies/AnomalyDetector';
import { replayHistory } from '../src/domain/anomalies/replayHistory';
import { RepeatedFailedAttemptsRule } from '../src/domain/anomalies/rules/RepeatedFailedAttemptsRule';
import { StalledInTransitRule } from '../src/domain/anomalies/rules/StalledInTransitRule';
import { makeOrder } from './fixtures';

const detector = new AnomalyDetector([new StalledInTransitRule(), new RepeatedFailedAttemptsRule()]);
const T0 = Date.parse('2026-10-01T00:00:00.000Z');
const at = (hours: number) => new Date(T0 + hours * 3600_000).toISOString();
const ev = (hours: number, title: string, place = 'Rio de Janeiro, RJ') => ({ title, place, at: at(hours), rawCode: 'X' });

/** Linha do tempo como o painel guarda: do mais recente para o mais antigo. */
const delivered = (events: ReturnType<typeof ev>[]) =>
  makeOrder({ status: 'Entregue', dueAt: at(24 * 30), timeline: [...events].reverse() });

test('parada de 50h no meio do caminho vira uma anomalia passada, no instante certo', () => {
  const order = delivered([
    ev(0, 'Objeto postado'),
    ev(50, 'Objeto em trânsito', 'Cajamar, SP'),
    ev(60, 'Objeto entregue ao destinatário', 'Curitiba, PR'),
  ]);

  const past = replayHistory(order, detector);

  assert.equal(past.length, 1);
  assert.equal(past[0].rule, 'Parada prolongada');
  assert.match(past[0].title, /Rio de Janeiro, RJ/);
  // Dispara quando passam de 36h inteiras sem movimento: com 37h.
  const firedHours = (Date.parse(past[0].detectedAt) - T0) / 3600_000;
  assert.ok(firedHours >= 37 && firedHours < 37.05, `disparou em ${firedHours}h`);
  assert.equal(past[0].endedAt, at(50));
});

test('caminho sem paradas longas nao gera nada', () => {
  const order = delivered([ev(0, 'Objeto postado'), ev(20, 'Em trânsito'), ev(40, 'Entregue')]);
  assert.deepEqual(replayHistory(order, detector), []);
});

test('tentativa frustrada que continua nos intervalos seguintes conta uma vez so', () => {
  const order = delivered([
    ev(0, 'Objeto postado'),
    ev(10, 'Tentativa de entrega não efetuada'),
    ev(20, 'Tentativa de entrega não efetuada'),
    ev(30, 'Saiu para entrega'),
    ev(32, 'Objeto entregue ao destinatário'),
  ]);

  const past = replayHistory(order, detector);
  assert.deepEqual(past.map((p) => p.rule), ['Tentativa frustrada']);
  assert.equal(past[0].detectedAt, at(20));
});
