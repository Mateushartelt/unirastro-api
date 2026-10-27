/**
 * Composition root da API: o unico lugar que conhece as classes concretas.
 *
 * Aqui se decide quais regras de anomalia existem, de onde vem cada dado e qual implementacao
 * atende cada porta. Controllers recebem servicos; servicos recebem portas. Trocar memoria por
 * PostgreSQL, ou a transportadora simulada pela API dos Correios, acontece neste arquivo.
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
import type { IAlertPublisher } from '../repositories/ports';

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
}

export function createBackend(options: BackendOptions) {
  // Dominio
  const anomalyDetector = new AnomalyDetector(ANOMALY_RULES);
  const notificationPolicy = new NotificationPolicy(ANOMALY_RULES);
  const carrierDetector = new CarrierDetector(CARRIER_PATTERNS);

  // Repositorios
  const orderRepository = new InMemoryOrderRepository(MOCK_ORDERS);
  const triggerRepository = new InMemoryTriggerRepository(MOCK_TRIGGERS);
  const systemIncidentRepository = new InMemorySystemIncidentRepository(MOCK_SYSTEM_INCIDENTS);
  const resolutionRepository = new InMemoryIncidentResolutionRepository(
    MOCK_SYSTEM_INCIDENTS.filter((i) => i.resolved),
  );
  const workerMonitor = new InMemoryWorkerMonitor({ lastSyncAt: new Date(), queueSize: 128 });
  const userDirectory = new InMemoryUserDirectory(MOCK_USERS, MOCK_TENANTS);

  // Integracoes
  const carrierGateway = new SimulatedCarrierGateway();
  const alertPublisher = options.alerts ?? new ConsoleAlertPublisher();

  // Servicos de aplicacao
  const ordersService = new OrdersService({
    orders: orderRepository,
    triggers: triggerRepository,
    tracking: carrierGateway,
    alerts: alertPublisher,
    workers: workerMonitor,
    anomalies: anomalyDetector,
    carriers: carrierDetector,
    notifications: notificationPolicy,
  });
  const incidentsService = new IncidentsService({
    orders: orderRepository,
    systemIncidents: systemIncidentRepository,
    resolutions: resolutionRepository,
    triggers: triggerRepository,
    anomalies: anomalyDetector,
    notifications: notificationPolicy,
  });

  // HTTP
  const signer = new TokenSigner(options.tokenSecret);
  return createApp(
    {
      auth: new AuthController(new AuthService(userDirectory), signer, userDirectory),
      orders: new OrdersController(ordersService),
      incidents: new IncidentsController(incidentsService),
      triggers: new TriggersController(new TriggersService(triggerRepository)),
      workers: new WorkersController(new WorkerStatusService(workerMonitor)),
    },
    signer,
  );
}
