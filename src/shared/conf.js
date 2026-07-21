const IP_LOCAL = process.env.IP_LOCAL;
const IP_ODBC_BD = process.env.IP_ODBC_BD;
const SCHEMA_BD = process.env.SCHEMA_BD;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DSN_DB = process.env.DSN_DB;

// MS
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

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
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_TENANT_ID
}