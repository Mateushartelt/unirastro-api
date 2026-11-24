/**
 * Integracao real com a Shopee Xpress. A resposta em fixtures/ foi gravada da API publica
 * (spx.com.br) para o codigo BR262730058243Y em 23/11/2026, sem os enderecos completos.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { CarrierRouterGateway } from '../src/integrations/CarrierRouterGateway';
import { DemoAwareCarrierGateway } from '../src/integrations/DemoAwareCarrierGateway';
import { UntrackedCarrierGateway } from '../src/integrations/UntrackedCarrierGateway';
import { ShopeeXpressGateway, type SpxResponse } from '../src/integrations/ShopeeXpressGateway';
import { CarrierDetector } from '../src/domain/carriers/CarrierDetector';
import { CARRIER_PATTERNS } from '../src/domain/carriers/carrierPatterns';
import { CarrierUnavailableError, type ICarrierTrackingGateway } from '../src/repositories/ports';
import type { Order } from '../src/types';

const RECORDED: SpxResponse = JSON.parse(
  readFileSync(new URL('./fixtures/spx-BR262730058243Y.json', import.meta.url), 'utf8'),
);

function order(overrides: Partial<Order> = {}): Order {
  return {
    code: 'BR262730058243Y',
    tenantId: 't1',
    carrier: 'Shopee Xpress',
    recipient: 'Ana',
    city: 'Itajaí, SC',
    region: 'Sul',
    status: 'Postado',
    dueAt: '2026-11-30T00:00:00.000Z',
    origin: 'São Paulo, SP',
    plannedRoute: [],
    timeline: [],
    ...overrides,
  };
}

function fakeFetch(body: unknown, status = 200) {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, urls };
}

describe('ShopeeXpressGateway (resposta real gravada)', () => {
  test('codigo BR + 12 digitos + letra e Shopee Xpress', () => {
    assert.equal(new CarrierDetector(CARRIER_PATTERNS).detect('br262730058243y'), 'Shopee Xpress');
  });

  test('traz so os eventos visiveis ao comprador, do mais recente ao mais antigo', async () => {
    const { fn, urls } = fakeFetch(RECORDED);
    const update = await new ShopeeXpressGateway({ fetch: fn }).fetchUpdate(order());

    assert.match(urls[0], /spx_tn=BR262730058243Y/);
    assert.ok(update);
    assert.deepEqual(update.events.map((e) => e.rawCode), ['F510', 'F100', 'F000']);
    assert.equal(update.events[0].place, 'São Bernardo do Campo, SP');
    assert.equal(update.events[0].at, '2026-11-24T00:32:30.000Z');
    assert.equal(update.status, 'Em trânsito');
  });

  test('segunda consulta sem novidade devolve null', async () => {
    const { fn } = fakeFetch(RECORDED);
    const gateway = new ShopeeXpressGateway({ fetch: fn });
    const first = await gateway.fetchUpdate(order());
    assert.ok(first);
    assert.equal(await gateway.fetchUpdate(order({ timeline: first.events })), null);
  });

  test('codigo desconhecido (retcode != 0) devolve null; HTTP 5xx e indisponibilidade', async () => {
    const notFound = fakeFetch({ retcode: 2, message: 'not found' });
    assert.equal(await new ShopeeXpressGateway({ fetch: notFound.fn }).fetchUpdate(order()), null);

    const down = fakeFetch({}, 503);
    await assert.rejects(new ShopeeXpressGateway({ fetch: down.fn }).fetchUpdate(order()), CarrierUnavailableError);
  });
});

describe('CarrierRouterGateway', () => {
  test('Shopee Xpress vai para a integracao propria; o resto para o agregador', async () => {
    const used: string[] = [];
    const named = (name: string): ICarrierTrackingGateway => ({
      fetchUpdate: async () => {
        used.push(name);
        return null;
      },
    });
    const router = new CarrierRouterGateway({ 'Shopee Xpress': named('spx') }, named('agregador'));

    await router.fetchUpdate(order());
    await router.fetchUpdate(order({ carrier: 'Correios', code: 'AB123456789BR' }));
    assert.deepEqual(used, ['spx', 'agregador']);
  });
});

describe('DemoAwareCarrierGateway', () => {
  test('codigos da demonstracao ficam no simulado; o resto vai para a API real', async () => {
    const used: string[] = [];
    const named = (name: string): ICarrierTrackingGateway => ({
      fetchUpdate: async () => {
        used.push(name);
        return null;
      },
    });
    const gateway = new DemoAwareCarrierGateway(named('real'), named('demo'), ['QB000000000BR']);

    await gateway.fetchUpdate(order({ code: 'QB000000000BR' }));
    await gateway.fetchUpdate(order());
    assert.deepEqual(used, ['demo', 'real']);
  });
});

describe('UntrackedCarrierGateway', () => {
  test('transportadora sem integracao real nunca traz movimentacao', async () => {
    assert.equal(await new UntrackedCarrierGateway().fetchUpdate(), null);
  });
});
