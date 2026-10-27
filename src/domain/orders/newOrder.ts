/**
 * Cadastro manual de encomenda (RF01): validacao e montagem.
 *
 * As duas coisas viviam no meio de services/ordersService.ts, junto com acesso ao store e
 * latencia simulada. Separadas, a regra de cadastro e testavel sem servico nenhum, e o
 * servico so orquestra: valida, monta, grava.
 */

import type { Carrier, Order, TenantId } from '../../types';
import { normalizeCode } from '../carriers/CarrierDetector';
import { deadlineInDays } from '../time';

export interface NewOrderInput {
  code: string;
  recipient: string;
  city: string;
}

/** Limpa o que o usuario digitou antes de validar e montar. */
export function normalizeNewOrder(input: NewOrderInput): NewOrderInput {
  return {
    code: normalizeCode(input.code),
    recipient: input.recipient.trim(),
    city: input.city.trim(),
  };
}

export interface NewOrderValidationError {
  message: string;
  detail: string;
}

/**
 * Valida o cadastro. `carrier` e o que o detector deduziu do codigo, e `isDuplicate` diz se a
 * empresa ja rastreia esse codigo. Devolve o primeiro erro, ou null quando esta tudo certo.
 */
export function validateNewOrder(
  input: NewOrderInput,
  carrier: Carrier | null,
  isDuplicate: boolean,
): NewOrderValidationError | null {
  if (!carrier) {
    return {
      message: 'Código não reconhecido.',
      detail: 'Informe um código válido de uma transportadora integrada.',
    };
  }

  if (!input.recipient) {
    return { message: 'Destinatário obrigatório.', detail: 'Informe o destinatário.' };
  }

  // A unicidade vale por empresa, nao globalmente: duas empresas podem legitimamente rastrear
  // codigos distintos que colidam, e nenhuma delas deve saber da existencia da outra.
  if (isDuplicate) {
    return { message: 'Código duplicado.', detail: 'Este código já está cadastrado.' };
  }

  return null;
}

/**
 * Monta a encomenda recem cadastrada.
 *
 * A transportadora nao e escolhida pelo usuario, e deduzida do codigo. Essa e a diferenca que
 * o requisito pede: quem cadastra cola o codigo e o sistema resolve o resto.
 */
export function buildNewOrder(
  tenantId: TenantId,
  input: NewOrderInput,
  carrier: Carrier,
  now: Date = new Date(),
): Order {
  return {
    code: input.code,
    tenantId,
    carrier,
    recipient: input.recipient,
    city: input.city || '—',
    region: 'Sudeste',
    // Prazo provisorio. A transportadora devolve o prazo real na primeira consulta.
    dueAt: deadlineInDays(7, now),
    origin: input.city || 'São Paulo, SP',
    plannedRoute: [],
    timeline: [
      {
        title: 'Cadastrado — aguardando primeira consulta à API',
        place: carrier,
        at: now.toISOString(),
        rawCode: 'LOCAL',
      },
    ],
    status: 'Postado',
  };
}
