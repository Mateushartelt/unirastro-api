/**
 * Encomendas em memoria, no lugar do banco de dados (PostgreSQL no C2).
 *
 * Recebe os dados iniciais pelo construtor: quem decide com o que semear e o composition root.
 */

import type { Order, TenantId } from '../types';
import type { IOrderRepository } from './ports';

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: Order[];

  constructor(seed: readonly Order[]) {
    this.orders = structuredClone([...seed]);
  }

  listByTenant(tenantId: TenantId): Order[] {
    return this.orders.filter((o) => o.tenantId === tenantId);
  }

  findByCode(tenantId: TenantId, code: string): Order | null {
    return this.orders.find((o) => o.tenantId === tenantId && o.code === code) ?? null;
  }

  /** Cadastros novos entram no topo, como a lista exibe. */
  add(order: Order): void {
    this.orders = [order, ...this.orders];
  }

  update(order: Order): void {
    this.orders = this.orders.map((o) =>
      o.tenantId === order.tenantId && o.code === order.code ? order : o,
    );
  }
}
