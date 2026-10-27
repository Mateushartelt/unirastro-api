/** Gatilhos de notificacao (RF05). Separado dos incidentes: outro motivo de mudanca (SRP). */

import type { NotificationTrigger } from '../types';
import type { ITriggerRepository } from '../repositories/ports';
import { failure, success, type Result } from './result';

export class TriggersService {
  private readonly triggers: ITriggerRepository;

  constructor(triggers: ITriggerRepository) {
    this.triggers = triggers;
  }

  list(): Result<NotificationTrigger[]> {
    return success(this.triggers.list());
  }

  toggle(id: string): Result<NotificationTrigger[]> {
    const trigger = this.triggers.findById(id);

    if (!trigger) {
      return failure('not_found', 'Gatilho não encontrado.', [
        `Nenhum gatilho com o identificador ${id}.`,
      ]);
    }

    const updated = { ...trigger, enabled: !trigger.enabled };
    this.triggers.update(updated);

    return success(
      this.triggers.list(),
      `Gatilho "${updated.label}" ${updated.enabled ? 'ativado' : 'desativado'}`,
    );
  }
}
