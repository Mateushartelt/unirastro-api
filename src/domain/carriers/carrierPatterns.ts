/**
 * Formatos das transportadoras integradas nesta fase. Vieram do prototipo do design.
 *
 * E so dado: o CarrierDetector recebe esta lista no composition root.
 */

import type { CarrierPattern } from './CarrierDetector';

export const CARRIER_PATTERNS: readonly CarrierPattern[] = [
  { carrier: 'Correios', pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/, hint: 'Formato AA000000000BR' },
  { carrier: 'Jadlog', pattern: /^\d{14}$/, hint: '14 dígitos' },
  { carrier: 'Loggi', pattern: /^LG\d{10}$/, hint: 'Prefixo LG + 10 dígitos' },
  { carrier: 'Total Express', pattern: /^TE\d{12}$/, hint: 'Prefixo TE + 12 dígitos' },
];
