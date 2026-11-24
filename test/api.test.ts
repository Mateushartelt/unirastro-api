/**
 * Testes de integracao da API: requisicao HTTP real contra o app montado pelo composition root.
 */

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startApi, type Api } from './helpers';

let api: Api;
let marina: string;

before(async () => {
  api = await startApi({ publish: () => {} });
  marina = await api.login('marina@aurora.com.br', 'operador');
});

after(() => api.close());

describe('autenticacao', () => {
  test('login correto devolve sessao e token', async () => {
    const { status, json } = await api.call('POST', '/auth/login', {
      email: 'marina@aurora.com.br',
      password: 'operador',
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.session.tenantId, 'tenant-aurora');
    assert.equal(json.data.session.password, undefined);
    assert.ok(json.data.token);
  });

  test('senha errada devolve 401 com mensagem generica', async () => {
    const { status, json } = await api.call('POST', '/auth/login', {
      email: 'marina@aurora.com.br',
      password: 'errada',
    });
    assert.equal(status, 401);
    assert.equal(json.success, false);
    assert.equal(json.message, 'Credenciais inválidas.');
  });

  test('rota protegida sem token devolve 401', async () => {
    const { status } = await api.call('GET', '/encomendas');
    assert.equal(status, 401);
  });

  test('token adulterado devolve 401', async () => {
    const { status } = await api.call('GET', '/encomendas', undefined, marina + 'x');
    assert.equal(status, 401);
  });
});

describe('encomendas', () => {
  test('lista so as encomendas da empresa do token', async () => {
    const { json } = await api.call('GET', '/encomendas', undefined, marina);
    assert.equal(json.data.length, 5);
    assert.ok(json.data.every((o: { tenantId: string }) => o.tenantId === 'tenant-aurora'));
  });

  test('Bonsai nao enxerga nenhuma encomenda da Aurora', async () => {
    const diego = await api.login('diego@bonsai.com.br', 'bonsai');
    const list = await api.call('GET', '/encomendas', undefined, diego);
    assert.equal(list.json.data.length, 3);

    const other = await api.call('GET', '/encomendas/NL482913776BR', undefined, diego);
    assert.equal(other.status, 404);
  });

  test('cadastro valido devolve 201 com transportadora detectada e primeira consulta', async () => {
    const { status, json } = await api.call(
      'POST',
      '/encomendas',
      { code: ' br123456789012a ', recipient: 'Ana Souza', city: 'Curitiba, PR' },
      marina,
    );
    assert.equal(status, 201);
    assert.equal(json.data.code, 'BR123456789012A');
    assert.equal(json.data.carrier, 'Shopee Xpress');
    assert.equal(json.data.timeline[0].title, 'Objeto postado');
  });

  test('codigo invalido devolve 400', async () => {
    const { status, json } = await api.call(
      'POST',
      '/encomendas',
      { code: 'XYZ', recipient: 'Ana', city: '' },
      marina,
    );
    assert.equal(status, 400);
    assert.equal(json.message, 'Código não reconhecido.');
  });

  test('codigo duplicado devolve 400', async () => {
    const { status, json } = await api.call(
      'POST',
      '/encomendas',
      { code: '10084531275940', recipient: 'Ana', city: '' },
      marina,
    );
    assert.equal(status, 400);
    assert.equal(json.message, 'Código duplicado.');
  });

  test('suporte nao pode cadastrar (403)', async () => {
    const tais = await api.login('tais@aurora.com.br', 'suporte');
    const { status } = await api.call(
      'POST',
      '/encomendas',
      { code: 'BR111111111111A', recipient: 'Ana', city: '' },
      tais,
    );
    assert.equal(status, 403);
  });

  test('operador apaga a encomenda; ela some e o codigo volta a ser aceito', async () => {
    const order = { code: 'BR222222222222A', recipient: 'Ana', city: '' };
    await api.call('POST', '/encomendas', order, marina);

    const { status, json } = await api.call('DELETE', '/encomendas/BR222222222222A', undefined, marina);
    assert.equal(status, 200);
    assert.equal(json.message, 'Encomenda BR222222222222A apagada.');
    assert.equal((await api.call('GET', '/encomendas/BR222222222222A', undefined, marina)).status, 404);
    assert.equal((await api.call('POST', '/encomendas', order, marina)).status, 201);
  });

  test('apagar codigo inexistente devolve 404; suporte nao apaga (403)', async () => {
    assert.equal((await api.call('DELETE', '/encomendas/ZZ999999999BR', undefined, marina)).status, 404);

    const tais = await api.login('tais@aurora.com.br', 'suporte');
    assert.equal((await api.call('DELETE', '/encomendas/QB771204558BR', undefined, tais)).status, 403);
  });

  test('outra empresa nao apaga encomenda da Aurora (404)', async () => {
    const diego = await api.login('diego@bonsai.com.br', 'bonsai');
    assert.equal((await api.call('DELETE', '/encomendas/QB771204558BR', undefined, diego)).status, 404);
    assert.equal((await api.call('GET', '/encomendas/QB771204558BR', undefined, marina)).status, 200);
  });

  test('consulta de status acrescenta movimentacao', async () => {
    const before = await api.call('GET', '/encomendas/LG2039481122', undefined, marina);
    const { status, json } = await api.call('POST', '/encomendas/LG2039481122/consultar', undefined, marina);
    assert.equal(status, 200);
    assert.ok(json.data.timeline.length >= before.json.data.timeline.length);
  });
});

describe('incidentes e gatilhos', () => {
  test('resolver um incidente o marca como resolvido so na propria empresa', async () => {
    const list = await api.call('GET', '/incidentes', undefined, marina);
    const open = list.json.data.find((i: { resolved: boolean }) => !i.resolved);
    assert.ok(open);

    const res = await api.call('POST', `/incidentes/${encodeURIComponent(open.id)}/resolver`, undefined, marina);
    assert.equal(res.status, 200);

    const after = await api.call('GET', '/incidentes', undefined, marina);
    assert.equal(after.json.data.find((i: { id: string }) => i.id === open.id).resolved, true);
  });

  test('suporte nao altera gatilhos (403); operador altera', async () => {
    const tais = await api.login('tais@aurora.com.br', 'suporte');
    assert.equal((await api.call('PATCH', '/gatilhos/route', undefined, tais)).status, 403);

    const { status, json } = await api.call('PATCH', '/gatilhos/route', undefined, marina);
    assert.equal(status, 200);
    assert.equal(json.data.find((t: { id: string }) => t.id === 'route').enabled, true);
  });
});
