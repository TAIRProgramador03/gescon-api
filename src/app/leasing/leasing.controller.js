const {
  decodeString,
  convertirFecha,
  funcionNumerica,
  funcionParteVar,
  obtenerUltimoIdLea,
  transformType,
  withConnection,
} = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const { moveFile, fileExists } = require("../../shared/service/aws-s3.js");

const listLeasing = async (req, res) => {
  try {
    const cleanedResult = await withConnection(async (cn) => {
      const result = await cn.query(
        `SELECT ID, NRO_LEASING FROM ${SCHEMA_BD}.TBL_LEASING_CAB ORDER BY NRO_LEASING ASC`,
      );

      // Decodificar los resultados desde latin1
      return result.map((row) => {
        return {
          ID: String(row.ID).trim(),
          NRO_LEASING: decodeString(row.NRO_LEASING.trim()),
        };
      });
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener leasing" });
  }
};

const listLeasingAdi = async (req, res) => {
  const { clienteId, contratoId } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const conditions = [];
      const params = [];

      if (clienteId) {
        conditions.push("ID_CLIENTE = ?");

        params.push(clienteId);
      }

      if (contratoId) {
        const [tipCon, idCon] = contratoId.split("_");

        conditions.push("ID_CONTRATO = ?");

        conditions.push("TIPCON = ?");

        params.push(idCon, tipCon);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const result = await cn.query(
        `
    SELECT ID, NRO_LEASING
    FROM ${SCHEMA_BD}.TBL_LEASING_CAB
    ${whereClause}
    ORDER BY NRO_LEASING ASC
    `,
        params,
      );

      // Decodificar los resultados desde latin1
      return result.map((row) => {
        return {
          ID: String(row.ID).trim(),
          NRO_LEASING: decodeString(row.NRO_LEASING.trim()),
        };
      });
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener leasing" });
  }
};

const listAllLeasing = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  const { bank, clientId, contractId, typeContract, leasingId } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      // let sql = `
      //   SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH AS CANTIDAD, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.TIPCON
      //   FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
      // `;
      let filtros = "";
      const params = [];
      const condiciones = [];

      // 🟢 BANCO (independiente)
      if (bank) {
        condiciones.push("L.BANCO = ?");
        params.push(bank);
      }

      // 🟢 CLIENTE (independiente)
      if (clientId) {
        condiciones.push("L.ID_CLIENTE = ?");
        params.push(clientId);
      }

      // 🔵 CONTRATO
      if (contractId) {
        condiciones.push("L.ID_CONTRATO = ?");
        params.push(contractId);

        if (typeContract === "P") {
          condiciones.push("L.TIPCON = 'P'");
        } else if (typeContract === "H") {
          condiciones.push("L.TIPCON = 'H'");
        }
      }

      if (leasingId) {
        condiciones.push("L.ID = ?");
        params.push(leasingId);
      }

      // 🔥 armar WHERE dinámico
      if (condiciones.length > 0) {
        filtros = " WHERE " + condiciones.join(" AND ");
      }

      let sql = `
      SELECT
        L.ID,
        L.NRO_LEASING,
        L.BANCO,
        L.CANT_VEH AS CANTIDAD,
        L.FECHA_INI,
        L.FECHA_FIN,
        L.PERIODO_GRACIA,
        L.PDF,
        L.TIPCON,
        COALESCE(tc.NRO_CONTRATO, tc2.NRO_DOC) AS NRO_CONTRATO,
        L.ID_CLIENTE,
        L.ID_CONTRATO,
        COALESCE(L.ID_CLIENTE_ASOCIADO, L.ID_CONTRATO) AS ID_CLIENTE_ASOCIADO,
        CL.CLINOM AS CLIENTE,
        COALESCE(CLA.CLINOM, CL.CLINOM) AS CLIENTE_ORIGEN
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc
      ON L.ID_CONTRATO = tc.ID AND L.TIPCON = 'P'
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc2
      ON L.ID_CONTRATO = TC2.ID AND L.TIPCON = 'H'
      LEFT JOIN (
        SELECT DISTINCT A.IDCLI, B.CLINOM
        FROM ${SCHEMA_BD}.PO_OPERACIONES A
        INNER JOIN ${SCHEMA_BD}.TCLIE B
        ON A.IDCLI = B.CLICVE
        WHERE A.ID <> 86
        AND B.CLINOM <> '*** ANULADO ***'
      ) CL
      ON CL.IDCLI = L.ID_CLIENTE
      LEFT JOIN (
        SELECT DISTINCT A.IDCLI, B.CLINOM
        FROM ${SCHEMA_BD}.PO_OPERACIONES A
        INNER JOIN ${SCHEMA_BD}.TCLIE B
        ON A.IDCLI = B.CLICVE
        WHERE A.ID <> 86
        AND B.CLINOM <> '*** ANULADO ***'
      ) CLA
      ON CLA.IDCLI = L.ID_CLIENTE_ASOCIADO
      ${filtros}
      ORDER BY L.ID ASC
    `;

      if (roleId != 1 && roleId != 2) {
        if (condiciones.length > 0) {
          filtros = " AND " + condiciones.join(" AND ");
        }

        sql = `
        SELECT
          L.ID,
          L.NRO_LEASING,
          L.BANCO,
          L.CANT_VEH AS CANTIDAD,
          L.FECHA_INI,
          L.FECHA_FIN,
          L.PERIODO_GRACIA,
          L.PDF,
          L.TIPCON,
          COALESCE(tc.NRO_CONTRATO, tc2.NRO_DOC) AS NRO_CONTRATO,
          L.ID_CLIENTE,
          L.ID_CONTRATO,
          COALESCE(L.ID_CLIENTE_ASOCIADO, L.ID_CONTRATO) AS ID_CLIENTE_ASOCIADO,
          CL.CLINOM AS CLIENTE,
          COALESCE(CLA.CLINOM, CL.CLINOM) AS CLIENTE_ORIGEN,
          CL.ID_USU
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc
        ON L.ID_CONTRATO = tc.ID AND L.TIPCON = 'P'
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc2
        ON L.ID_CONTRATO = TC2.ID AND L.TIPCON = 'H'
        LEFT JOIN (
          SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU
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
          WHERE TUG.USU IS NOT NULL
        ) CL
        ON CL.IDCLI = L.ID_CLIENTE
        LEFT JOIN (
          SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU
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
          WHERE TUG.USU IS NOT NULL
        ) CLA
        ON CLA.IDCLI = L.ID_CLIENTE_ASOCIADO
        WHERE CL.ID_USU = ${idUser} ${filtros}
        ORDER BY L.ID ASC
      `;
      }

      const result = await cn.query(sql, params);

      return result.map((row) => ({
        id: row.ID,
        nroLeasing: row.NRO_LEASING.trim(),
        banco: transformType(row.BANCO.trim(), {
          1: "BANBIF",
          2: "BBVA",
          3: "BCP",
          4: "HSBC",
          5: "INTERBANK",
          6: "SCOTIABANK",
          7: "TAIR",
          8: "SANTANDER",
        }),
        cantidad: row.CANTIDAD,
        fechaIni: String(row.FECHA_INI),
        fechaFin: String(row.FECHA_FIN),
        perGracia: row.PERIODO_GRACIA,
        archivoPdf: row.PDF.trim(),
        tipoCon: transformType(row.TIPCON.trim(), {
          P: "Contrato",
          H: "Documento",
        }),
        nroContrato: row.NRO_CONTRATO.trim(),
        cliente: row.CLIENTE.trim(),
        clienteOrigen: row.CLIENTE_ORIGEN ? row.CLIENTE_ORIGEN.trim() : "",
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener la lista de leasings", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener la lista de leasings",
    });
  }
};

const listLeasingOfClient = async (req, res) => {
  const { idCli } = req.query;

  // Validación de parametros query
  if (!idCli) {
    return res.status(400).json({
      success: false,
      message: "Los parámetros idCli son obligatorios.",
    });
  }

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `
        SELECT ID, NRO_LEASING
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB
        WHERE ID_CLIENTE = ? ORDER BY NRO_LEASING ASC
      `;

      const result = await cn.query(query, [idCli]);

      // Decodificar los resultados desde latin1
      return result.map((row) => {
        return {
          ID:
            row.ID !== null && row.ID !== undefined
              ? String(row.ID).trim()
              : null,
          NRO_LEASING:
            row.NRO_LEASING !== null && row.NRO_LEASING !== undefined
              ? decodeString(row.NRO_LEASING.trim())
              : null,
        };
      });
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener leasing" });
  }
};

