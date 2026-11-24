/**
 * Formatos das transportadoras aceitas no cadastro.
 *
 * Correios, Jadlog e Loggi ficaram de fora: sem contrato com elas, nenhuma fonte gratuita
 * devolveu o historico de um codigo real de forma confiavel (o agregador Melhor Rastreio nao
 * trouxe nada, e os sites delas exigem verificacao humana). Os nomes seguem no tipo Carrier
 * porque os dados de demonstracao usam.
 *
 * E so dado: o CarrierDetector recebe esta lista no composition root.
 */

import type { CarrierPattern } from './CarrierDetector';

export const CARRIER_PATTERNS: readonly CarrierPattern[] = [
  { carrier: 'Total Express', pattern: /^TE\d{12}$/, hint: 'Prefixo TE + 12 dígitos' },
  { carrier: 'Shopee Xpress', pattern: /^BR\d{12}[A-Z]$/, hint: 'BR + 12 dígitos + letra' },
];
