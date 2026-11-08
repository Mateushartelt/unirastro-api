/**
 * Token de acesso no formato JWT (HS256), assinado com HMAC.
 *
 * O token carrega quem e o usuario, o papel e a empresa. E dai, e nao de parametro enviado pelo
 * cliente, que a API tira o tenant de cada consulta: o isolamento multi-tenant (RF10) passa a
 * ser garantido no servidor.
 *
 * Sem estado no servidor: reiniciar a API nao derruba as sessoes abertas.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '../types';

export interface AuthClaims {
  userId: string;
  tenantId: string;
  role: Role;
}

interface Payload extends AuthClaims {
  exp: number;
}

export class TokenSigner {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(secret: string, ttlSeconds = 8 * 60 * 60) {
    this.secret = secret;
    this.ttlSeconds = ttlSeconds;
  }

  sign(claims: AuthClaims): string {
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload: Payload = { ...claims, exp: Math.floor(Date.now() / 1000) + this.ttlSeconds };
    const body = `${header}.${encode(payload)}`;
    return `${body}.${this.signature(body)}`;
  }

  /** Claims do token, ou null quando a assinatura nao confere ou o token expirou. */
  verify(token: string): AuthClaims | null {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const expected = Buffer.from(this.signature(`${header}.${payload}`));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Payload;
      if (data.exp < Date.now() / 1000) return null;
      return { userId: data.userId, tenantId: data.tenantId, role: data.role };
    } catch {
      return null;
    }
  }

  private signature(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