const listLeasingByContract = async (req, res) => {
  const { contratoId, clienteId, tipoCon } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT A.ID, A.NRO_LEASING, A.CANT_VEH, A.FECHA_INI, A.FECHA_FIN, A.ID_CONTRATO, A.ID_CLIENTE
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
      ${contratoId && tipoCon && clienteId ? `WHERE A.ID_CLIENTE = ? AND A.ID_CONTRATO = ? AND TIPCON = ?` : contratoId && tipoCon ? `WHERE A.ID_CONTRATO = ? AND TIPCON = ?` : clienteId ? `WHERE A.ID_CLIENTE = ?` : ""}
    `;

      const params = [];

      if (contratoId && clienteId && tipoCon) {
        params.push(clienteId, contratoId, tipoCon);
      } else if (contratoId && tipoCon) {
        params.push(contratoId, tipoCon);
      } else if (clienteId) {
        params.push(clienteId);
      }

      const result = await cn.query(sql, params);

      return result.map((row) => ({
        id: row.ID,
        nroLeasing: row.NRO_LEASING ? row.NRO_LEASING.trim() : "",
        fechaInicio: row.FECHA_INI ? row.FECHA_INI.toString().trim() : "",
        fechaFin: row.FECHA_FIN ? row.FECHA_FIN.toString().trim() : "",
        cantVehi: row.CANT_VEH,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar leasings por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasings por contrato",
    });
  }
};

const getLeasingByContract = async (req, res) => {
  const { contratoId } = req.query;

  if (!contratoId) {
    return res.status(400).json({
      success: false,
      message: "El parametro contratoId debe ser obligatorio",
    });
  }

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `SELECT ID, NRO_LEASING FROM SPEED400AT.TBL_LEASING_CAB tlc WHERE ID_CONTRATO = ? AND TIPCON = 'P'`;

      const result = await cn.query(sql, [contratoId]);

      return result.map((row) => ({
        ID: row.ID,
        NRO_LEASING: row.NRO_LEASING.trim(),
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar leasings por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasings por contrato",
    });
  }
};

const getLeasingByDocument = async (req, res) => {
  const { documentoId } = req.query;

  if (!documentoId) {
    return res.status(400).json({
      success: false,
      message: "El parametro documentoId debe ser obligatorio",
    });
  }

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `SELECT ID, NRO_LEASING FROM SPEED400AT.TBL_LEASING_CAB tlc WHERE ID_CONTRATO = ? AND TIPCON = 'H'`;

      const result = await cn.query(sql, [documentoId]);

      return result.map((row) => ({
        ID: row.ID,
        NRO_LEASING: row.NRO_LEASING.trim(),
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar leasings por documento: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasings por documento",
    });
  }
};

const listLeasingByDocument = async (req, res) => {
  const { documentoId } = req.query;

  if (!documentoId)
    return res.status(400).json({
      success: false,
      message: "El parametro documentoId son obligatorio",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT A.ID, A.NRO_LEASING, A.CANT_VEH, A.FECHA_INI, A.FECHA_FIN, A.ID_CONTRATO, A.ID_CLIENTE
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
      WHERE A.ID_CONTRATO = ? AND TIPCON = 'H'
    `;

      const result = await cn.query(sql, [documentoId]);

      return result.map((row) => ({
        id: row.ID,
        nroLeasing: row.NRO_LEASING ? row.NRO_LEASING.trim() : "",
        fechaInicio: row.FECHA_INI ? row.FECHA_INI.toString().trim() : "",
        fechaFin: row.FECHA_FIN ? row.FECHA_FIN.toString().trim() : "",
        cantVehi: row.CANT_VEH,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar leasings por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasings por contrato",
    });
  }
};

