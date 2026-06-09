const iconv = require("iconv-lite");
const { SCHEMA_BD } = require("./conf.js");
const conDb = require("./connect.js");

// ← agrega 8413 (timeout de transferencia) y estados ODBC
const NETWORK_ERROR_CODES = [10054, 10060, 10061, 8413];
const NETWORK_ERROR_STATES = ["08S01", "08003", "HYT00"];

const isNetworkError = (err) =>
  err?.odbcErrors?.some(
    (e) =>
      NETWORK_ERROR_CODES.includes(e.code) ||
      NETWORK_ERROR_STATES.includes(e.state) // ← nuevo
  );

const withConnection = async (fn) => {
  let cn;
  try {
    const pool = await conDb();
    cn = await pool.connect();
    return await fn(cn);
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn("[withConnection] Error de red, invalidando pool y reintentando...");

      if (cn) await cn.close().catch(() => {});
      cn = undefined;
      conDb.invalidatePool();

      try {
        const freshPool = await conDb();
        cn = await freshPool.connect();
        return await fn(cn);
      } catch (retryErr) {
        console.error("[withConnection] Reintento fallido:", retryErr.message);
        throw retryErr;
      }
    }
    throw err;
  } finally {
    if (cn) await cn.close().catch(() => {});
  }
};

// resto del archivo sin cambios...
const decodeString = (str) => {
  return iconv.decode(Buffer.from(str, "binary"), "latin1");
};

function convertirFecha(fecha) {
  const transFecha = `${fecha}`
  return transFecha.replace(/-/g, "");
}

function funcionNumerica(valor) {
  if (!valor) return null;
  const partes = valor.split("_");
  return partes.length === 2 ? parseInt(partes[1], 10) : null;
}

function funcionParteVar(valor) {
  if (!valor) return null;
  return valor.charAt(0);
}

function transformType(value, object) {
  return object[value];
}

async function obtenerUltimoId(connection) {
  const result = await connection.query(
    `SELECT MAX(ID) AS ID FROM ${SCHEMA_BD}.TBLCONTRATO_CAB`,
  );
  return result.length > 0 ? result[0].ID : null;
}

async function obtenerUltimoIdDoc(connection) {
  const result = await connection.query(
    `SELECT MAX(ID) AS ID FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB`,
  );
  return result.length > 0 ? result[0].ID : null;
}

async function obtenerUltimoIdLea(connection) {
  const result = await connection.query(
    `SELECT MAX(ID) AS ID FROM ${SCHEMA_BD}.TBL_LEASING_CAB`
  );
  return result.length > 0 ? result[0].ID : null;
}

async function obtenerUltimoIdAsigna(connection) {
  const result = await connection.query(
    `SELECT MAX(ID) AS ID FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB`
  );
  return result.length > 0 ? result[0].ID : null;
}

module.exports = {
  decodeString,
  convertirFecha,
  funcionNumerica,
  funcionParteVar,
  obtenerUltimoId,
  obtenerUltimoIdDoc,
  obtenerUltimoIdLea,
  obtenerUltimoIdAsigna,
  transformType,
  withConnection,
};