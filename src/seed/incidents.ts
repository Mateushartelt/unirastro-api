/**
 * Incidentes de infraestrutura.
 *
 * A maioria dos incidentes da central nao mora aqui: ela e derivada das encomendas pelas
 * regras de anomalia, em lib/anomalyRules.ts. Este arquivo guarda apenas o que nao vem de uma
 * encomenda — falhas da propria plataforma.
 *
 * O caso abaixo existe porque o RNF03 promete resiliencia na integracao com transportadoras.
 * Mostrar que o sistema percebeu a queda do webhook, trocou para consulta ativa com retry e
 * nao perdeu evento nenhum e a prova visivel dessa promessa.
 */

import { SYSTEM_INCIDENT_KIND, type Incident } from '../types';
import { hoursAgo } from './seedClock';

export const MOCK_SYSTEM_INCIDENTS: Incident[] = [
  {
    id: 'sys-webhook-jadlog',
    tenantId: 'tenant-aurora',
    rule: SYSTEM_INCIDENT_KIND,
    severity: 'Info',
    title: 'Webhook da Jadlog sem resposta por 40 min',
    description:
      'Worker alternou para polling com retry e exponential backoff. Nenhum evento perdido.',
    code: null,
    carrier: 'Jadlog',
    detectedAt: hoursAgo(11),
    notified: false,
    resolved: true,
  },
  {
    id: 'sys-webhook-total',
    tenantId: 'tenant-bonsai',
    rule: SYSTEM_INCIDENT_KIND,
    severity: 'Info',
    title: 'Fila de eventos da Total Express acumulando',
    description:
      'Consumo abaixo da taxa de entrada há 25 min. Fila drenando após reprocessamento automático.',
    code: null,
    carrier: 'Total Express',
    detectedAt: hoursAgo(4),
    notified: false,
    resolved: false,
  },
];
