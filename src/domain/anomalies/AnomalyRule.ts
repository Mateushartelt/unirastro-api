/**
 * Contrato de uma regra de anomalia (RF04).
 *
 * E o ponto de extensao do nucleo do produto. Para criar uma regra nova basta escrever uma
 * classe que implemente esta interface e registra-la no composition root
 * (composition/container.ts). Nem o AnomalyDetector, nem as regras existentes, nem os
 * servicos precisam ser editados (OCP).
 *
 * A interface e pequena de proposito (ISP): toda regra usa os tres membros, nenhuma precisa
 * deixar metodo vazio ou lancar "nao implementado" (LSP).
 */

import type { Anomaly, AnomalyRuleName, Order } from '../../types';

export interface AnomalyRule {
  /** Nome exibido na central e no detalhe da encomenda. */
  readonly name: AnomalyRuleName;

  /**
   * Gatilho de notificacao (RF05) que governa o aviso ao cliente final desta regra, ou null
   * quando a regra nunca gera aviso automatico.
   */
  readonly triggerId: string | null;

  /** Analisa a encomenda no instante `now` e devolve a anomalia encontrada, ou null. */
  evaluate(order: Order, now: Date): Anomaly | null;
}
