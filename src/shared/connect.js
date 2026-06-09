const odbc = require("odbc");
const { DB_USER, DB_PASSWORD, IP_ODBC_BD, SCHEMA_BD } = require("./conf.js");

let pool = null;
let keepAliveTimer = null;

const createPool = async () => {
  pool = await odbc.pool({
    connectionString: `DRIVER={IBM i Access ODBC Driver};SYSTEM=${IP_ODBC_BD};UID=${DB_USER};PWD=${DB_PASSWORD};NAM=1;DBQ=${SCHEMA_BD};CCSID=1208;UNICODE=UCS-2;TIMEOUT=30;`,
    initialSize: 5,
    maxSize: 40,
    incrementSize: 5,
  });
  console.log("Pool de conexiones creada");
  startKeepAlive();
};

const conDb = async () => {
  try {
    if (!pool) await createPool();
    return pool;
  } catch (error) {
    pool = null;
    console.error("Error de conexión a la base de datos:", error.message);
    throw error;
  }
};

const startKeepAlive = () => {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    if (!pool) return;
    let cn;
    try {
      cn = await pool.connect();
      await cn.query("SELECT 1 FROM SYSIBM.SYSDUMMY1");
    } catch (err) {
      console.warn("[keep-alive] Falló, recreando pool:", err.message);
      pool = null;
    } finally {
      if (cn) await cn.close().catch(() => {});
    }
  }, 4 * 60 * 1000);
};

const invalidatePool = () => {
  pool = null;
};

module.exports = conDb;
module.exports.invalidatePool = invalidatePool;
