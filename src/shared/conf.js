const IP_LOCAL = process.env.IP_LOCAL;
const IP_ODBC_BD = process.env.IP_ODBC_BD;
const SCHEMA_BD = process.env.SCHEMA_BD;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DSN_DB = process.env.DSN_DB;
const CODE_SYSTEM = process.env.CODE_SYSTEM;

const SSO_SECRET_KEY =
  process.env.SSO_SECRET_KEY ||
  (() => {
    throw new Error("Falta configurar SSO_SECRET_KEY en el entorno");
  })();

const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? ".tair360.net" : undefined;

const dbConfig = {
  DSN: `QDSN_${IP_ODBC_BD}`,
  system: IP_ODBC_BD,
};

module.exports = {
  dbConfig,
  IP_LOCAL,
  SCHEMA_BD,
  DB_USER,
  DB_PASSWORD,
  IP_ODBC_BD,
  DSN_DB,
  CODE_SYSTEM,
  SSO_SECRET_KEY,
  COOKIE_DOMAIN,
};
