/**
 * Permissoes por papel (RF10).
 *
 * Moravam em services/authService.ts, um modulo que tambem fazia login e gravava sessao no
 * navegador. Autorizacao e regra de negocio, nao detalhe de autenticacao, entao mora aqui.
 *
 * A matriz e dado, nao `if`. Uma permissao nova e uma linha a mais no mapa, e a AuthContext
 * resolve todas sem precisar conhecer cada uma (OCP).
 *
 * Suporte enxerga a configuracao de gatilhos, mas nao a altera: mudar um gatilho muda o que
 * milhares de clientes finais recebem, e isso e decisao de quem responde pela operacao.
 */

import type { Role } from '../types';

const PERMISSION_MATRIX = {
  editTriggers: ['Admin', 'Operador de Logística'],
  createOrders: ['Admin', 'Operador de Logística'],
  // Suporte trata incidentes, entao pode resolve-los.
  resolveIncidents: ['Admin', 'Operador de Logística', 'Suporte'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSION_MATRIX;

export type PermissionSet = Record<Permission, boolean>;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSION_MATRIX[permission] as readonly Role[]).includes(role);
}

/** Todas as permissoes resolvidas para um papel, ou todas negadas quando nao ha sessao. */
export function permissionsFor(role: Role | null): PermissionSet {
  const entries = (Object.keys(PERMISSION_MATRIX) as Permission[]).map(
    (permission) => [permission, role ? hasPermission(role, permission) : false] as const,
  );
  return Object.fromEntries(entries) as PermissionSet;
}
