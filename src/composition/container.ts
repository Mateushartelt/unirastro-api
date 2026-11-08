/**
 * Composition root da API: o unico lugar que conhece as classes concretas.
 *
 * Aqui se decide quais regras de anomalia existem, de onde vem cada dado e qual implementacao
 * atende cada porta. Controllers recebem servicos; servicos recebem portas. Trocar memoria por
 * SQLite/PostgreSQL, ou a transportadora simulada pela API dos Correios, acontece neste arquivo.
 *
 * Para criar uma regra de anomalia nova: escrever a classe em src/domain/anomalies/rules e
 * acrescenta-la em ANOMALY_RULES abaixo. So isso.
 */

import { AnomalyDetector } from '../domain/anomalies/AnomalyDetector';
import type { AnomalyRule } from '../domain/anomalies/AnomalyRule';
import { PredictiveDelayRiskRule } from '../domain/anomalies/rules/PredictiveDelayRiskRule';
import { RepeatedFailedAttemptsRule } from '../domain/anomalies/rules/RepeatedFailedAttemptsRule';
import { RouteDeviationRule } from '../domain/anomalies/rules/RouteDeviationRule';
import { StalledInTransitRule } from '../domain/anomalies/rules/StalledInTransitRule';
import { CarrierDetector } from '../domain/carriers/CarrierDetector';
import { CARRIER_PATTERNS } from '../domain/carriers/carrierPatterns';
import { NotificationPolicy } from '../domain/incidents/NotificationPolicy';
import { MOCK_SYSTEM_INCIDENTS } from '../seed/incidents';
import { MOCK_ORDERS } from '../seed/orders';
import { MOCK_TRIGGERS } from '../seed/triggers';
import { MOCK_TENANTS, MOCK_USERS } from '../seed/users';
import { AuthService } from '../application/AuthService';
import { IncidentsService } from '../application/IncidentsService';
import { OrdersService } from '../application/OrdersService';
import { TriggersService } from '../application/TriggersService';
import { WorkerStatusService } from '../application/WorkerStatusService';
import { AuthController } from '../controllers/AuthController';
import { IncidentsController } from '../controllers/IncidentsController';
import { OrdersController } from '../controllers/OrdersController';
import { TriggersController } from '../controllers/TriggersController';
import { WorkersController } from '../controllers/WorkersController';
import { createApp } from '../http/app';
import { TokenSigner } from '../http/TokenSigner';
import { ConsoleAlertPublisher } from '../integrations/ConsoleAlertPublisher';
import { SimulatedCarrierGateway } from '../integrations/SimulatedCarrierGateway';
import { InMemoryIncidentResolutionRepository } from '../repositories/InMemoryIncidentResolutionRepository';
import { InMemoryOrderRepository } from '../repositories/InMemoryOrderRepository';
import { InMemorySystemIncidentRepository } from '../repositories/InMemorySystemIncidentRepository';
import { InMemoryTriggerRepository } from '../repositories/InMemoryTriggerRepository';
import { InMemoryUserDirectory } from '../repositories/InMemoryUserDirectory';
import { InMemoryWorkerMonitor } from '../repositories/InMemoryWorkerMonitor';
import type { IAlertPublisher, IOrderRepository } from '../repositories/ports';
import { openDatabase } from '../repositories/sqlite/database';
import { SqliteOrderRepository } from '../repositories/sqlite/SqliteOrderRepository';

/** Regras de anomalia ativas (RF04): as estrategias que o AnomalyDetector executa. */
const ANOMALY_RULES: readonly AnomalyRule[] = [
  new StalledInTransitRule(),
  new RepeatedFailedAttemptsRule(),
  new RouteDeviationRule(),
  new PredictiveDelayRiskRule(),
];

export interface BackendOptions {
  tokenSecret: string;
  /** Permite aos testes observar os alertas publicados. */
  alerts?: IAlertPublisher;
  /** Arquivo SQLite das encomendas. Sem ele, as encomendas ficam so em memoria. */
  databaseFile?: string;
}

function createDomain() {
  return {
    anomalies: new AnomalyDetector(ANOMALY_RULES),
    notifications: new NotificationPolicy(ANOMALY_RULES),
    carriers: new CarrierDetector(CARRIER_PATTERNS),
  };
}

function createOrderRepository(databaseFile?: string): IOrderRepository {
  if (!databaseFile) return new InMemoryOrderRepository(MOCK_ORDERS);
  return new SqliteOrderRepository(openDatabase(databaseFile), MOCK_ORDERS);
}

function createRepositories(options: BackendOptions) {
  return {
    orders: createOrderRepository(options.databaseFile),
    triggers: new InMemoryTriggerRepository(MOCK_TRIGGERS),
    systemIncidents: new InMemorySystemIncidentRepository(MOCK_SYSTEM_INCIDENTS),
    resolutions: new InMemoryIncidentResolutionRepository(
      MOCK_SYSTEM_INCIDENTS.filter((i) => i.resolved),
    ),
    workers: new InMemoryWorkerMonitor({ lastSyncAt: new Date(), queueSize: 128 }),
    users: new InMemoryUserDirectory(MOCK_USERS, MOCK_TENANTS),
  };
}

function createServices(options: BackendOptions) {
  const domain = createDomain();
  const repos = createRepositories(options);

  const orders = new OrdersService({
    ...domain,
    orders: repos.orders,
    triggers: repos.triggers,
    workers: repos.workers,
    tracking: new SimulatedCarrierGateway(),
    alerts: options.alerts ?? new ConsoleAlertPublisher(),
  });
  const incidents = new IncidentsService({
    orders: repos.orders,
    systemIncidents: repos.systemIncidents,
    resolutions: repos.resolutions,
    triggers: repos.triggers,
    anomalies: domain.anomalies,
    notifications: domain.notifications,
  });

  return { repos, orders, incidents };
}

export function createBackend(options: BackendOptions) {
  const { repos, orders, incidents } = createServices(options);
  const signer = new TokenSigner(options.tokenSecret);

  return createApp(
    {
      auth: new AuthController(new AuthService(repos.users), signer, repos.users),
      orders: new OrdersController(orders),
      incidents: new IncidentsController(incidents),
      triggers: new TriggersController(new TriggersService(repos.triggers)),
      workers: new WorkersController(new WorkerStatusService(repos.workers)),
    },
    signer,
  );
}
