/**
 * Portas da API: o que os servicos de aplicacao precisam do mundo externo.
 *
 * Os servicos dependem destas interfaces, nunca das classes concretas (DIP). Hoje quem as
 * implementa sao repositorios em memoria e uma transportadora simulada; trocar por PostgreSQL ou
 * pela API real dos Correios e escrever outra classe e mudar uma linha no composition root.
 *
 * Cada interface atende um papel so (ISP). O monitor dos workers, por exemplo, tem uma porta de
 * escrita (quem registra atividade) e outra de leitura (quem exibe status).
 */

import type {
  Anomaly,
  Incident,
  NotificationTrigger,
  Order,
  Tenant,
  TenantId,
  User,
} from '../types';

/* ---------------------------- Repositorios ---------------------------- */

export interface IOrderRepository {
  listByTenant(tenantId: TenantId): Order[];
  findByCode(tenantId: TenantId, code: string): Order | null;
  add(order: Order): void;
  update(order: Order): void;
}

export interface ITriggerRepository {
  list(): NotificationTrigger[];
  findById(id: string): NotificationTrigger | null;
  update(trigger: NotificationTrigger): void;
}

/** Incidentes de infraestrutura, os unicos que existem como registro e nao sao derivados. */
export interface ISystemIncidentRepository {
  listByTenant(tenantId: TenantId): Incident[];
}

/** A decisao humana sobre incidentes: quais foram marcados como resolvidos. */
export interface IIncidentResolutionRepository {
  isResolved(tenantId: TenantId, id: string): boolean;
  markResolved(tenantId: TenantId, id: string): void;
  reopen(tenantId: TenantId, id: string): void;
}

export interface IUserDirectory {
  findByEmail(email: string): User | null;
  findTenant(tenantId: TenantId): Tenant | null;
}

/** Contas de demonstracao exibidas na tela de login. */
export interface IDemoAccountDirectory {
  listDemoAccounts(): { email: string; password: string; role: User['role']; tenant: string }[];
}

export interface IWorkerActivityRecorder {
  recordSync(at: Date): void;
  enqueue(count?: number): void;
}

export interface IWorkerStatusReader {
  status(): { lastSyncAt: string; queueSize: number };
}

/* ---------------------------- Integracoes ----------------------------- */

/** Proxima movimentacao devolvida pela transportadora, ou null quando nao ha novidade. */
export interface TrackingUpdate {
  event: Order['timeline'][number];
  status: Order['status'];
}

/** Integracao com as APIs das transportadoras (C1/C2: "APIs das Transportadoras"). */
export interface ICarrierTrackingGateway {
  fetchUpdate(order: Order): TrackingUpdate | null;
}

/** Envio do alerta proativo ao cliente final (C1/C2: "Servicos de Notificacao"). */
export interface IAlertPublisher {
  publish(order: Order, anomalies: readonly Anomaly[]): void;
}
