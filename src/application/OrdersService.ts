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
import type { Carrier, Order, OrderWithAnomalies } from '../types';
import {
  CarrierUnavailableError,
  type IAlertPublisher,
  type ICarrierTrackingGateway,
  type IOrderRepository,
  type ITriggerRepository,
  type IWorkerActivityRecorder,
  type TrackingUpdate,
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

  list(tenantId: string): Result<OrderWithAnomalies[]> {
    return success(this.deps.orders.listByTenant(tenantId).map((o) => this.enrich(o)));
  }

  get(tenantId: string, code: string): Result<OrderWithAnomalies> {
    const order = this.deps.orders.findByCode(tenantId, code);
    if (!order) return this.notFound(code);
    return success(this.enrich(order));
  }

  /** Cadastro de encomenda (RF01), na ordem do diagrama de sequencia. */
  async create(tenantId: string, input: NewOrderInput): Promise<Result<OrderWithAnomalies>> {
    const { orders, carriers, workers } = this.deps;

    // 1. detectarTransportadora(codigo) + validacao
    const clean = normalizeNewOrder(input);
    const carrier = carriers.detect(clean.code);
    const isDuplicate = orders.findByCode(tenantId, clean.code) !== null;

    const error = validateNewOrder(clean, carrier, isDuplicate);
    if (error || !carrier) {
      return failure('invalid', error?.message ?? 'Cadastro inválido.', error ? [error.detail] : []);
    }

    // 2. consultarRastreio(codigo): primeira consulta a transportadora. Se ela estiver fora do
    // ar o cadastro vale assim mesmo; a proxima consulta traz o historico.
    let order = buildNewOrder(tenantId, clean, carrier);
    const first = await this.track(order);
    if (first.ok) order = this.applyUpdate(order, first.data);
    workers.recordSync(new Date());

    // 3. avaliarAnomalias(eventos): cada AnomalyRule e uma estrategia (Strategy)
    // 5. opt [anomalia detectada]: publicarAlerta(encomenda), lembrando o que ja foi avisado
    order = this.publishNewAlerts(order);

    // 4. salvar(encomenda)
    orders.add(order);

    return success(this.enrich(order), createdMessage(carrier, first));
  }

  /** Consulta de status sob demanda (RF02). No sistema real quem faz isso e um worker. */
  async refresh(tenantId: string, code: string): Promise<Result<OrderWithAnomalies>> {
    const { orders, workers } = this.deps;

    const order = orders.findByCode(tenantId, code);
    if (!order) return this.notFound(code);

    workers.recordSync(new Date());

    if (order.status === 'Entregue') {
      return success(this.enrich(order), 'Encomenda já entregue — sem novas movimentações.');
    }

    const tracked = await this.track(order);
    if (!tracked.ok) return tracked;

    // Mesmo sem evento novo uma anomalia pode surgir: a parada prolongada nasce do tempo
    // passando. Por isso o alerta e avaliado em toda consulta, nao so quando ha movimentacao.
    const update = tracked.data;
    const updated = this.publishNewAlerts(this.applyUpdate(order, update));
    if (updated !== order) orders.update(updated);

    const message =
      update && update.events.length > 0
        ? updateMessage(update)
        : 'Nenhuma movimentação nova desde a última consulta.';
    return success(this.enrich(updated), message);
  }

  /** Consulta a transportadora e traduz a falha de rede em Result, sem deixar a excecao vazar. */
  private async track(order: Order): Promise<Result<TrackingUpdate | null>> {
    try {
      return success(await this.deps.tracking.fetchUpdate(order));
    } catch (error) {
      if (!(error instanceof CarrierUnavailableError)) throw error;
      return failure('unavailable', `${order.carrier} não respondeu.`, [error.message]);
    }
  }

  /**
   * Acrescenta os eventos novos. O marcador "aguardando primeira consulta" (rawCode LOCAL) sai
   * assim que a transportadora devolve historico: ele e mais novo que os eventos reais e
   * ficaria fora de ordem na linha do tempo.
   */
  private applyUpdate(order: Order, update: TrackingUpdate | null): Order {
    if (!update || update.events.length === 0) return order;
    const previous = order.timeline.filter((e) => e.rawCode !== 'LOCAL');
    return { ...order, status: update.status, timeline: [...update.events, ...previous] };
  }

  /**
   * Avisa o cliente final das anomalias novas cujo gatilho (RF05) esta ligado e devolve a
   * encomenda com `alertedRules` atualizado. Anomalia ja avisada nao gera alerta repetido;
   * anomalia com gatilho desligado fica de fora, para avisar se o gatilho for ligado depois.
   * Devolve o mesmo objeto quando nada mudou.
   */
  private publishNewAlerts(order: Order): Order {
    const anomalies = this.deps.anomalies.detect(order);
    const current = new Set(anomalies.map((a) => a.rule));
    const already = (order.alertedRules ?? []).filter((rule) => current.has(rule));

    const triggers = this.deps.triggers.list();
    const fresh = anomalies.filter(
      (a) => !already.includes(a.rule) && this.deps.notifications.wasNotified(a.rule, triggers),
    );
    if (fresh.length > 0) this.deps.alerts.publish(order, fresh);

    const alertedRules = [...already, ...fresh.map((a) => a.rule)];
    if (sameRules(alertedRules, order.alertedRules ?? [])) return order;
    return { ...order, alertedRules };
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

function createdMessage(carrier: Carrier, first: Result<TrackingUpdate | null>): string {
  const base = `Pedido cadastrado · ${carrier} identificada`;
  if (!first.ok) return `${base} · ${carrier} fora do ar, nova consulta mais tarde`;
  if (!first.data || first.data.events.length === 0) {
    return `${base} · ainda sem movimentação na transportadora`;
  }
  const n = first.data.events.length;
  return `${base} · ${eventCount(n)} ${n === 1 ? 'importada' : 'importadas'}`;
}

function updateMessage(update: TrackingUpdate): string {
  if (update.events.length === 1) return `Movimentação nova: ${update.events[0].title}`;
  return `${eventCount(update.events.length)} novas · última: ${update.events[0].title}`;
}

function eventCount(n: number): string {
  return n === 1 ? '1 movimentação' : `${n} movimentações`;
}

function sameRules(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((rule) => b.includes(rule));
}
