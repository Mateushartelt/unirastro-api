/** Sobe a API numa porta livre e devolve um cliente HTTP minimo para os testes. */

import type { AddressInfo } from 'node:net';
import { createBackend } from '../src/composition/container';
import type { IAlertPublisher } from '../src/repositories/ports';

export interface Api {
  call(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: any }>;
  login(email: string, password: string): Promise<string>;
  close(): Promise<void>;
}

export async function startApi(alerts?: IAlertPublisher, databaseFile?: string): Promise<Api> {
  const app = createBackend({ tokenSecret: 'test-secret', alerts, databaseFile });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api`;

  const call: Api['call'] = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  };

  return {
    call,
    async login(email, password) {
      const { json } = await call('POST', '/auth/login', { email, password });
      return json.data.token;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
