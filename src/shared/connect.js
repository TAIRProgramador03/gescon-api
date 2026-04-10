const odbc = require("odbc");
const { dbConfig, DB_USER, DB_PASSWORD } = require("./conf.js");

let pool = null;

const conDb = async () => {
  try {
    if (!pool) {
      pool = await odbc.pool({
        connectionString: `DSN=${dbConfig.DSN};UID=${DB_USER};PWD=${DB_PASSWORD};System=${dbConfig.system};CCSID=1208;UNICODE=UCS-2`,
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
