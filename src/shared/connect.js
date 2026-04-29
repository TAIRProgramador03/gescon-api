const odbc = require("odbc");
const { dbConfig, DB_USER, DB_PASSWORD, IP_ODBC_BD, SCHEMA_BD } = require("./conf.js");

let pool = null;

const conDb = async () => {
  try {
    if (!pool) {
      pool = await odbc.pool({
        connectionString: `DRIVER={IBM i Access ODBC Driver};SYSTEM=${IP_ODBC_BD};UID=${DB_USER};PWD=${DB_PASSWORD};NAM=1;DBQ=${SCHEMA_BD};CCSID=1208;UNICODE=UCS-2;`,
        initialSize: 10,
        maxSize: 40,
        incrementSize: 5
      });

      console.log("Pool de conexiones creada");
    }

    return pool;
  } catch (error) {
    console.error("Error de conexión a la base de datos:", error.message);
    throw error;
  }
};

module.exports = conDb;