const listLeasingGeneral = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  const { contratoId, clienteId } = req.query;

  try {
    const result = await withConnection(async (cn) => {
      let initWhere = "";
      let filtroA = "";
      let filtroB = "";

      if (contratoId || clienteId) {
        initWhere = "WHERE";
      }

      if (contratoId && !clienteId) {
        filtroA += "A.ID_CONTRATO = ? AND TIPCON = 'P'";
        filtroB += "A.ID_CONTRATO = ? AND TIPCON = 'H'";
      } else if (!contratoId && clienteId) {
        filtroA += "A.ID_CLIENTE = ?";
        filtroB += "A.ID_CLIENTE = ?";
      } else if (contratoId && clienteId) {
        filtroA += "A.ID_CONTRATO = ? AND TIPCON = 'P' AND A.ID_CLIENTE = ?";
        filtroB += "A.ID_CONTRATO = ? AND TIPCON = 'H' AND A.ID_CLIENTE = ?";
      }

      let sqlContract = `
      SELECT A.ID, A.NRO_LEASING
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
      ${initWhere} ${filtroA}
    `;

      let sqlDocument = `
      SELECT A.ID, A.NRO_LEASING
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
      ${initWhere} ${filtroB}
    `;

      if (roleId != 1 && roleId != 2) {
        if (contratoId || clienteId) {
          initWhere = "AND";
        }

        sqlContract = `
        SELECT A.ID, A.NRO_LEASING
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
        LEFT JOIN (
          SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU
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
          WHERE TUG.USU IS NOT NULL
        ) TU
        ON CAST(A.ID_CLIENTE AS VARCHAR(11)) = TU.IDCLI
        WHERE TU.ID_USU = ${idUser} ${initWhere} ${filtroA}
      `;

        sqlDocument = `
        SELECT A.ID, A.NRO_LEASING
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
        LEFT JOIN (
          SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU
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
          WHERE TUG.USU IS NOT NULL
        ) TU
        ON CAST(A.ID_CLIENTE AS VARCHAR(11)) = TU.IDCLI
        WHERE TU.ID_USU = ${idUser} ${initWhere} ${filtroB}
      `;
      }

      let typeDoc = "";
      let idDoc;
      const params = [];

      if (contratoId && !clienteId) {
        typeDoc = contratoId.split("_")[0];
        idDoc = contratoId.split("_")[1];

        params.push(idDoc);
      } else if (!contratoId && clienteId) {
        params.push(clienteId);
      } else if (contratoId && clienteId) {
        typeDoc = contratoId.split("_")[0];
        idDoc = contratoId.split("_")[1];

        params.push(idDoc, clienteId);
      }

      if (typeDoc == "H") {
        const rows = await cn.query(sqlDocument, params);
        return rows.map((row) => ({
          ID: row.ID,
          NRO_LEASING: row.NRO_LEASING.trim(),
        }));
      } else if (typeDoc == "P") {
        const rows = await cn.query(sqlContract, params);
        return rows.map((row) => ({
          ID: row.ID,
          NRO_LEASING: row.NRO_LEASING.trim(),
        }));
      } else {
        const rows = await cn.query(sqlContract, params);
        return rows.map((row) => ({
          ID: row.ID,
          NRO_LEASING: row.NRO_LEASING.trim(),
        }));
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error al listar leasing por contrato o documento: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasing por contrato o documento",
    });
  }
};

