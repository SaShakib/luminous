import fs from "node:fs";
import path from "node:path";
import type { PoolConfig } from "pg";
import { env } from "./env";

function readSslCa(): string | undefined {
  if (env.pg.sslCaCert) {
    return env.pg.sslCaCert;
  }

  if (!env.pg.sslCaPath) {
    return undefined;
  }

  return fs.readFileSync(path.resolve(env.pg.sslCaPath), "utf8");
}

export function createPoolConfig(): PoolConfig {
  const ca = readSslCa();
  const ssl = ca ? { rejectUnauthorized: true, ca } : undefined;

  if (env.databaseUrl) {
    return {
      connectionString: env.databaseUrl,
      ssl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    };
  }

  return {
    host: env.pg.host,
    port: env.pg.port,
    database: env.pg.database,
    user: env.pg.user,
    password: env.pg.password,
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  };
}
