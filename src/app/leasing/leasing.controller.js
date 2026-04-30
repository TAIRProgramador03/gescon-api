const {
  decodeString,
  convertirFecha,
  funcionNumerica,
  funcionParteVar,
  obtenerUltimoIdLea,
  transformType,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const { moveFile } = require("../../shared/service/aws-s3.js");

const listLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection();

  try {
    const result = await cn.query(
      `SELECT ID, NRO_LEASING FROM ${SCHEMA_BD}.TBL_LEASING_CAB ORDER BY NRO_LEASING ASC`,
    );

    // Decodificar los resultados desde latin1
    const cleanedResult = result.map((row) => {
      return {
        ID: String(row.ID).trim(),
        NRO_LEASING: decodeString(row.NRO_LEASING.trim()),
      };
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener leasing" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const listAllLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { bank, clientId, contractId, typeContract } = req.query;

  const cn = await connection();

  try {
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

    // 🔥 armar WHERE dinámico
    if (condiciones.length > 0) {
      filtros = " WHERE " + condiciones.join(" AND ");
    }

    // let sql = `
    //   SELECT * FROM (
    //     SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH AS CANTIDAD, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.TIPCON, tc.NRO_CONTRATO, L.ID_CLIENTE, L.ID_CONTRATO
    //     FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
    //     LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc
    //     ON L.ID_CONTRATO = tc.ID AND L.TIPCON = 'P'
    //     WHERE L.TIPCON = 'P'
    //     UNION ALL
    //     SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH AS CANTIDAD, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.TIPCON, tc.NRO_DOC AS NRO_CONTRATO, L.ID_CLIENTE, L.ID_CONTRATO
    //     FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
    //     LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc
    //     ON L.ID_CONTRATO = tc.ID AND L.TIPCON = 'H'
    //     WHERE L.TIPCON = 'H'
    //   ) L
    //   ${filtros}
    //   ORDER BY L.ID ASC
    // `;

    let sql = `
      SELECT * FROM (
        SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH AS CANTIDAD, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.TIPCON, tc.NRO_CONTRATO, L.ID_CLIENTE, L.ID_CONTRATO, L.ID_CLIENTE_ASOCIADO, CL.CLINOM AS CLIENTE, CLA.CLINOM AS CLIENTE_ORIGEN
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc 
        ON L.ID_CONTRATO = tc.ID AND L.TIPCON = 'P'
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
        WHERE L.TIPCON = 'P'

        UNION ALL

        SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH AS CANTIDAD, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.TIPCON, tc.NRO_DOC AS NRO_CONTRATO, L.ID_CLIENTE, L.ID_CONTRATO, L.ID_CLIENTE_ASOCIADO, CL.CLINOM AS CLIENTE, CLA.CLINOM AS CLIENTE_ORIGEN
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc 
        ON L.ID_CONTRATO = tc.ID AND L.TIPCON = 'H'
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
        WHERE L.TIPCON = 'H'
      ) L
      ${filtros}
      ORDER BY L.ID ASC
    `;

    const result = await cn.query(sql, params);

    const cleanedResult = result.map((row) => ({
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
      fechaIni: row.FECHA_INI,
      fechaFin: row.FECHA_FIN,
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

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener la lista de leasings", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener la lista de leasings",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const listLeasingOfClient = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli } = req.query;

  // Validación de parametros query
  if (!idCli) {
    return res.status(400).json({
      success: false,
      message: "Los parámetros idCli son obligatorios.",
    });
  }

  const cn = await connection();

  try {
    const query = `
        SELECT ID, NRO_LEASING 
        FROM ${SCHEMA_BD}.TBL_LEASING_CAB 
        WHERE ID_CLIENTE = ? ORDER BY NRO_LEASING ASC
      `;

    const result = await cn.query(query, [idCli]);

    // Decodificar los resultados desde latin1
    const cleanedResult = result.map((row) => {
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

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener leasing" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const listLeasingByContract = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { contratoId, clienteId } = req.query;

  const cn = await connection();

  try {
    const sql = `
      SELECT A.ID, A.NRO_LEASING, A.CANT_VEH, A.FECHA_INI, A.FECHA_FIN, A.ID_CONTRATO, A.ID_CLIENTE
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A 
      ${contratoId && clienteId ? `WHERE A.ID_CLIENTE = ? AND A.ID_CONTRATO = ? AND TIPCON = 'P'` : contratoId ? `WHERE A.ID_CONTRATO = ? AND TIPCON = 'P'` : clienteId ? `WHERE A.ID_CLIENTE = ?` : ""}
    `;

    const params = [];

    if (contratoId && clienteId) {
      params.push(clienteId, contratoId);
    } else if (contratoId) {
      params.push(contratoId);
    } else if (clienteId) {
      params.push(clienteId);
    }

    const result = await cn.query(sql, params);

    const cleanedResult = result.map((row) => ({
      id: row.ID,
      nroLeasing: row.NRO_LEASING ? row.NRO_LEASING.trim() : "",
      fechaInicio: row.FECHA_INI ? row.FECHA_INI.toString().trim() : "",
      fechaFin: row.FECHA_FIN ? row.FECHA_FIN.toString().trim() : "",
      cantVehi: row.CANT_VEH,
    }));

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar leasings por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasings por contrato",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const listLeasingByDocument = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { documentoId } = req.query;

  if (!documentoId)
    return res.status(400).json({
      success: false,
      message: "El parametro documentoId son obligatorio",
    });

  const cn = await connection();

  try {
    const sql = `
      SELECT A.ID, A.NRO_LEASING, A.CANT_VEH, A.FECHA_INI, A.FECHA_FIN, A.ID_CONTRATO, A.ID_CLIENTE
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A 
      WHERE A.ID_CONTRATO = ? AND TIPCON = 'H'
    `;

    const result = await cn.query(sql, [documentoId]);

    const cleanedResult = result.map((row) => ({
      id: row.ID,
      nroLeasing: row.NRO_LEASING ? row.NRO_LEASING.trim() : "",
      fechaInicio: row.FECHA_INI ? row.FECHA_INI.toString().trim() : "",
      fechaFin: row.FECHA_FIN ? row.FECHA_FIN.toString().trim() : "",
      cantVehi: row.CANT_VEH,
    }));

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar leasings por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasings por contrato",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const listLeasingGeneral = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { contratoId, clienteId } = req.query;

  const cn = await connection();

  try {
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

    const sqlContract = `
      SELECT A.ID, A.NRO_LEASING
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A 
      ${initWhere} ${filtroA}
    `;

    const sqlDocument = `
      SELECT A.ID, A.NRO_LEASING
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB A 
      ${initWhere} ${filtroB}
    `;

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
      const result = await cn.query(sqlDocument, params);

      return res.status(200).json(
        result.map((row) => ({
          ID: row.ID,
          NRO_LEASING: row.NRO_LEASING.trim(),
        })),
      );
    } else if (typeDoc == "P") {
      const result = await cn.query(sqlContract, params);

      return res.status(200).json(
        result.map((row) => ({
          ID: row.ID,
          NRO_LEASING: row.NRO_LEASING.trim(),
        })),
      );
    } else {
      const result = await cn.query(sqlContract, params);

      return res.status(200).json(
        result.map((row) => ({
          ID: row.ID,
          NRO_LEASING: row.NRO_LEASING.trim(),
        })),
      );
    }
  } catch (error) {
    console.error("Error al listar leasing por contrato o documento: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar leasing por contrato o documento",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const detailLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { leasingId, nroLeasing, clienteId, contratoId, tipoCont } = req.query;

  if (!leasingId || !nroLeasing || !clienteId || !contratoId || !tipoCont)
    return res.status(400).json({
      success: false,
      message:
        "Los parametros leasingId, nroLeasing, clienteId, contratoId y tipoCont son obligatorios",
    });

  const cn = await connection();

  try {
    // const sql = `
    //   SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH, COUNT(A.ID) AS CANT_ASIGN , L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.DESCRIPCION, L.TIPCON
    //   FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
    //   LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET A
    //   ON L.NRO_LEASING = A.LEASING
    //   LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
    //   ON AC.ID = A.ID_ASIGNACION
    //   WHERE L.ID = ? AND A.LEASING = ? AND AC.ID_CLIENTE = ? AND A.ID_CONTRATO = ? AND A.CLASE_CONTRATO = ?
    //   GROUP BY L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.DESCRIPCION, L.TIPCON
    // `;

    const sql = `
      SELECT L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH, COUNT(A.ID) AS CANT_ASIGN, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.DESCRIPCION, L.TIPCON
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB L
      LEFT JOIN (
        SELECT A.ID, A.LEASING, AC.ID_CLIENTE, A.ID_CONTRATO, A.CLASE_CONTRATO
        FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET A
        LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
        ON AC.ID = A.ID_ASIGNACION
        WHERE A.LEASING = ? AND AC.ID_CLIENTE = ? AND A.ID_CONTRATO = ? AND A.CLASE_CONTRATO = ?
      ) A
      ON L.NRO_LEASING = A.LEASING
      WHERE L.ID = ?
      GROUP BY L.ID, L.NRO_LEASING, L.BANCO, L.CANT_VEH, L.FECHA_INI, L.FECHA_FIN, L.PERIODO_GRACIA, L.PDF, L.DESCRIPCION, L.TIPCON
    `;

    const result = await cn.query(sql, [
      nroLeasing,
      clienteId,
      contratoId,
      tipoCont,
      leasingId,
    ]);

    if (result.length == 0 || !result[0])
      return res
        .status(404)
        .json({ success: false, message: "No se encontro el leasing" });

    const findLeasing = result[0];

    return res.status(200).json({
      id: findLeasing.ID,
      nroLeasing: findLeasing.NRO_LEASING.trim(),
      banco: findLeasing.BANCO.trim(),
      cantVehi: findLeasing.CANT_VEH,
      cantAsign: findLeasing.CANT_ASIGN,
      fechaInicio: findLeasing.FECHA_INI.toString(),
      fechaFin: findLeasing.FECHA_FIN.toString(),
      periGracia: findLeasing.PERIODO_GRACIA,
      archivoPdf: findLeasing.PDF.trim(),
      descripcion: findLeasing.DESCRIPCION
        ? findLeasing.DESCRIPCION.trim()
        : "",
      tipo: findLeasing.TIPCON.trim(),
    });
  } catch (error) {
    console.error("Error al obtener detalle de leasing: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener detalle de leasing" });
  } finally {
    if (cn) await cn.close();
  }
};

const detailVehByLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { leasingId } = req.query;

  if (!leasingId)
    return res.status(400).json({
      success: false,
      message: "El parametro leasingId es obligatorio",
    });

  const cn = await connection();

  try {
    const sql = `
      SELECT L.MODELO, L.PLACA, L.CANTIDAD, L.TIPO_TERRENO, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, A.CONDICION, LC.NRO_LEASING, LC.FECHA_INI, LC.FECHA_FIN
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

    const cleanedResult = result.map((row) => ({
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

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener vehiculos por leasing", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener vehiculos por leasing",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const detailAssignByLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { nroLeasing, clienteId, contratoId, tipoCont } = req.query;

  if (!nroLeasing || !clienteId || !contratoId || !tipoCont)
    return res.status(400).json({
      success: false,
      message:
        "Los parametros nroLeasing, clienteId, contratoId y tipoCont son obligatorios",
    });

  const cn = await connection();

  try {
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

    const cleanedResult = result.map((row) => ({
      modelo: row.MODELO.trim() ?? "",
      placa: row.PLACA.trim() ?? "",
      terreno: transformType(row.TERRENO, {
        0: "SUPERFICIE",
        1: "SOCAVON",
        2: "CIUDAD",
        3: "SEVERO",
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

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener asignaciones por leasing", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener asignaciones por leasing",
    });
  } finally {
  }
};

const insertLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

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

  const cn = await connection();

  try {
    const queryCabecera = `
              INSERT INTO ${SCHEMA_BD}.TBL_LEASING_CAB 
              (ID_CLIENTE, NRO_LEASING, BANCO, CANT_VEH, FECHA_INI, FECHA_FIN, PERIODO_GRACIA, PDF, ID_CONTRATO, TIPCON, ID_CLIENTE_ASOCIADO)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      funcionNumerica(validAsoc),
    ]);

    await moveFile(oldKey, newKey);

    const idLeasingCab = result.insertId || (await obtenerUltimoIdLea(cn));

    const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBL_LEASING_DET 
              (ID_LEA_CAB, ID_VEH, SEC_CON, MODELO, TIPO_TERRENO, PLACA, CODINI, CANTIDAD)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        ]);

        await cn.query(queryUpdateVehiculo, [detalle.idpla]);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar Leasing:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar Leasing" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

module.exports = {
  listLeasing,
  listAllLeasing,
  listLeasingOfClient,
  listLeasingByContract,
  listLeasingByDocument,
  listLeasingGeneral,
  detailLeasing,
  detailVehByLeasing,
  detailAssignByLeasing,
  insertLeasing,
};
