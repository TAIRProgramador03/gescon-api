require('dotenv').config();
const odbc = require("odbc");
const IP_ODBC_BD = process.env.IP_ODBC_BD;

async function connectToDatabase() {
  try {
    const connection = await odbc.connect(
      `DSN=QDSN_${IP_ODBC_BD};UID=ANALISTA;PWD=PROF$;System=${IP_ODBC_BD}`
    );
    const result = await connection.query(
      "SELECT * FROM SPEED400PI.PO_TERRENO"
    );
  } catch (error) {
    console.error("Error de conexión:", error);
  }
}

connectToDatabase();