const detailLeasing = async (req, res) => {
  const { leasingId, clienteId } = req.query;

  if (!leasingId || !clienteId)
    return res.status(400).json({
      success: false,
      message: "El parametro leasingId y clienteId son obligatorios",
    });

  try {
    const data = await withConnection(async (cn) => {
      const sql = `
      SELECT
        L.ID,
        L.BANCO,
        L.CANT_VEH,
        COUNT(A.ID) AS CANT_ASIGN,
        L.FECHA_INI,
        L.FECHA_FIN,
        L.PERIODO_GRACIA,
        L.PDF,
        L.DESCRIPCION,
        C.CLINOM AS CLIENTE,
        C2.CLINOM AS CLIENTE_ASOCIADO
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
      LEFT JOIN (
      	SELECT TAD.* FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
      	LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB tac
      	ON TAD.ID_ASIGNACION = TAC.ID
      	WHERE TAC.ID_CLIENTE = ?
      ) A
      ON L.NRO_LEASING = A.LEASING
      LEFT JOIN (
        SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM ${SCHEMA_BD}.PO_OPERACIONES A
          INNER JOIN ${SCHEMA_BD}.TCLIE B
          ON A.IDCLI = B.CLICVE
          WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
      ) C
      ON L.ID_CLIENTE = C.IDCLI
      LEFT JOIN (
        SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM ${SCHEMA_BD}.PO_OPERACIONES A
          INNER JOIN ${SCHEMA_BD}.TCLIE B
          ON A.IDCLI = B.CLICVE
          WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
      ) C2
      ON L.ID_CLIENTE_ASOCIADO = C2.IDCLI
      WHERE L.ID = ?
      GROUP BY L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.DESCRIPCION, L.TIPCON, C.CLINOM, C2.CLINOM
    `;

      const result = await cn.query(sql, [clienteId, leasingId]);

      return result;
    });

    if (data.length == 0 || !data[0])
      return res
        .status(404)
        .json({ success: false, message: "No se encontro el leasing" });

    const findLeasing = data[0];

    return res.status(200).json({
      id: findLeasing.ID,
      banco: transformType(findLeasing.BANCO.trim(), {
        1: "BANBIF",
        2: "BBVA",
        3: "BCP",
        4: "HSBC",
        5: "INTERBANK",
        6: "SCOTIABANK",
        7: "TAIR",
        8: "SANTANDER",
      }),
      cantVehi: findLeasing.CANT_VEH,
      cantAsign: findLeasing.CANT_ASIGN,
      fechaInicio: findLeasing.FECHA_INI.toString(),
      fechaFin: findLeasing.FECHA_FIN.toString(),
      periGracia: findLeasing.PERIODO_GRACIA,
      archivoPdf: findLeasing.PDF.trim(),
      descripcion: findLeasing.DESCRIPCION
        ? findLeasing.DESCRIPCION.trim()
        : "",
      cliente: findLeasing.CLIENTE.trim(),
      clienteAsoc: findLeasing.CLIENTE_ASOCIADO
        ? findLeasing.CLIENTE_ASOCIADO.trim()
        : findLeasing.CLIENTE.trim(),
    });
  } catch (error) {
    console.error("Error al obtener detalle de leasing: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener detalle de leasing" });
  }
};

