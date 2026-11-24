/**
 * Formatos das transportadoras aceitas no cadastro. Correios ficou de fora: sem contrato, nenhuma
 * fonte gratuita devolve o historico dos Correios de forma confiavel.
 *
 * Formatos das transportadoras integradas nesta fase. Vieram do prototipo do design.
 *
 * E so dado: o CarrierDetector recebe esta lista no composition root.
 */

import type { CarrierPattern } from './CarrierDetector';

export const CARRIER_PATTERNS: readonly CarrierPattern[] = [
  { carrier: 'Jadlog', pattern: /^\d{14}$/, hint: '14 dígitos' },
  { carrier: 'Loggi', pattern: /^LG\d{10}$/, hint: 'Prefixo LG + 10 dígitos' },
  { carrier: 'Total Express', pattern: /^TE\d{12}$/, hint: 'Prefixo TE + 12 dígitos' },
  { carrier: 'Shopee Xpress', pattern: /^BR\d{12}[A-Z]$/, hint: 'BR + 12 dígitos + letra' },
];
