const odbc = require("odbc");
const { DB_USER, DB_PASSWORD, IP_ODBC_BD, SCHEMA_BD } = require("./conf.js");

process.env.UV_THREADPOOL_SIZE = "16";

let pool = null;
let keepAliveTimer = null;
let poolCreationPromise = null;

// ── Circuit Breaker ────────────────────────────────────────────────────────
const circuit = {
  state: "closed",
  failures: 0,
  lastFailure: null,
  threshold: 3,
  cooldown: 30_000,
};

const circuitIsOpen = () => {
  if (circuit.state === "open") {
    const elapsed = Date.now() - circuit.lastFailure;
    if (elapsed > circuit.cooldown) {
      circuit.state = "half-open";
      console.log("[db] Circuit breaker: probando reconexión...");
      return false;
    }
    return true;
  }
  return false;
};

const recordSuccess = () => {
  circuit.failures = 0;
  circuit.state = "closed";
};

const recordFailure = () => {
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= circuit.threshold) {
    circuit.state = "open";
    console.warn(`[db] Circuit breaker ABIERTO — IBM no disponible, pausando ${circuit.cooldown / 1000}s`);
  }
};

// ── Pool ───────────────────────────────────────────────────────────────────
const createPool = async () => {
  if (poolCreationPromise) return poolCreationPromise;

  poolCreationPromise = (async () => {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("[db] Timeout creando pool — IBM i no responde")), 20_000)
      );
      pool = await Promise.race([
        odbc.pool({
          connectionString: `DRIVER={IBM i Access ODBC Driver};SYSTEM=${IP_ODBC_BD};UID=${DB_USER};PWD=${DB_PASSWORD};NAM=1;DBQ=${SCHEMA_BD};CCSID=1208;UNICODE=UCS-2;TIMEOUT=5;`,
          initialSize: 2,
          maxSize: 20,
          incrementSize: 2,
        }),
        timeout,
      ]);
      console.log("Pool de conexiones creada");
      recordSuccess();
      startKeepAlive();
    } catch (error) {
      pool = null;
      recordFailure();
      console.error("[db] Error creando pool:", error.message);
      throw error;
    } finally {
      poolCreationPromise = null;
    }
  })();

  return poolCreationPromise;
};

const conDb = async () => {
  if (circuitIsOpen()) {
    throw new Error("[db] Base de datos temporalmente no disponible");
  }

  try {
    if (!pool) await createPool();
    return pool;
  } catch (error) {
    pool = null;
    console.error("[db] Error de conexión:", error.message);
    throw error;
  }
};

const startKeepAlive = () => {
  if (keepAliveTimer) clearInterval(keepAliveTimer);

  keepAliveTimer = setInterval(async () => {
    if (!pool || circuitIsOpen()) return;
    let cn;
    try {
      cn = await pool.connect();
      await cn.query("SELECT 1 FROM SYSIBM.SYSDUMMY1");
      recordSuccess();
    } catch (err) {
      console.warn("[keep-alive] Falló:", err.message);
      recordFailure();
      pool = null;
    } finally {
      if (cn) await cn.close().catch(() => {});
    }
  }, 60_000); // ← 60s en vez de 4min
};

const invalidatePool = () => {
  pool = null;
};

module.exports = conDb;
module.exports.invalidatePool = invalidatePool;