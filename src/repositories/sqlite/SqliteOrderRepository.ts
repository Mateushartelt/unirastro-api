/**
 * Encomendas persistidas em SQLite: a mesma porta IOrderRepository do repositorio em memoria.
 *
 * O servico de encomendas nao sabe qual das duas implementacoes recebeu (DIP). A chave e
 * (tenant_id, code), entao a unicidade do codigo vale por empresa, como a regra de cadastro pede.
 * Os campos estruturados (rota, linha do tempo) ficam serializados em JSON na coluna `data`.
 */

import type { DatabaseSync } from 'node:sqlite';
import type { Order } from '../../types';
import type { IOrderRepository } from '../ports';

interface OrderRow {
  data: string;
}

export class SqliteOrderRepository implements IOrderRepository {
  private readonly db: DatabaseSync;

  /** Semeia o banco so quando a tabela esta vazia, para nao sobrescrever dados gravados. */
  constructor(db: DatabaseSync, seed: readonly Order[] = []) {
    this.db = db;
    if (this.count() === 0) this.seed(seed);
  }

  /** Cadastros novos primeiro, como a lista exibe. */
  listByTenant(tenantId: string): Order[] {
    const rows = this.db
      .prepare('SELECT data FROM orders WHERE tenant_id = ? ORDER BY position DESC')
      .all(tenantId) as unknown as OrderRow[];
    return rows.map(toOrder);
  }

  findByCode(tenantId: string, code: string): Order | null {
    const row = this.db
      .prepare('SELECT data FROM orders WHERE tenant_id = ? AND code = ?')
      .get(tenantId, code) as unknown as OrderRow | undefined;
    return row ? toOrder(row) : null;
  }

  add(order: Order): void {
    this.db
      .prepare('INSERT INTO orders (tenant_id, code, status, data) VALUES (?, ?, ?, ?)')
      .run(order.tenantId, order.code, order.status, JSON.stringify(order));
  }

  update(order: Order): void {
    this.db
      .prepare('UPDATE orders SET status = ?, data = ? WHERE tenant_id = ? AND code = ?')
      .run(order.status, JSON.stringify(order), order.tenantId, order.code);
  }

  private count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM orders').get() as { total: number };
    return row.total;
  }

  /** Insere de tras para frente para que o primeiro item do seed fique no topo da lista. */
  private seed(orders: readonly Order[]): void {
    [...orders].reverse().forEach((order) => this.add(order));
  }
}

function toOrder(row: OrderRow): Order {
  return JSON.parse(row.data) as Order;
}
