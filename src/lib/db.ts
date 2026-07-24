import Knex from "knex";
import oracledb from "oracledb";

// CLOB columns (notes, justification, body, formData, ...) should come back
// as plain strings, not Lob streams.
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

function createDb() {
  // node-oracledb's thin-mode Easy Connect syntax only understands
  // host:port/service_name — the old host:port:SID shorthand isn't valid
  // Easy Connect, so a SID-based connection needs a full descriptor.
  const connectString = process.env.SID_NAME
    ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.HOST_NAME})(PORT=${process.env.PORT_NAME}))(CONNECT_DATA=(SID=${process.env.SID_NAME})))`
    : `${process.env.HOST_NAME}:${process.env.PORT_NAME}/${process.env.SERVICE_NAME}`;

  return Knex({
    client: "oracledb",
    connection: {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString,
    },
    pool: { min: 2, max: 10 },
  });
}

// Unlike the old Prisma client, a Knex instance has no generated-schema cache
// to go stale across hot reloads, so we always reuse a single connection pool
// (recreating it per request in dev would exhaust Oracle's connection limit).
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

export const db = globalForDb.db ??= createDb();
