const odbc = require("odbc");
const { dbConfig } = require("./conf.js");

const conDb = async (dbUser, dbPassword) => {
  try {
    const connection = await odbc.connect(
      `DSN=${dbConfig.DSN};UID=${dbUser};PWD=${dbPassword};System=${dbConfig.system};CCSID=1208; UNICODE=UCS-2`,
    );

    console.log("Conexión de base de datos realizada");
    return connection;
  } catch (error) {
    console.error("Error de conexión a la base de datos:", error.message);
    throw error;
  }
};

module.exports = conDb;