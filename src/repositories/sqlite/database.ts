/**
 * Conexao com o banco SQLite (modulo nativo node:sqlite, sem dependencia externa).
 *
 * Cria o arquivo e o esquema na primeira abertura. Passar ':memory:' abre um banco temporario.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS orders (
    position  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    code      TEXT NOT NULL,
    status    TEXT NOT NULL,
    data      TEXT NOT NULL,
    UNIQUE (tenant_id, code)
  )
`;

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}
