/**
 * Integracao real com a transportadora (Melhor Rastreio), com a rede trocada por respostas
 * gravadas no formato que a API devolve. Assim o teste nao depende de internet nem de um
 * codigo de rastreio que expira.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DemoAwareCarrierGateway } from '../src/integrations/DemoAwareCarrierGateway';
import {
  MelhorRastreioGateway,
  statusFromEvent,
  type RemoteEvent,
} from '../src/integrations/MelhorRastreioGateway';
import { CarrierUnavailableError, type ICarrierTrackingGateway } from '../src/repositories/ports';
import type { Order } from '../src/types';

const REMOTE_EVENTS: RemoteEvent[] = [
  {
    status: 'POSTED',
    title: 'Objeto postado',
    registeredAt: '2026-11-18T10:12:00.000Z',
    location: { city: 'SAO PAULO', state: 'sp' },
  },
  {
    status: 'ONROUTE',
    title: 'Objeto saiu para entrega ao destinatário',
    registeredAt: '2026-11-21T08:40:00.000Z',
    location: { city: 'CURITIBA', state: 'PR' },
  },
  {
    status: 'MOVEMENT',
    title: 'Objeto em transferência - por favor aguarde',
    registeredAt: '2026-11-19T22:05:00.000Z',
    location: { city: 'CAJAMAR', state: 'SP' },
  },
];

function order(overrides: Partial<Order> = {}): Order {
  return {
    code: '12345678901234',
    tenantId: 't1',
    carrier: 'Jadlog',
    recipient: 'Ana',
    city: 'Curitiba, PR',
    region: 'Sul',
    status: 'Postado',
    dueAt: '2026-11-25T00:00:00.000Z',
    origin: 'São Paulo, SP',
    plannedRoute: [],
    timeline: [{ title: 'Cadastrado', place: 'Jadlog', at: '2026-11-18T09:00:00.000Z', rawCode: 'LOCAL' }],
    ...overrides,
  };
}

/** fetch falso que responde sempre o mesmo corpo e guarda o que recebeu. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; payload: { variables: { tracker: { type: string; trackingCode: string } } } }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, payload: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const found = { data: { result: { trackingEvents: REMOTE_EVENTS } } };

describe('MelhorRastreioGateway', () => {
  test('pede o codigo certo e traz o historico do mais recente para o mais antigo', async () => {
    const { fn, calls } = fakeFetch(found);
    const update = await new MelhorRastreioGateway({ fetch: fn }).fetchUpdate(order());

    assert.deepEqual(calls[0].payload.variables.tracker, { type: 'jadlog', trackingCode: '12345678901234' });
    assert.ok(update);
    assert.deepEqual(
      update.events.map((e) => e.title),
      ['Objeto saiu para entrega ao destinatário', 'Objeto em transferência - por favor aguarde', 'Objeto postado'],
    );
    assert.equal(update.events[2].place, 'Sao Paulo, SP');
    assert.equal(update.status, 'Saiu p/ entrega');
  });

  test('so devolve eventos que a encomenda ainda nao tem', async () => {
    const { fn } = fakeFetch(found);
    const gateway = new MelhorRastreioGateway({ fetch: fn });

    const first = await gateway.fetchUpdate(order());
    assert.ok(first);
    const known = order({ timeline: first.events.slice(1) });

    const second = await gateway.fetchUpdate(known);
    assert.equal(second?.events.length, 1);

    assert.equal(await gateway.fetchUpdate(order({ timeline: first.events })), null);
  });

  test('codigo que a transportadora nao conhece devolve null', async () => {
    const { fn } = fakeFetch({ data: { result: null } });
    assert.equal(await new MelhorRastreioGateway({ fetch: fn }).fetchUpdate(order()), null);
  });

  test('transportadora que o agregador nao cobre nao gera chamada', async () => {
    const { fn, calls } = fakeFetch(found);
    const update = await new MelhorRastreioGateway({ fetch: fn }).fetchUpdate(order({ carrier: 'Total Express' }));
    assert.equal(update, null);
    assert.equal(calls.length, 0);
  });

  test('erro HTTP ou de rede vira CarrierUnavailableError', async () => {
    const { fn } = fakeFetch({}, 503);
    await assert.rejects(new MelhorRastreioGateway({ fetch: fn }).fetchUpdate(order()), CarrierUnavailableError);

    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await assert.rejects(new MelhorRastreioGateway({ fetch: offline }).fetchUpdate(order()), CarrierUnavailableError);
  });
});

describe('traducao de status', () => {
  const event = (rawCode: string, title: string) => ({ rawCode, title, place: '', at: '' });

  test('codigos e textos viram os status do painel', () => {
    assert.equal(statusFromEvent(event('DELIVERED', 'Objeto entregue ao destinatário')), 'Entregue');
    assert.equal(statusFromEvent(event('ONROUTE', 'Objeto saiu para entrega')), 'Saiu p/ entrega');
    assert.equal(statusFromEvent(event('WARNING', 'Tentativa de entrega não efetuada')), 'Entrega frustrada');
    assert.equal(statusFromEvent(event('POSTED', 'Objeto postado')), 'Postado');
    assert.equal(statusFromEvent(event('MOVEMENT', 'Objeto em transferência')), 'Em trânsito');
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
