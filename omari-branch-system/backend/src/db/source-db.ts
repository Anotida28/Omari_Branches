import sql from "mssql";

import { env } from "../config/env";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function isSourceDbConfigured(): boolean {
  return Boolean(
    env.SOURCE_SQL_SERVER &&
      env.SOURCE_SQL_DATABASE &&
      env.SOURCE_SQL_USER &&
      env.SOURCE_SQL_PASSWORD,
  );
}

function getConfig(): sql.config {
  return {
    server: env.SOURCE_SQL_SERVER ?? "",
    port: env.SOURCE_SQL_PORT,
    database: env.SOURCE_SQL_DATABASE ?? "",
    user: env.SOURCE_SQL_USER ?? "",
    password: env.SOURCE_SQL_PASSWORD ?? "",
    options: {
      encrypt: env.SOURCE_SQL_ENCRYPT,
      trustServerCertificate: env.SOURCE_SQL_TRUST_SERVER_CERTIFICATE,
      serverName: env.SOURCE_SQL_TLS_SERVER_NAME,
    },
    connectionTimeout: env.SOURCE_SQL_CONNECT_TIMEOUT_MS,
    requestTimeout: env.SOURCE_SQL_REQUEST_TIMEOUT_MS,
  };
}

export async function getSourcePool(): Promise<sql.ConnectionPool> {
  if (!isSourceDbConfigured()) {
    throw new Error("Source SQL connection is not configured.");
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getConfig())
      .connect()
      .catch((error: unknown) => {
        poolPromise = null;
        throw error;
      });
  }

  return poolPromise;
}
