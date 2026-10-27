/**
 * Contas e empresas simuladas (RF10).
 *
 * Sao duas empresas clientes para que o isolamento multi-tenant seja verificavel: entrar com
 * uma conta da Aurora nunca pode revelar encomenda da Bonsai.
 *
 * As senhas estao em texto puro de proposito. Isto e um mock de frontend, e escreve-las aqui
 * deixa obvio que a autenticacao de verdade ainda nao existe. Quando o backend entrar, o
 * arquivo inteiro desaparece.
 */

import type { Tenant, User } from '../types';

export const MOCK_TENANTS: Tenant[] = [
  { id: 'tenant-aurora', name: 'Aurora Comércio' },
  { id: 'tenant-bonsai', name: 'Bonsai Distribuidora' },
];

export const MOCK_USERS: User[] = [
  {
    id: 'u-marina',
    name: 'Marina Alves',
    email: 'marina@aurora.com.br',
    password: 'operador',
    role: 'Operador de Logística',
    tenantId: 'tenant-aurora',
  },
  {
    id: 'u-carlos',
    name: 'Carlos Menezes',
    email: 'carlos@aurora.com.br',
    password: 'admin',
    role: 'Admin',
    tenantId: 'tenant-aurora',
  },
  {
    id: 'u-tais',
    name: 'Taís Moreira',
    email: 'tais@aurora.com.br',
    password: 'suporte',
    role: 'Suporte',
    tenantId: 'tenant-aurora',
  },
  {
    id: 'u-diego',
    name: 'Diego Ramos',
    email: 'diego@bonsai.com.br',
    password: 'bonsai',
    role: 'Operador de Logística',
    tenantId: 'tenant-bonsai',
  },
];
