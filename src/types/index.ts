/**
 * Modelo de dominio do UNIRASTRO.
 *
 * Os nomes de status e severidade sao os mesmos que aparecem na interface, em portugues,
 * porque sao exatamente o vocabulario do design. Manter assim evita uma camada de traducao
 * so para agradar o codigo.
 */

/* ------------------------------------------------------------------ *
 * Transportadoras
 * ------------------------------------------------------------------ */

export const CARRIERS = [
  'Correios',
  'Jadlog',
  'Loggi',
  'Total Express',
] as const;

export type Carrier = (typeof CARRIERS)[number];

/* ------------------------------------------------------------------ *
 * Encomendas
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  'Postado',
  'Em trânsito',
  'Saiu p/ entrega',
  'Parado',
  'Entrega frustrada',
  'Entregue',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REGIONS = [
  'Norte',
  'Nordeste',
  'Centro-Oeste',
  'Sudeste',
  'Sul',
] as const;

export type Region = (typeof REGIONS)[number];

/**
 * Um evento de movimentacao ja normalizado (RF03).
 *
 * `rawCode` guarda o codigo original da transportadora. O sistema padroniza o `title` para
 * exibicao, mas nao descarta o que veio da origem — e isso que torna o historico auditavel.
 */
export interface TrackingEvent {
  title: string;
  place: string;
  /** Momento do evento em ISO 8601. A exibicao relativa fica por conta de lib/format.ts. */
  at: string;
  /** Codigo bruto devolvido pela transportadora, preservado para auditoria. */
  rawCode: string;
}

export interface Order {
  code: string;
  tenantId: TenantId;
  carrier: Carrier;
  recipient: string;
  city: string;
  region: Region;
  status: OrderStatus;
  /** Prazo prometido ao cliente final, em ISO 8601. */
  dueAt: string;
  /** Origem do envio. */
  origin: string;
  /**
   * Paradas previstas pela transportadora, da origem ao destino.
   *
   * Numa integracao real esta lista viria do plano de rota da propria transportadora. Aqui
   * ela e o gabarito contra o qual a regra de desvio compara cada evento.
   */
  plannedRoute: string[];
  /** Do mais recente para o mais antigo, como o design exibe. */
  timeline: TrackingEvent[];
}

/** Encomenda com o que as regras de dominio derivaram dela. */
export interface OrderWithAnomalies extends Order {
  anomalies: Anomaly[];
  hasAnomaly: boolean;
}

/* ------------------------------------------------------------------ *
 * Anomalias e incidentes (RF04, RF06)
 * ------------------------------------------------------------------ */

/**
 * Nome da regra que produziu a anomalia ("Parada prolongada", "Rota desviada"...).
 *
 * E texto aberto de proposito (OCP). Antes era uma uniao fechada, e criar uma regra nova
 * obrigava a editar este arquivo. Agora cada regra declara o proprio nome em
 * domain/anomalies/rules, e o modelo nao precisa conhecer a lista.
 */
export type AnomalyRuleName = string;

/** Tipo dos incidentes de infraestrutura, que nao nascem de nenhuma regra de encomenda. */
export const SYSTEM_INCIDENT_KIND = 'Webhook indisponível';

export const SEVERITIES = ['Crítico', 'Atenção', 'Info'] as const;

export type Severity = (typeof SEVERITIES)[number];

/** O que uma regra de anomalia produz ao analisar uma encomenda. */
export interface Anomaly {
  rule: AnomalyRuleName;
  severity: Severity;
  title: string;
  description: string;
}

/** Uma anomalia promovida a item da central de incidentes. */
export interface Incident extends Anomaly {
  id: string;
  tenantId: TenantId;
  /** Codigo da encomenda, ou null para incidentes de infraestrutura. */
  code: string | null;
  carrier: Carrier;
  /** Momento em que o incidente foi detectado, em ISO 8601. */
  detectedAt: string;
  /** Se o cliente final ja recebeu o aviso proativo. */
  notified: boolean;
  resolved: boolean;
}

/* ------------------------------------------------------------------ *
 * Gatilhos de notificacao (RF05)
 * ------------------------------------------------------------------ */

export interface NotificationTrigger {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
}

/* ------------------------------------------------------------------ *
 * Contas, papeis e tenants (RF10)
 * ------------------------------------------------------------------ */

export const ROLES = ['Admin', 'Operador de Logística', 'Suporte'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Identificador da empresa cliente.
 *
 * Antes era a uniao dos dois tenants dos mocks, o que amarrava o modelo de dominio aos dados
 * simulados: cadastrar uma empresa nova exigiria editar este arquivo.
 */
export type TenantId = string;

export interface Tenant {
  id: TenantId;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  tenantId: TenantId;
}

/** O usuario como as telas o enxergam, ja sem a senha. */
export type Session = Omit<User, 'password'> & { tenantName: string };

/* ------------------------------------------------------------------ *
 * Envelope de resposta
 * ------------------------------------------------------------------ */

/**
 * Mesmo formato que o quizmaster-api devolve. Manter a simetria significa que trocar o mock
 * por uma chamada HTTP real nao muda como as telas leem a resposta.
 *
 * E uma uniao discriminada por `success`. Na versao anterior, uma falha devolvia
 * `data: null` disfarcado de `T`, e quem lia `data` sem checar `success` quebrava em tempo de
 * execucao (a AppShell fazia isso). Agora o compilador obriga a checagem.
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ApiSuccess<T> {
  success: true;
  message: string;
  errors: string[];
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors: string[];
  data: null;
}
