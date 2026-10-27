/**
 * Traducao de Result para HTTP, no envelope { success, message, errors, data }.
 *
 * E o mesmo formato que o frontend ja le (ApiResponse), entao trocar o backend
 * simulado pelo real nao muda nada nas telas.
 */

import type { Response } from 'express';
import type { FailureKind, Result } from '../application/result';

const STATUS_BY_FAILURE: Record<FailureKind, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
};

export function send<T>(res: Response, result: Result<T>, successStatus = 200): void {
  if (result.ok) {
    res.status(successStatus).json({
      success: true,
      message: result.message,
      errors: [],
      data: result.data,
    });
    return;
  }

  sendFailure(res, STATUS_BY_FAILURE[result.kind], result.message, result.errors);
}

export function sendFailure(res: Response, status: number, message: string, errors: string[] = []) {
  res.status(status).json({ success: false, message, errors, data: null });
}
