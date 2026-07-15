const {
  decodeString,
  withConnection,
  transformType,
} = require("../../shared/utils.js");
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

      if (roleId == 3) {
        sql = `
          SELECT DISTINCT PO.IDCLI, PO.CLINOM
          FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
          LEFT JOIN (
            SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
            FROM ${SCHEMA_BD}.PO_OPERACIONES A
            INNER JOIN ${SCHEMA_BD}.TCLIE B
            ON A.IDCLI = B.CLICVE
            WHERE A.ID <> 86
            AND B.CLINOM <> '*** ANULADO ***'
          )PO
          ON MOXU.IDOPERACION = PO.ID
          LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
          ON MOXU.CH_CODI_USUARIO = TUG.USU
          LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
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
          FROM ${SCHEMA_BD}.PO_OPERACIONES A
          INNER JOIN ${SCHEMA_BD}.TCLIE B
          ON A.IDCLI = B.CLICVE
          WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
        ) C
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc 
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
    res.status(500).json({
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
          FROM ${SCHEMA_BD}.PO_OPERACIONES A
          INNER JOIN ${SCHEMA_BD}.TCLIE B
          ON A.IDCLI = B.CLICVE
          WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
        ) C
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc 
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
    res.status(500).json({
      success: false,
      message: "Error al obtener clientes con documentos pendiente",
    });
  }
};

const getClientAbr = async (req, res) => {
  const { onlyAbr } = req.query;
  const isOnlyAbr = onlyAbr == "true" || onlyAbr == true;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      let sql = `
        SELECT T.ID, T.CORR, C.CLINOM, T.RUC, T.CONTACTO FROM ${SCHEMA_BD}.TBLCODINI t 
        INNER JOIN (
          SELECT DISTINCT PO.IDCLI, TC.CLINOM, TC.CLIRUC 
          FROM ${SCHEMA_BD}.PO_OPERACIONES PO
          INNER JOIN ${SCHEMA_BD}.TCLIE TC
          ON PO.IDCLI = TC.CLICVE
          WHERE PO.ID <> 86
          AND TC.CLINOM <> '*** ANULADO ***'
        ) C
        ON T.CLIENTE = C.IDCLI
        ${isOnlyAbr ? "WHERE T.CORR IS NOT NULL" : ""}
        ORDER BY C.CLINOM ASC
      `;

      const result = await cn.query(sql);
      return result.map((row) => ({
        id: row.ID,
        abreviatura: row.CORR ? row.CORR.trim() : null,
        cliente: row.CLINOM.trim(),
        ruc: row.RUC.trim(),
        contacto: row.CONTACTO ? row.CONTACTO.trim() : null,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los clientes:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener clientes" });
  }
};

const updateClientAbr = async (req, res) => {
  const id = Number(req.params.id);

  const { abreviature } = req.body;

  if (isNaN(id))
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });

  try {
    const findAbr = await withConnection(async (cn) => {
      let sql = `
        SELECT T.CORR FROM ${SCHEMA_BD}.TBLCODINI T
        WHERE T.CORR = ? AND T.ID <> ?
      `;

      const result = await cn.query(sql, [abreviature, id]);

      return result[0] || result.length > 0 ? true : false;
    });

    if (findAbr)
      return res
        .status(409)
        .json({ success: false, message: "La abreviatura enviada ya existe" });

    await withConnection(async (cn) => {
      const sql = `
        UPDATE ${SCHEMA_BD}.TBLCODINI
        SET CORR = ?
        WHERE ID = ?
      `;

      await cn.query(sql, [abreviature, id]);
    });

    return res
      .status(200)
      .json({ success: true, message: "Cliente actualizado con éxito" });
  } catch (error) {
    console.error("Error al actualizar el cliente:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al actualizar el cliente" });
  }
};

const getClientSummary = async (req, res) => {
  const { cliente, fromDate, toDate, onlyAssign } = req.query;

  const onlyDate = onlyAssign == 'true' || onlyAssign == true;

  const typeCli = {
    1: "Avicola",
    2: "Contratista Minera",
    3: "Energía",
    4: "Gobierno",
    5: "Inmobiliaria",
    6: "Minería",
    7: "Pesquera",
    8: "Seguridad",
    9: "Telefonía",
    10: "Transportes",
    11: "Otros",
  };

  try {
    const condiciones = [];
    const params = [];

    const toYYYYMMDD = (dateStr) => dateStr.replaceAll("-", "");

    if (cliente) {
      condiciones.push("C.ID_CLIENTE = ?");
      params.push(cliente);
    }

    if (fromDate && toDate) {
      condiciones.push("C.FECHA_MAX BETWEEN ? AND ?");
      params.push(toYYYYMMDD(fromDate), toYYYYMMDD(toDate));
    } else if (fromDate) {
      condiciones.push("C.FECHA_MAX >= ?");
      params.push(toYYYYMMDD(fromDate));
    } else if (toDate) {
      condiciones.push("C.FECHA_MAX <= ?");
      params.push(toYYYYMMDD(toDate));
    }

    const filtros =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const result = await withConnection(async (cn) => {
      const sql = `
        SELECT * FROM (
          SELECT 
            C.IDCLI AS ID_CLIENTE,
            C.CLINOM AS CLIENTE, 
            TC.ID AS ID_CONTRATO,
            TC.NRO_CONTRATO AS CONTRATO, 
            'P' AS CLASE,
            TC.TIPO_CLI AS RUBRO, 
            COUNT(TAD.ID) AS TOTAL_UNIDADES, 
            TC.DURACION AS PLAZO, 
            TC.FECHA_FIRMA AS FECHA_FIRMA, 
            COALESCE(MIN(TAD.FECHA_INI), '') AS FECHA_MIN,
            COALESCE(MAX(TAD.FECHA_FIN), '') AS FECHA_MAX
          FROM (
            SELECT DISTINCT PO.IDCLI, TC.CLINOM
            FROM ${SCHEMA_BD}.PO_OPERACIONES PO
            INNER JOIN ${SCHEMA_BD}.TCLIE TC
            ON PO.IDCLI = TC.CLICVE
            WHERE PO.ID <> 86
            AND TC.CLINOM <> '*** ANULADO ***'
          ) C
          LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc 
          ON C.IDCLI = CAST(TC.ID_CLIENTE AS CHAR(11))
          LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET tad 
          ON TAD.ID_CONTRATO = TC.ID AND TAD.CLASE_CONTRATO = 'P'
          WHERE TC.ID IS NOT NULL ${onlyDate ? "AND TAD.ID IS NOT NULL" : ""}
          GROUP BY C.IDCLI, TC.ID, C.CLINOM, TC.NRO_CONTRATO, TC.TIPO_CLI, TC.DURACION, TC.FECHA_FIRMA
          
          UNION ALL
          
          SELECT 
            C.IDCLI AS ID_CLIENTE,
            C.CLINOM AS CLIENTE, 
            TC.ID AS ID_CONTRATO,
            TC.NRO_DOC AS CONTRATO, 
            'H' AS CLASE,
            TC2.TIPO_CLI AS RUBRO, 
            COUNT(TAD.ID) AS TOTAL_UNIDADES, 
            TC.DURACION AS PLAZO, 
            TC.FECHA_FIRMA AS FECHA_FIRMA, 
            COALESCE(MIN(TAD.FECHA_INI), '') AS FECHA_MIN,
            COALESCE(MAX(TAD.FECHA_FIN), '') AS FECHA_MAX
          FROM (
            SELECT DISTINCT PO.IDCLI, TC.CLINOM
            FROM ${SCHEMA_BD}.PO_OPERACIONES PO
            INNER JOIN ${SCHEMA_BD}.TCLIE TC
            ON PO.IDCLI = TC.CLICVE
            WHERE PO.ID <> 86
            AND TC.CLINOM <> '*** ANULADO ***'
          ) C
          LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc 
          ON C.IDCLI = CAST(TC.ID_CLIENTE AS CHAR(11))
          INNER JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc2 
          ON TC.ID_PADRE = TC2.ID
          LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET tad 
          ON TAD.ID_CONTRATO = TC.ID AND TAD.CLASE_CONTRATO = 'H'
          WHERE TC.ID IS NOT NULL ${onlyDate ? "AND TAD.ID IS NOT NULL" : ""}
          GROUP BY C.IDCLI, TC.ID, C.CLINOM, TC.NRO_DOC, TC2.TIPO_CLI, TC.DURACION, TC.FECHA_FIRMA
        ) C 
        ${filtros}
        ORDER BY C.CLIENTE, C.CONTRATO
      `;

      const result = await cn.query(sql, params);

      return result.map((cli) => ({
        idCliente: cli.ID_CLIENTE.trim(),
        idContrato: cli.ID_CONTRATO,
        cliente: cli.CLIENTE.trim(),
        contrato: cli.CONTRATO.trim(),
        clase: cli.CLASE,
        rubro: transformType(cli.RUBRO.trim(), typeCli),
        total: cli.TOTAL_UNIDADES,
        plazo: cli.PLAZO.trim(),
        fecFirma: cli.FECHA_FIRMA.trim(),
        fecMin: cli.FECHA_MIN.trim(),
        fecMax: cli.FECHA_MAX.trim(),
      }));
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener clientes fecha max y min: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener clientes fecha max y min",
    });
  }
};

const getClientOpeSummary = async (req, res) => {
  const { cliente, contrato, clase } = req.query;

  if (!cliente || (!contrato && !clase))
    return res.status(400).json({
      success: false,
      message: "Los parametros cliente, contrato y clase son obligatorios",
    });

  const typeCli = {
    1: "Avicola",
    2: "Contratista Minera",
    3: "Energía",
    4: "Gobierno",
    5: "Inmobiliaria",
    6: "Minería",
    7: "Pesquera",
    8: "Seguridad",
    9: "Telefonía",
    10: "Transportes",
    11: "Otros",
  };

  try {
    const result = await withConnection(async (cn) => {
      const sql = `
        SELECT * FROM (
          SELECT
            PO.DESCRIPCION AS OPERACION,
            COUNT(TAD.ID) AS TOTAL_UNIDADES,
            TC.DURACION AS PLAZO,
            TC.FECHA_FIRMA AS FECHA_FIRMA,
            COALESCE(TRIM(MIN(TAD.FECHA_INI)), '') AS FECHA_MIN,
            COALESCE(TRIM(MAX(TAD.FECHA_FIN)), '') AS FECHA_MAX
          FROM SPEED400AT.PO_OPERACIONES PO
          LEFT JOIN (
            SELECT DISTINCT PO.IDCLI, TC.CLINOM
            FROM SPEED400AT.PO_OPERACIONES PO
            INNER JOIN SPEED400AT.TCLIE TC
            ON PO.IDCLI = TC.CLICVE
            WHERE PO.ID <> 86
            AND TC.CLINOM <> '*** ANULADO ***'
          ) C
          ON PO.IDCLI = C.IDCLI
          LEFT JOIN SPEED400AT.TBLCONTRATO_CAB tc
          ON C.IDCLI = CAST(TC.ID_CLIENTE AS CHAR(11))
          LEFT JOIN SPEED400AT.TBL_ASIGNACION_DET tad
          ON PO.ID = TAD.ID_OPE 
          AND TAD.ID_CONTRATO = TC.ID 
          AND TAD.CLASE_CONTRATO = 'P'
          WHERE TC.ID IS NOT NULL AND PO.IDCLI = ? AND TAD.ID_CONTRATO = ? AND TAD.CLASE_CONTRATO = ?
          GROUP BY PO.DESCRIPCION, TC.DURACION, TC.FECHA_FIRMA

          UNION ALL

          SELECT
            PO.DESCRIPCION AS OPERACION,
            COUNT(TAD.ID) AS TOTAL_UNIDADES,
            TC.DURACION AS PLAZO,
            TC.FECHA_FIRMA AS FECHA_FIRMA,
            COALESCE(TRIM(MIN(TAD.FECHA_INI)), '') AS FECHA_MIN,
            COALESCE(TRIM(MAX(TAD.FECHA_FIN)), '') AS FECHA_MAX
          FROM SPEED400AT.PO_OPERACIONES PO
          LEFT JOIN (
            SELECT DISTINCT PO.IDCLI, TC.CLINOM
            FROM SPEED400AT.PO_OPERACIONES PO
            INNER JOIN SPEED400AT.TCLIE TC
            ON PO.IDCLI = TC.CLICVE
            WHERE PO.ID <> 86
            AND TC.CLINOM <> '*** ANULADO ***'
          ) C
          ON PO.IDCLI = C.IDCLI
          LEFT JOIN SPEED400AT.TBLDOCUMENTO_CAB tc
          ON C.IDCLI = CAST(TC.ID_CLIENTE AS CHAR(11))
          LEFT JOIN SPEED400AT.TBL_ASIGNACION_DET tad
          ON PO.ID = TAD.ID_OPE 
          AND TAD.ID_CONTRATO = TC.ID 
          AND TAD.CLASE_CONTRATO = 'H'
          WHERE TC.ID IS NOT NULL AND PO.IDCLI = ? AND TAD.ID_CONTRATO = ? AND TAD.CLASE_CONTRATO = ?
          GROUP BY PO.DESCRIPCION, TC.DURACION, TC.FECHA_FIRMA
        ) C
        ORDER BY C.OPERACION
      `;

      const result = await cn.query(sql, [cliente, contrato, clase, cliente, contrato, clase]);

      return result.map((cli) => ({
        operacion: cli.OPERACION.trim(),
        total: cli.TOTAL_UNIDADES,
        plazo: cli.PLAZO.trim(),
        fecFirma: cli.FECHA_FIRMA.trim(),
        fecMin: cli.FECHA_MIN.trim(),
        fecMax: cli.FECHA_MAX.trim(),
      }));
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error al obtener operaciones fecha max y min: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener operaciones fecha max y min",
    });
  }
};

module.exports = {
  listClient,
  tableClient,
  tableClientLea,
  getClientsByContractPending,
  getClientsByDocumentPending,
  getClientAbr,
  updateClientAbr,
  getClientSummary,
  getClientOpeSummary,
};