const getLeasingById = async (req, res) => {
  const leasingId = Number(req.params.id);

  if (isNaN(leasingId))
    return res.status(400).json({
      success: false,
      message: "El parametro leasingId debe ser numerico",
    });

  try {
    const data = await withConnection(async (cn) => {
      const result = await cn.query(
        `
          SELECT 
            TLC.*,
            TC_DOC.ID AS ID_CONTRATO_ASOC
          FROM ${SCHEMA_BD}.TBL_LEASING_CAB TLC
          LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TDC
            ON TDC.ID = TLC.ID_CONTRATO 
            AND TLC.TIPCON = 'H'
          LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB TC_DOC
            ON TC_DOC.ID = TDC.ID_PADRE
          WHERE TLC.ID = ?
        `,
        [leasingId],
      );

      if (result.length == 0) return null;

      const resultDet = await cn.query(
        `
          SELECT 
            TLD.*,
            CASE 
              WHEN TAD.ID_VEH IS NOT NULL THEN 1
              ELSE 0
            END AS ASIGNADO
          FROM ${SCHEMA_BD}.TBL_LEASING_DET TLD
          LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
            ON TLD.ID_VEH = TAD.ID_VEH
          WHERE TLD.ID_LEA_CAB = ?
        `,
        [leasingId],
      );

      return { result, resultDet };
    });

    if (!data)
      return res
        .status(404)
        .json({ success: false, message: "No se encontro el leasing" });

    const { result, resultDet } = data;

    return res.status(200).json({
      idCliente: result[0].ID_CLIENTE,
      nroLeasing: result[0].NRO_LEASING.trim(),
      banco: result[0].BANCO.trim(),
      cantVehi: result[0].CANT_VEH,
      fechaIni: String(result[0].FECHA_INI),
      fechaFin: String(result[0].FECHA_FIN),
      perGracia: result[0].PERIODO_GRACIA,
      archivoPdf: result[0].PDF.trim(),
      idContrato: result[0].ID_CONTRATO.trim(),
      idContratoAsoc: result[0].ID_CONTRATO_ASOC,
      tipContrato: result[0].TIPCON.trim(),
      idClienteAsoc: result[0].ID_CLIENTE_ASOCIADO,
      detalles: resultDet.map((row) => ({
        id: row.ID,
        idVeh: row.ID_VEH,
        secCon: row.SEC_CON,
        modelo: row.MODELO.trim(),
        terreno: row.TIPO_TERRENO.trim(),
        placa: row.PLACA.trim(),
        codini: row.CODINI.trim(),
        isAssign: row.ASIGNADO ? true : false,
      })),
    });
  } catch (error) {
    console.error("Error al obtener detalle de leasing: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener detalle de leasing" });
  }
};

