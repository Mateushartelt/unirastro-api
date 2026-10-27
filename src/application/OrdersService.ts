/**
 * Encomendas (RF01, RF02, RF03): o caso de uso do diagrama de sequencia de cadastro.
 *
 * O servico so orquestra. Validacao e montagem do pedido estao em domain/orders, deteccao da
 * transportadora no CarrierDetector, anomalias no AnomalyDetector, persistencia no
 * IOrderRepository, a consulta a transportadora no ICarrierTrackingGateway e o aviso ao cliente
 * final no IAlertPublisher. Todas essas pecas chegam pelo construtor (DIP).
 *
 * As regras de dominio (src/domain) sao as mesmas da Aplicacao Web do UNIRASTRO: a API aplica
 * no servidor exatamente o que o painel mostra.
 */

import type { AnomalyDetector } from '../domain/anomalies/AnomalyDetector';
import type { CarrierDetector } from '../domain/carriers/CarrierDetector';
import type { NotificationPolicy } from '../domain/incidents/NotificationPolicy';
import {
  buildNewOrder,
  normalizeNewOrder,
  validateNewOrder,
  type NewOrderInput,
} from '../domain/orders/newOrder';
import type { Order, OrderWithAnomalies, TenantId } from '../types';
import type {
  IAlertPublisher,
  ICarrierTrackingGateway,
  IOrderRepository,
  ITriggerRepository,
  IWorkerActivityRecorder,
} from '../repositories/ports';
import { failure, success, type Result } from './result';

export interface OrdersServiceDeps {
  orders: IOrderRepository;
  triggers: ITriggerRepository;
  tracking: ICarrierTrackingGateway;
  alerts: IAlertPublisher;
  workers: IWorkerActivityRecorder;
  anomalies: AnomalyDetector;
  carriers: CarrierDetector;
  notifications: NotificationPolicy;
}

export class OrdersService {
  private readonly deps: OrdersServiceDeps;

  constructor(deps: OrdersServiceDeps) {
    this.deps = deps;
  }

  list(tenantId: TenantId): Result<OrderWithAnomalies[]> {
    return success(this.deps.orders.listByTenant(tenantId).map((o) => this.enrich(o)));
  }

  get(tenantId: TenantId, code: string): Result<OrderWithAnomalies> {
    const order = this.deps.orders.findByCode(tenantId, code);
    if (!order) return this.notFound(code);
    return success(this.enrich(order));
  }

  /** Cadastro de encomenda (RF01), na ordem do diagrama de sequencia. */
  create(tenantId: TenantId, input: NewOrderInput): Result<OrderWithAnomalies> {
    const { orders, carriers, tracking, workers } = this.deps;

    // 1. detectarTransportadora(codigo) + validacao
    const clean = normalizeNewOrder(input);
    const carrier = carriers.detect(clean.code);
    const isDuplicate = orders.findByCode(tenantId, clean.code) !== null;

    const error = validateNewOrder(clean, carrier, isDuplicate);
    if (error || !carrier) {
      return failure('invalid', error?.message ?? 'Cadastro inválido.', error ? [error.detail] : []);
    }

    // 2. consultarRastreio(codigo): primeira consulta a transportadora
    let order = buildNewOrder(tenantId, clean, carrier);
    order = this.applyUpdate(order, tracking.fetchUpdate(order));
    workers.recordSync(new Date());

    // 3. avaliarAnomalias(eventos): cada AnomalyRule e uma estrategia (Strategy)
    const enriched = this.enrich(order);

    // 4. salvar(encomenda)
    orders.add(order);

    // 5. opt [anomalia detectada]: publicarAlerta(encomenda)
    this.publishAlerts(order, enriched);

    return success(enriched, `Pedido cadastrado · ${carrier} identificada · primeira consulta feita`);
  }

  /** Consulta de status sob demanda (RF02). No sistema real quem faz isso e um worker. */
  refresh(tenantId: TenantId, code: string): Result<OrderWithAnomalies> {
    const { orders, tracking, workers } = this.deps;

    const order = orders.findByCode(tenantId, code);
    if (!order) return this.notFound(code);

    workers.recordSync(new Date());

    if (order.status === 'Entregue') {
      return success(this.enrich(order), 'Encomenda já entregue — sem novas movimentações.');
    }

    const update = tracking.fetchUpdate(order);
    if (!update) {
      return success(this.enrich(order), 'Nenhuma movimentação nova desde a última consulta.');
    }

    const updated = this.applyUpdate(order, update);
    orders.update(updated);

    return success(this.enrich(updated), `Movimentação nova: ${update.event.title}`);
  }

  private applyUpdate(order: Order, update: ReturnType<ICarrierTrackingGateway['fetchUpdate']>): Order {
    if (!update) return order;
    return { ...order, status: update.status, timeline: [update.event, ...order.timeline] };
  }

  /** So avisa o cliente final das anomalias cujo gatilho (RF05) esta ligado. */
  private publishAlerts(order: Order, enriched: OrderWithAnomalies): void {
    if (!enriched.hasAnomaly) return;

    const triggers = this.deps.triggers.list();
    const notifiable = enriched.anomalies.filter((a) =>
      this.deps.notifications.wasNotified(a.rule, triggers),
    );
    if (notifiable.length > 0) this.deps.alerts.publish(order, notifiable);
  }

  /** Acrescenta a cada encomenda o que as regras de dominio derivaram dela. */
  private enrich(order: Order): OrderWithAnomalies {
    const anomalies = this.deps.anomalies.detect(order);
    return { ...order, anomalies, hasAnomaly: anomalies.length > 0 };
  }

  private notFound(code: string): Result<never> {
    return failure('not_found', 'Encomenda não encontrada.', [
      `Nenhuma encomenda com o código ${code}.`,
    ]);
  }
}
