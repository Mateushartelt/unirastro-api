/** Situacao dos workers de rastreio, exibida na barra lateral. So le (IWorkerStatusReader). */

import type { IWorkerStatusReader } from '../repositories/ports';
import { success, type Result } from './result';

export class WorkerStatusService {
  private readonly reader: IWorkerStatusReader;

  constructor(reader: IWorkerStatusReader) {
    this.reader = reader;
  }

  get(): Result<{ lastSyncAt: string; queueSize: number }> {
    return success(this.reader.status());
  }
}
