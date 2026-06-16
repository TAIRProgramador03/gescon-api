const { decodeString, withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const listClient = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      let sql = `
        SELECT DISTINCT A.IDCLI, B.CLINOM
        FROM ${SCHEMA_BD}.PO_OPERACIONES A
        INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE
        WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***'
        ORDER BY CLINOM ASC
      `;

      if (roleId != 1 && roleId != 2) {
        sql = `
          SELECT DISTINCT PO.IDCLI, PO.CLINOM
          FROM SPEED400AT.MAE_OPERACION_X_USUARIO moxu
          LEFT JOIN (
            SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
            FROM SPEED400AT.PO_OPERACIONES A
            INNER JOIN SPEED400AT.TCLIE B
            ON A.IDCLI = B.CLICVE
            WHERE A.ID <> 86
            AND B.CLINOM <> '*** ANULADO ***'
          )PO
          ON MOXU.IDOPERACION = PO.ID
          LEFT JOIN SPEED400AT.T_US_GC tug
          ON MOXU.CH_CODI_USUARIO = TUG.USU
          LEFT JOIN SPEED400AT.T_RL_GC trg
          ON TUG.ID_RL = TRG.ID
          WHERE TUG.USU IS NOT NULL AND TUG.ID = ${idUser}
        `;
      }

      const result = await cn.query(sql);
      return result.map((row) => ({
        IDCLI: row.IDCLI.trim(),
        CLINOM: decodeString(row.CLINOM.trim()),
      }));
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los clientes:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener clientes" });
  }
};

const tableClient = async (req, res) => {
  const { idCli } = req.query;

  if (!idCli) {
    return res
      .status(400)
      .json({ success: false, message: "El idCli es obligatorio" });
  }

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `
        SELECT ID, NRO_CONTRATO AS DESCRIPCION, FECHA_FIRMA AS FECHACREA, CANT_VEHI AS TOTVEH, DURACION
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB
        WHERE ID_CLIENTE = ?
      `;
      const result = await cn.query(query, [idCli]);
      return result.map((row) => ({
        ID: row.ID,
        DESCRIPCION:
          row.DESCRIPCION !== null && row.DESCRIPCION !== undefined
            ? decodeString(row.DESCRIPCION.toString().trim())
            : null,
        FECHACREA:
          row.FECHACREA !== null && row.FECHACREA !== undefined
            ? row.FECHACREA.toString().trim()
            : null,
        TOTVEH:
          row.TOTVEH !== null && row.TOTVEH !== undefined
            ? row.TOTVEH.toString().trim()
            : null,
        DURACION:
          row.DURACION !== null && row.DURACION !== undefined
            ? row.DURACION.toString().trim()
            : null,
      }));
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  }
};

const tableClientLea = async (req, res) => {
  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `SELECT DISTINCT A.IDCLI, B.CLINOM, B.CLIRUC, B.CLIABR, B.CLIDIR FROM ${SCHEMA_BD}.PO_OPERACIONES A INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' ORDER BY CLINOM ASC`;
      const result = await cn.query(query);
      return result.map((row) => ({
        IDCLI:
          row.IDCLI !== null && row.IDCLI !== undefined
            ? row.IDCLI.toString().trim()
            : null,
        CLINOM:
          row.CLINOM !== null && row.CLINOM !== undefined
            ? decodeString(row.CLINOM.toString().trim())
            : null,
        CLIRUC:
          row.CLIRUC !== null && row.CLIRUC !== undefined
            ? row.CLIRUC.toString().trim()
            : null,
        CLIABR:
          row.CLIABR !== null && row.CLIABR !== undefined
            ? row.CLIABR.toString().trim()
            : null,
        CLIDIR:
          row.CLIDIR !== null && row.CLIDIR !== undefined
            ? decodeString(row.CLIDIR.toString().trim())
            : null,
      }));
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  }
};

const getClientsByContractPending = async (req, res) => {
  try {
    const result = await withConnection(async (cn) => {
      const sql = `
        SELECT DISTINCT C.IDCLI, C.CLINOM FROM (
          SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM SPEED400AT.PO_OPERACIONES A
          INNER JOIN SPEED400AT.TCLIE B
          ON A.IDCLI = B.CLICVE
          WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
        ) C
        LEFT JOIN SPEED400AT.TBLCONTRATO_CAB tc 
        ON C.IDCLI = TC.ID_CLIENTE 
        WHERE TC.NRO_CONTRATO LIKE 'CPEN-%'
        ORDER BY C.CLINOM
      `;

      const result = await cn.query(sql);

      return result.map((row) => ({
        IDCLI: row.IDCLI.trim(),
        CLINOM: row.CLINOM.trim(),
      }));
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Error al obtener los clientes con contratos pendiente:",
      error,
    );
    res
      .status(500)
      .json({
        success: false,
        message: "Error al obtener clientes con contratos pendiente",
      });
  }
};

const getClientsByDocumentPending = async (req, res) => {
  try {
    const result = await withConnection(async (cn) => {
      const sql = `
        SELECT DISTINCT C.IDCLI, C.CLINOM FROM (
          SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM SPEED400AT.PO_OPERACIONES A
          INNER JOIN SPEED400AT.TCLIE B
          ON A.IDCLI = B.CLICVE
          WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
        ) C
        LEFT JOIN SPEED400AT.TBLDOCUMENTO_CAB tc 
        ON C.IDCLI = TC.ID_CLIENTE 
        WHERE TC.NRO_DOC LIKE 'DPEN-%'
        ORDER BY C.CLINOM
      `;

      const result = await cn.query(sql);

      return result.map((row) => ({
        IDCLI: row.IDCLI.trim(),
        CLINOM: row.CLINOM.trim(),
      }));
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Error al obtener los clientes con documentos pendiente:",
      error,
    );
    res
      .status(500)
      .json({
        success: false,
        message: "Error al obtener clientes con documentos pendiente",
      });
  }
};

module.exports = {
  listClient,
  tableClient,
  tableClientLea,
  getClientsByContractPending,
  getClientsByDocumentPending,
};
