/**
 * Testes de unidade das regras de negocio (dominio puro, sem HTTP nem banco).
 *
 * Cada regra recebe o instante atual por parametro, entao os testes usam um relogio fixo (NOW)
 * e nao dependem da hora em que rodam.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AnomalyDetector } from '../src/domain/anomalies/AnomalyDetector';
import { PredictiveDelayRiskRule } from '../src/domain/anomalies/rules/PredictiveDelayRiskRule';
import { RepeatedFailedAttemptsRule } from '../src/domain/anomalies/rules/RepeatedFailedAttemptsRule';
import { RouteDeviationRule } from '../src/domain/anomalies/rules/RouteDeviationRule';
import { StalledInTransitRule } from '../src/domain/anomalies/rules/StalledInTransitRule';
import { CarrierDetector } from '../src/domain/carriers/CarrierDetector';
import { CARRIER_PATTERNS } from '../src/domain/carriers/carrierPatterns';
import { NotificationPolicy } from '../src/domain/incidents/NotificationPolicy';
import { normalizeNewOrder, validateNewOrder } from '../src/domain/orders/newOrder';
import { hasPermission } from '../src/domain/permissions';
import { NOW, daysAfter, event, hoursBefore, makeOrder } from './fixtures';

describe('RF01 · identificacao da transportadora pelo codigo', () => {
  const detector = new CarrierDetector(CARRIER_PATTERNS);

  test('reconhece cada transportadora integrada pelo formato do codigo', () => {
    assert.equal(detector.detect('AB123456789BR'), 'Correios');
    assert.equal(detector.detect('12345678901234'), 'Jadlog');
    assert.equal(detector.detect('LG2039481122'), 'Loggi');
    assert.equal(detector.detect('TE123456789012'), 'Total Express');
  });

  test('normaliza espacos e minusculas antes de detectar', () => {
    assert.equal(detector.detect('  ab123456789br '), 'Correios');
  });

  test('codigo fora de qualquer formato devolve null', () => {
    assert.equal(detector.detect('XYZ'), null);
  });
});

describe('RF01 · validacao do cadastro de encomenda', () => {
  const input = normalizeNewOrder({ code: ' ab123456789br ', recipient: ' Ana ', city: ' Curitiba ' });

  test('cadastro completo e valido nao devolve erro', () => {
    assert.deepEqual(input, { code: 'AB123456789BR', recipient: 'Ana', city: 'Curitiba' });
    assert.equal(validateNewOrder(input, 'Correios', false), null);
  });

  test('codigo nao reconhecido, destinatario vazio e duplicado sao recusados', () => {
    assert.equal(validateNewOrder(input, null, false)?.message, 'Código não reconhecido.');
    assert.equal(
      validateNewOrder({ ...input, recipient: '' }, 'Correios', false)?.message,
      'Destinatário obrigatório.',
    );
    assert.equal(validateNewOrder(input, 'Correios', true)?.message, 'Código duplicado.');
  });
});

describe('RF04 · regras de anomalia', () => {
  test('parada prolongada: mais de 36h sem movimentacao gera anomalia', () => {
    const rule = new StalledInTransitRule();
    const stalled = makeOrder({ timeline: [event('Objeto em trânsito', 'Contagem, MG', 50)] });
    const moving = makeOrder({ timeline: [event('Objeto em trânsito', 'Contagem, MG', 10)] });

    const anomaly = rule.evaluate(stalled, NOW);
    assert.equal(anomaly?.severity, 'Atenção');
    assert.match(anomaly?.title ?? '', /parado 50h em Contagem/);
    assert.equal(rule.evaluate(moving, NOW), null);
  });

  test('parada prolongada vira critica quando o prazo vence em ate 1 dia', () => {
    const order = makeOrder({
      dueAt: daysAfter(1),
      timeline: [event('Objeto em trânsito', 'Contagem, MG', 50)],
    });
    assert.equal(new StalledInTransitRule().evaluate(order, NOW)?.severity, 'Crítico');
  });

  test('encomenda entregue nunca gera parada prolongada', () => {
    const order = makeOrder({
      status: 'Entregue',
      timeline: [{ title: 'Entregue', place: 'Curitiba, PR', at: hoursBefore(200), rawCode: 'DLV' }],
    });
    assert.equal(new StalledInTransitRule().evaluate(order, NOW), null);
  });

  test('tentativas frustradas: a segunda tentativa dispara a anomalia', () => {
    const rule = new RepeatedFailedAttemptsRule();
    const failed = event('Tentativa de entrega não efetuada', 'Curitiba, PR');

    assert.equal(rule.evaluate(makeOrder({ timeline: [failed] })), null);
    const anomaly = rule.evaluate(makeOrder({ timeline: [failed, failed] }));
    assert.equal(anomaly?.title, 'Segunda tentativa frustrada em Curitiba, PR');
    assert.equal(anomaly?.severity, 'Crítico');
  });

  test('desvio de rota: parada fora do plano gera anomalia', () => {
    const order = makeOrder({ timeline: [event('Objeto em trânsito', 'Manaus, AM')] });
    const anomaly = new RouteDeviationRule().evaluate(order, NOW);
    assert.equal(anomaly?.title, 'Desvio de rota detectado (Manaus, AM)');
    assert.equal(new RouteDeviationRule().evaluate(makeOrder(), NOW), null);
  });

  test('risco preditivo: prazo amanha sem sair para entrega e critico', () => {
    const rule = new PredictiveDelayRiskRule();
    const atRisk = makeOrder({ dueAt: daysAfter(1) });
    const outForDelivery = makeOrder({ dueAt: daysAfter(1), status: 'Saiu p/ entrega' });

    assert.equal(rule.evaluate(atRisk, NOW)?.title, 'Prazo vence amanhã e pacote ainda não saiu para entrega');
    assert.equal(rule.evaluate(outForDelivery, NOW), null);
    assert.equal(rule.evaluate(makeOrder({ dueAt: daysAfter(5) }), NOW), null);
  });

  test('o detector devolve as anomalias da mais grave para a menos grave', () => {
    const detector = new AnomalyDetector([new RouteDeviationRule(), new RepeatedFailedAttemptsRule()]);
    const failed = event('Tentativa de entrega não efetuada', 'Manaus, AM');
    const order = makeOrder({ dueAt: daysAfter(3), timeline: [failed, failed] });

    const anomalies = detector.detect(order, NOW);
    assert.deepEqual(
      anomalies.map((a) => [a.rule, a.severity]),
      [
        ['Tentativa frustrada', 'Crítico'],
        ['Rota desviada', 'Atenção'],
      ],
    );
  });
});

describe('RF05 · aviso ao cliente final depende do gatilho', () => {
  const policy = new NotificationPolicy([new StalledInTransitRule()]);
  const trigger = (enabled: boolean) => [{ id: 'stall', label: '', hint: '', enabled }];

  test('so notifica quando o gatilho da regra esta ligado', () => {
    assert.equal(policy.wasNotified('Parada prolongada', trigger(true)), true);
    assert.equal(policy.wasNotified('Parada prolongada', trigger(false)), false);
    assert.equal(policy.wasNotified('Regra desconhecida', trigger(true)), false);
  });
});

describe('RF10 · permissoes por papel', () => {
  test('suporte resolve incidentes mas nao cadastra encomenda nem altera gatilho', () => {
    assert.equal(hasPermission('Suporte', 'resolveIncidents'), true);
    assert.equal(hasPermission('Suporte', 'createOrders'), false);
    assert.equal(hasPermission('Suporte', 'editTriggers'), false);
    assert.equal(hasPermission('Operador de Logística', 'createOrders'), true);
  });
});
