/**
 * Testes de integracao da persistencia: SqliteOrderRepository contra um arquivo SQLite real.
 *
 * Cada teste usa um arquivo novo numa pasta temporaria. A prova de persistencia e fechar a
 * conexao, abrir outra no mesmo arquivo e encontrar os dados la.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, describe, test } from 'node:test';
import { openDatabase } from '../src/repositories/sqlite/database';
import { SqliteOrderRepository } from '../src/repositories/sqlite/SqliteOrderRepository';
import { event, makeOrder } from './fixtures';
import { startApi } from './helpers';

const tempDir = mkdtempSync(join(tmpdir(), 'unirastro-db-'));
let dbFile: string;
let fileCounter = 0;

beforeEach(() => {
  fileCounter += 1;
  dbFile = join(tempDir, `orders-${fileCounter}.db`);
});

after(() => rmSync(tempDir, { recursive: true, force: true }));

/** Abre o arquivo, executa o trabalho e fecha a conexao, como um processo que encerra. */
function withRepository<T>(work: (repo: SqliteOrderRepository) => T): T {
  const db = openDatabase(dbFile);
  try {
    return work(new SqliteOrderRepository(db));
  } finally {
    db.close();
  }
}

describe('SqliteOrderRepository (banco real)', () => {
  test('encomenda gravada continua no banco depois de reabrir a conexao', () => {
    const order = makeOrder({ code: 'AB123456789BR' });
    withRepository((repo) => repo.add(order));

    const loaded = withRepository((repo) => repo.findByCode('tenant-teste', 'AB123456789BR'));
    assert.deepEqual(loaded, order);
  });

  test('atualizacao de status e linha do tempo e persistida', () => {
    const order = makeOrder();
    withRepository((repo) => repo.add(order));

    const updated = {
      ...order,
      status: 'Saiu p/ entrega' as const,
      timeline: [event('Saiu para entrega', 'Curitiba, PR'), ...order.timeline],
    };
    withRepository((repo) => repo.update(updated));

    const loaded = withRepository((repo) => repo.findByCode(order.tenantId, order.code));
    assert.equal(loaded?.status, 'Saiu p/ entrega');
    assert.equal(loaded?.timeline.length, 2);
  });

  test('listagem isola empresas e traz os cadastros mais novos primeiro', () => {
    withRepository((repo) => {
      repo.add(makeOrder({ code: 'AA000000001BR' }));
      repo.add(makeOrder({ code: 'AA000000002BR' }));
      repo.add(makeOrder({ code: 'AA000000003BR', tenantId: 'outra-empresa' }));
    });

    const codes = withRepository((repo) => repo.listByTenant('tenant-teste').map((o) => o.code));
    assert.deepEqual(codes, ['AA000000002BR', 'AA000000001BR']);
    assert.equal(withRepository((repo) => repo.findByCode('outra-empresa', 'AA000000001BR')), null);
  });

  test('o banco recusa o mesmo codigo duas vezes na mesma empresa', () => {
    withRepository((repo) => {
      repo.add(makeOrder());
      assert.throws(() => repo.add(makeOrder()), /UNIQUE constraint failed/);
    });
  });
});

describe('API com SQLite (HTTP -> servico -> banco)', () => {
  test('encomenda cadastrada pela API sobrevive ao reinicio do servidor', async () => {
    const first = await startApi({ publish: () => {} }, dbFile);
    const token = await first.login('marina@aurora.com.br', 'operador');
    const created = await first.call(
      'POST',
      '/encomendas',
      { code: 'ZZ987654321BR', recipient: 'Carla Lima', city: 'Recife, PE' },
      token,
    );
    assert.equal(created.status, 201);
    await first.close();

    const second = await startApi({ publish: () => {} }, dbFile);
    const token2 = await second.login('marina@aurora.com.br', 'operador');
    const loaded = await second.call('GET', '/encomendas/ZZ987654321BR', undefined, token2);
    await second.close();

    assert.equal(loaded.status, 200);
    assert.equal(loaded.json.data.recipient, 'Carla Lima');
    assert.equal(loaded.json.data.timeline[0].title, 'Objeto postado');
  });
});