const detailVehByLeasing = async (req, res) => {
  const { leasingId } = req.query;

  if (!leasingId)
    return res.status(400).json({
      success: false,
      message: "El parametro leasingId es obligatorio",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT L.MODELO, L.PLACA, L.CANTIDAD, L.TIPO_TERRENO, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, COALESCE(A.CONDICION, '3') AS CONDICION, LC.NRO_LEASING, LC.FECHA_INI, LC.FECHA_FIN
      FROM ${SCHEMA_BD}.TBL_LEASING_DET L
      LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
      ON L.ID_VEH = V.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
      ON V.IDMAR = M.ID
      LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
      ON V.SECOPE = O.ID
      LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET A
      ON L.PLACA = A.PLACA
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LC.ID = L.ID_LEA_CAB
      WHERE ID_LEA_CAB = ?
    `;

      const result = await cn.query(sql, [leasingId]);

      return result.map((row) => ({
        modelo: row.MODELO.trim() ?? "",
        placa: row.PLACA.trim() ?? "",
        cantidad: row.CANTIDAD,
        terreno: row.TIPO_TERRENO.trim() ?? "",
        año: row.ANO,
        color: row.COLOR.trim() ?? "",
        marca: row.MARCA.trim() ?? "",
        operacion: row.OPERACION.trim() ?? "",
        condicion: transformType(row.CONDICION.trim(), {
          0: "Titular",
          1: "Retén",
          2: "Logística",
          3: "Pendiente",
        }),
        nroLeasing: row.NRO_LEASING.trim() ?? "",
        fechaIni: `${row.FECHA_INI}`,
        fechaFin: `${row.FECHA_FIN}`,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener vehiculos por leasing", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener vehiculos por leasing",
    });
  }
};

const detailAssignByLeasing = async (req, res) => {
  const { nroLeasing, clienteId, contratoId, tipoCont } = req.query;

  if (!nroLeasing || !clienteId || !contratoId || !tipoCont)
    return res.status(400).json({
      success: false,
      message:
        "Los parametros nroLeasing, clienteId, contratoId y tipoCont son obligatorios",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT AD.PLACA, MO.DESCRIPCION AS MODELO, M.DESCRIPCION AS MARCA, AD.TP_TERRENO AS TERRENO, V.ANO, V.COLOR, O.DESCRIPCION AS OPERACION, AD.CONDICION, LC.NRO_LEASING, LC.FECHA_INI, LC.FECHA_FIN
      FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
      LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
      ON AC.ID = AD.ID_ASIGNACION
      LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
      ON AD.ID_VEH = V.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
      ON V.IDMOD = MO.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
      ON V.IDMAR = M.ID
      LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
      ON V.SECOPE = O.ID
      LEFT JOIN (
      	SELECT DISTINCT NRO_LEASING, FECHA_INI, FECHA_FIN FROM ${SCHEMA_BD}.TBL_LEASING_CAB
      ) LC
      ON LC.NRO_LEASING = AD.LEASING
      WHERE  AD.LEASING = ? AND  AC.ID_CLIENTE = ? AND AD.ID_CONTRATO = ? AND CLASE_CONTRATO = ?
    `;

      const result = await cn.query(sql, [
        nroLeasing,
        clienteId,
        contratoId,
        tipoCont,
      ]);

      return result.map((row) => ({
        modelo: row.MODELO.trim() ?? "",
        placa: row.PLACA.trim() ?? "",
        terreno: transformType(row.TERRENO, {
          0: "SUPERFICIE",
          1: "SOCAVON",
          2: "CIUDAD",
          3: "SEVERO",
          4: "PENDIENTE",
        }),
        año: row.ANO,
        color: row.COLOR.trim() ?? "",
        marca: row.MARCA.trim() ?? "",
        operacion: row.OPERACION.trim() ?? "",
        condicion: transformType(row.CONDICION.trim(), {
          0: "Titular",
          1: "Retén",
          2: "Logística",
          3: "Pendiente",
        }),
        nroLeasing: row.NRO_LEASING.trim() ?? "",
        fechaIni: `${row.FECHA_INI}`,
        fechaFin: `${row.FECHA_FIN}`,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener asignaciones por leasing", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener asignaciones por leasing",
    });
  }
};

const insertLeasing = async (req, res) => {
  const { user } = req.user;

  const {
    idCliente,
    idClienteAsoc,
    nroLeasing,
    banco,
    cantVehiculos,
    fechaIni,
    fechaFin,
    periGracia,
    idContrato,
    //story,
    detalles,
    archivoPdf,
  } = req.body;

  const fechaIniDB = convertirFecha(fechaIni);
  const fechaFinDB = convertirFecha(fechaFin);

  const validAsoc = idCliente == idClienteAsoc ? null : idClienteAsoc;

  const oldKey = archivoPdf;
  const newKey = oldKey.replace(/^temp\//, "");

  try {
    await withConnection(async (cn) => {
      const queryCabecera = `
              INSERT INTO ${SCHEMA_BD}.TBL_LEASING_CAB
              (ID_CLIENTE, NRO_LEASING, BANCO, CANT_VEH, FECHA_INI, FECHA_FIN, PERIODO_GRACIA, PDF, ID_CONTRATO, TIPCON, ID_CLIENTE_ASOCIADO, CREADO_POR, ACTUALIZADO_POR)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

      const result = await cn.query(queryCabecera, [
        idCliente,
        nroLeasing,
        banco,
        cantVehiculos,
        fechaIniDB,
        fechaFinDB,
        periGracia,
        newKey,
        funcionNumerica(idContrato),
        funcionParteVar(idContrato),
        validAsoc,
        user,
        user,
      ]);

      await moveFile(oldKey, newKey);

      const idLeasingCab = result.insertId || (await obtenerUltimoIdLea(cn));

      const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBL_LEASING_DET
              (ID_LEA_CAB, ID_VEH, SEC_CON, MODELO, TIPO_TERRENO, PLACA, CODINI, CANTIDAD, CREADO_POR, ACTUALIZADO_POR)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

      const queryUpdateVehiculo = `
              UPDATE ${SCHEMA_BD}.PO_VEHICULO
              SET INIVAL1 = '1'
              WHERE ID = ?
          `;

      if (detalles && detalles.length > 0) {
        for (const detalle of detalles) {
          await cn.query(queryDetalle, [
            idLeasingCab,
            detalle.idpla,
            detalle.secCon,
            detalle.modelo,
            detalle.tipoTerreno,
            detalle.numpla,
            detalle.codini,
            detalle.cantidad,
            user,
            user,
          ]);

          await cn.query(queryUpdateVehiculo, [detalle.idpla]);
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar Leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar Leasing" });
  }
};

const updateLeasing = async (req, res) => {
  const { user } = req.user;
  const leasingId = Number(req.params.id);

  if (isNaN(leasingId))
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });

  const {
    idCliente,
    idClienteAsoc,
    nroLeasing,
    banco,
    cantVehiculos,
    fechaIni,
    fechaFin,
    periGracia,
    idContrato,
    detalles,
    archivoPdf,
  } = req.body;

  const fechaIniDB = convertirFecha(fechaIni);
  const fechaFinDB = convertirFecha(fechaFin);
  const validAsoc = idCliente == idClienteAsoc ? null : idClienteAsoc;

  // Manejo de key del archivo — igual que updateContract/updateDocument
  const oldKey = archivoPdf;
  let newKey = oldKey;

  try {
    await withConnection(async (cn) => {
      // Verificar que existe
      const findLeasing = await cn.query(
        `SELECT ID FROM ${SCHEMA_BD}.TBL_LEASING_CAB WHERE ID = ?`,
        [leasingId],
      );

      if (findLeasing.length === 0) {
        const err = new Error("No se encontró el leasing solicitado");
        err.statusCode = 404;
        throw err;
      }

      // Si el key viene de temp/, es un archivo nuevo → mover
      if (oldKey.startsWith("temp/")) {
        newKey = oldKey.replace(/^temp\//, "");
        const isExistInTemp = await fileExists(oldKey);
        if (isExistInTemp) await moveFile(oldKey, newKey);
      }

      // Actualizar cabecera
      await cn.query(
        `UPDATE ${SCHEMA_BD}.TBL_LEASING_CAB
         SET ID_CLIENTE = ?, NRO_LEASING = ?, BANCO = ?, CANT_VEH = ?,
             FECHA_INI = ?, FECHA_FIN = ?, PERIODO_GRACIA = ?, PDF = ?,
             ID_CONTRATO = ?, TIPCON = ?, ID_CLIENTE_ASOCIADO = ?,
             ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
         WHERE ID = ?`,
        [
          idCliente,
          nroLeasing,
          banco,
          cantVehiculos,
          fechaIniDB,
          fechaFinDB,
          periGracia,
          newKey,
          funcionNumerica(idContrato),
          funcionParteVar(idContrato),
          validAsoc,
          user,
          leasingId,
        ],
      );

      // ── Lógica de detalles ──────────────────────────────────────────
      // Separar la lista entrante en tres grupos:
      //   detailNew   → isAssign=false y sin id → INSERT
      //   idsToKeep   → todos los que tienen id (asignados o no) → no tocar
      // Los registros en DB que no están en idsToKeep Y no están asignados → DELETE

      const detailNew = [];
      const idsToKeep = [];

      if (detalles && detalles.length > 0) {
        for (const det of detalles) {
          if (det.isAssign) {
            // Vehiculo asignado → no se toca; solo preservar su id
            if (det.id) idsToKeep.push(det.id);
          } else if (det.id) {
            // Ya registrado, no asignado → mantener
            idsToKeep.push(det.id);
          } else {
            // Nuevo
            detailNew.push(det);
          }
        }
      }

      // Encontrar registros a eliminar:
      // Existentes en DB, no asignados, cuyo id no está en idsToKe
      const existingDet = await cn.query(
        `SELECT TLD.ID, TLD.ID_VEH
         FROM ${SCHEMA_BD}.TBL_LEASING_DET TLD
         LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
           ON TLD.ID_VEH = TAD.ID_VEH
         WHERE TLD.ID_LEA_CAB = ?
           AND TAD.ID_VEH IS NULL`,
        [leasingId],
      );

      const toDelete = existingDet
        .filter((row) => !idsToKeep.includes(row.ID))
        .map((row) => row);

      // Eliminar detalles que salieron de la lista
      if (toDelete.length > 0) {
        const placeholders = toDelete.map(() => "?").join(",");
        const ids = toDelete.map((r) => r.ID);
        const idVehs = toDelete.map((r) => r.ID_VEH);

        await cn.query(
          `DELETE FROM ${SCHEMA_BD}.TBL_LEASING_DET WHERE ID IN (${placeholders})`,
          ids,
        );

        // Resetear flag de leasing en el vehiculo
        for (const idVeh of idVehs) {
          await cn.query(
            `UPDATE ${SCHEMA_BD}.PO_VEHICULO SET INIVAL1 = '0' WHERE ID = ?`,
            [idVeh],
          );
        }
      }

      // Insertar detalles nuevos
      const queryDetalle = `
        INSERT INTO ${SCHEMA_BD}.TBL_LEASING_DET
        (ID_LEA_CAB, ID_VEH, SEC_CON, MODELO, TIPO_TERRENO, PLACA, CODINI, CANTIDAD, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const det of detailNew) {
        await cn.query(queryDetalle, [
          leasingId,
          det.idpla,
          det.secCon,
          det.modelo,
          det.tipoTerreno,
          det.numpla,
          det.codini,
          det.cantidad,
          user,
          user,
        ]);

        await cn.query(
          `UPDATE ${SCHEMA_BD}.PO_VEHICULO SET INIVAL1 = '1' WHERE ID = ?`,
          [det.idpla],
        );
      }
    });

    res.json({ success: true });
  } catch (error) {
    if (error.statusCode === 404)
      return res.status(404).json({ success: false, message: error.message });

    console.error("Error al actualizar Leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar Leasing" });
  }
};

module.exports = {
  listLeasing,
  listLeasingAdi,
  listAllLeasing,
  listLeasingOfClient,
  listLeasingByContract,
  getLeasingByContract,
  getLeasingByDocument,
  listLeasingByDocument,
  listLeasingGeneral,
  detailLeasing,
  getLeasingById,
  detailVehByLeasing,
  detailAssignByLeasing,
  insertLeasing,
  updateLeasing,
};
