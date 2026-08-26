import fs from "node:fs";
import path from "node:path";
import type { DataSourceOptions } from "typeorm";
import { env } from "./env";
import { OrderItemEntity } from "../db/entities/OrderItemEntity";
import { OrderEntity } from "../db/entities/OrderEntity";
import { UserEntity } from "../db/entities/UserEntity";

function readSslCa(): string | undefined {
  if (env.pg.sslCaCert) {
    return env.pg.sslCaCert;
  }

  if (!env.pg.sslCaPath) {
    return undefined;
  }

  return fs.readFileSync(path.resolve(env.pg.sslCaPath), "utf8");
}

export function createDataSourceOptions(): DataSourceOptions {
  const ca = readSslCa();
  const ssl = ca ? { rejectUnauthorized: true, ca } : undefined;

  if (env.databaseUrl) {
    return {
      type: "postgres",
      url: env.databaseUrl,
      ssl,
      entities: [UserEntity, OrderEntity, OrderItemEntity],
      synchronize: false,
      extra: {
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000
      }
    };
  }

  return {
    type: "postgres",
    host: env.pg.host,
    port: env.pg.port,
    database: env.pg.database,
    username: env.pg.user,
    password: env.pg.password,
    ssl,
    entities: [UserEntity, OrderEntity, OrderItemEntity],
    synchronize: false,
    extra: {
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    }
  };
}
