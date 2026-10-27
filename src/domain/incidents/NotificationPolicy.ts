/**
 * Decide se o cliente final ja foi avisado de um incidente (RF05 + RF06).
 *
 * A resposta depende do gatilho correspondente estar ligado. E assim que RF05 e RF06 se
 * encaixam: a parametrizacao do operador decide o que vira aviso automatico, e a central
 * mostra o resultado dessa decisao.
 *
 * Antes, a correspondencia regra -> gatilho era um mapa fixo em mocks/triggers.ts, ou seja,
 * uma regra de negocio guardada junto dos dados simulados. Agora ela e lida das proprias
 * regras: cada AnomalyRule declara seu `triggerId`, e uma regra nova traz o gatilho junto.
 */

import type { NotificationTrigger } from '../../types';
import type { AnomalyRule } from '../anomalies/AnomalyRule';

export class NotificationPolicy {
  private readonly triggerByRule: ReadonlyMap<string, string | null>;

  constructor(rules: readonly AnomalyRule[]) {
    this.triggerByRule = new Map(rules.map((rule) => [rule.name, rule.triggerId]));
  }

  wasNotified(ruleName: string, triggers: readonly NotificationTrigger[]): boolean {
    const triggerId = this.triggerByRule.get(ruleName);
    if (!triggerId) return false;
    return triggers.find((t) => t.id === triggerId)?.enabled ?? false;
  }
}
