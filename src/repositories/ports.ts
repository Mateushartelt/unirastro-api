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

import type { Anomaly, Incident, NotificationTrigger, Order, Tenant, User } from '../types';

/* ---------------------------- Repositorios ---------------------------- */

export interface IOrderRepository {
  listByTenant(tenantId: string): Order[];
  findByCode(tenantId: string, code: string): Order | null;
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
  listByTenant(tenantId: string): Incident[];
}

/** A decisao humana sobre incidentes: quais foram marcados como resolvidos. */
export interface IIncidentResolutionRepository {
  isResolved(tenantId: string, id: string): boolean;
  markResolved(tenantId: string, id: string): void;
  reopen(tenantId: string, id: string): void;
}

export interface IUserDirectory {
  findByEmail(email: string): User | null;
  findTenant(tenantId: string): Tenant | null;
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

/**
 * Movimentacoes novas devolvidas pela transportadora: so as que ainda nao estao na linha do
 * tempo da encomenda, da mais recente para a mais antiga, e o status que elas implicam.
 */
export interface TrackingUpdate {
  events: Order['timeline'];
  status: Order['status'];
}

/** A transportadora nao respondeu (rede, timeout, erro do servidor). */
export class CarrierUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarrierUnavailableError';
  }
}

/**
 * Integracao com as APIs das transportadoras (C1/C2: "APIs das Transportadoras").
 *
 * Assincrona porque a integracao real faz uma chamada de rede. Devolve null quando nao ha
 * novidade e lanca CarrierUnavailableError quando a transportadora nao responde.
 */
export interface ICarrierTrackingGateway {
  fetchUpdate(order: Order): Promise<TrackingUpdate | null>;
}

/** Envio do alerta proativo ao cliente final (C1/C2: "Servicos de Notificacao"). */
export interface IAlertPublisher {
  publish(order: Order, anomalies: readonly Anomaly[]): void;
}
