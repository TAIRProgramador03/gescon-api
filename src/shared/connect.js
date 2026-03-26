const odbc = require("odbc");
const { dbConfig } = require("./conf.js");

let pool = null;

const conDb = async (dbUser, dbPassword) => {
  try {
    if (!pool) {
      pool = await odbc.pool({
        connectionString: `DSN=${dbConfig.DSN};UID=${dbUser};PWD=${dbPassword};System=${dbConfig.system};CCSID=1208;UNICODE=UCS-2`,
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
