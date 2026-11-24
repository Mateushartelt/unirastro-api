/**
 * Consulta um codigo de rastreio na transportadora real, sem subir a API.
 *
 *   npm run rastrear -- BR262730058243Y
 *
 * Usa as mesmas pecas da API: o CarrierDetector identifica a transportadora e o gateway real
 * do composition root (Shopee Xpress ou Melhor Rastreio) faz a consulta de verdade.
 */

import { CarrierDetector } from '../src/domain/carriers/CarrierDetector';
import { CARRIER_PATTERNS } from '../src/domain/carriers/carrierPatterns';
import { buildNewOrder } from '../src/domain/orders/newOrder';
import { createRealCarrierGateway } from '../src/composition/container';

const code = (process.argv[2] ?? '').trim().toUpperCase();
const carrier = new CarrierDetector(CARRIER_PATTERNS).detect(code);

if (!carrier) {
  console.error(`Código "${code}" não reconhecido. Formatos: ${CARRIER_PATTERNS.map((p) => `${p.carrier} (${p.hint})`).join(', ')}`);
  process.exit(1);
}

console.log(`${code} -> ${carrier}. Consultando a transportadora...`);
const order = buildNewOrder('cli', { code, recipient: 'CLI', city: '' }, carrier);
const update = await createRealCarrierGateway().fetchUpdate({ ...order, timeline: [] });

if (!update) {
  console.log('A transportadora não tem movimentação para este código.');
} else {
  console.log(`Status no UNIRASTRO: ${update.status}\n`);
  for (const e of update.events) {
    console.log(`${new Date(e.at).toLocaleString('pt-BR')}  ${e.title}  (${e.place})`);
  }
}
