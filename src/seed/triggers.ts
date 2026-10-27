/**
 * Gatilhos de notificacao ao cliente final (RF05).
 *
 * Os quatro primeiros correspondem a regras de anomalia. Essa correspondencia nao e
 * decorativa: a central de incidentes usa o estado do gatilho para decidir se o cliente final
 * ja foi avisado. Quem declara a correspondencia e a propria regra (campo `triggerId` em
 * domain/anomalies/rules), e nao mais um mapa guardado junto dos mocks. Desligar "Rota
 * desviada" faz os desvios passarem a aparecer como nao notificados, que e exatamente o
 * comportamento que o design mostra.
 *
 * Os dois ultimos sao avisos de status comum, sem anomalia envolvida.
 */

import type { NotificationTrigger } from '../types';

export const MOCK_TRIGGERS: NotificationTrigger[] = [
  { id: 'stall', label: 'Parada prolongada', hint: '> 36h na mesma unidade', enabled: true },
  { id: 'fail', label: 'Tentativa frustrada', hint: 'A cada tentativa não efetuada', enabled: true },
  { id: 'route', label: 'Rota desviada', hint: 'Fora do trajeto esperado', enabled: false },
  { id: 'late', label: 'Risco de atraso preditivo', hint: 'Antes do prazo expirar', enabled: true },
  { id: 'out', label: 'Saiu para entrega', hint: 'Aviso de chegada no dia', enabled: true },
  { id: 'done', label: 'Entregue', hint: 'Confirmação de recebimento', enabled: false },
];
