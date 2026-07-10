const IP_LOCAL = process.env.IP_LOCAL;
const IP_ODBC_BD = process.env.IP_ODBC_BD;
const SCHEMA_BD = process.env.SCHEMA_BD;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DSN_DB = process.env.DSN_DB;

//formeasy api
const TOKEN_INTEGRATE = process.env.TOKEN_INTEGRATE;
const URI_FIRMEASY = process.env.URI_FIRMEASY;
const USER_FIRMEASY = process.env.USER_FIRMEASY;
const PASS_FIRMEASY = process.env.PASS_FIRMEASY;

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
  TOKEN_INTEGRATE,
  URI_FIRMEASY,
  USER_FIRMEASY,
  PASS_FIRMEASY,
  DSN_DB
}