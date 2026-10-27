/**
 * Resultado de um caso de uso.
 *
 * Os servicos de aplicacao nao conhecem HTTP: dizem apenas o tipo da falha. Quem traduz
 * `not_found` em 404 e o controller. Assim a mesma regra serviria a uma fila ou a um CLI.
 */

export type FailureKind = 'invalid' | 'unauthorized' | 'forbidden' | 'not_found';

export type Result<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; kind: FailureKind; message: string; errors: string[] };

export function success<T>(data: T, message = ''): Result<T> {
  return { ok: true, data, message };
}

export function failure<T = never>(
  kind: FailureKind,
  message: string,
  errors: string[] = [],
): Result<T> {
  return { ok: false, kind, message, errors };
}
