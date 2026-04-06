const { IP_LOCAL, SCHEMA_BD } = require("../../shared/conf.js");
const {
  decodeString,
  convertirFecha,
  obtenerUltimoId,
  funcionNumerica,
  funcionParteVar,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const {moveFile} = require("../../shared/service/aws-s3.js")

const contractNro = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli } = req.query; // Obtiene el idCli de los parámetros de consulta

  // if (!idCli) {
  //   return res
  //     .status(400)
  //     .json({ success: false, message: "El idCli es obligatorio" });
  // }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Consulta los contratos asociados al cliente
    const query = `
    SELECT ID, NRO_CONTRATO AS DESCRIPCION 
    FROM ${SCHEMA_BD}.TBLCONTRATO_CAB 
    ${idCli ? `WHERE ID_CLIENTE = ?` : ""}
    `;
    const result = await cn.query(query, idCli ? [idCli] : []);

    const cleanedResult = result.map((row) => {
      return {
        ID:
          row.ID !== null && row.ID !== undefined
            ? row.ID.toString().trim()
            : null, // Convierte a string si es necesario
        DESCRIPCION:
          row.DESCRIPCION !== null && row.DESCRIPCION !== undefined
            ? decodeString(row.DESCRIPCION.toString().trim())
            : null,
      };
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los contratos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener contratos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const contractNroAdi = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli } = req.query; // Obtiene el idCli de los parámetros de consulta

  if (!idCli) {
    return res
      .status(400)
      .json({ success: false, message: "El idCli es obligatorio" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Consulta los contratos asociados al cliente
    const query = `
      SELECT * FROM ((SELECT CONCAT('P_', ID) AS ID, NRO_CONTRATO AS DESCRIPCION FROM ${SCHEMA_BD}.TBLCONTRATO_CAB WHERE ID_CLIENTE= ? ) 
      UNION ALL (SELECT CONCAT('H_', ID) AS ID, NRO_DOC AS DESCRIPCION FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB WHERE ID_CLIENTE= ? )) AS CONTRATOS 
      ORDER BY DESCRIPCION ASC
    `;
    const result = await cn.query(query, [idCli, idCli]);

    const cleanedResult = result.map((row) => {
      return {
        ID:
          row.ID !== null && row.ID !== undefined
            ? row.ID.toString().trim()
            : null, // Convierte a string si es necesario
        DESCRIPCION:
          row.DESCRIPCION !== null && row.DESCRIPCION !== undefined
            ? decodeString(row.DESCRIPCION.toString().trim())
            : null,
      };
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los contratos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener contratos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const tableContract = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli, id } = req.query; // Obtiene los parámetros de consulta

  // Validación inicial
  if (!idCli || !id) {
    return res.status(400).json({
      success: false,
      message: "Los parámetros idCli e id son obligatorios.",
    });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Usa parámetros preparados para prevenir inyección SQL
    const query = `
              SELECT ID, NRO_CONTRATO AS DESCRIPCION, FECHA_FIRMA AS FECHACREA, CANT_VEHI AS TOTVEH, DURACION
              FROM ${SCHEMA_BD}.TBLCONTRATO_CAB
              WHERE ID_CLIENTE = ? AND ID = ?
          `;
    const result = await cn.query(query, [idCli, id]);

    const cleanedResult = result.map((row) => {
      return {
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
      };
    });

    // Envía los resultados como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los datos. Por favor intente más tarde.",
    });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const detailContract = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { contratoId, clienteId } = req.query; // Obtiene el contratoId de los parámetros de consulta

  if (!clienteId) {
    return res.status(400).json({
      success: false,
      message: "El parametro clienteId es obligatorio",
    });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Consulta los detalles del contrato

    const sqlTotalVeh = `
      SELECT 
        SUM(TOTAL_VEH_SU) AS TOTAL_VEH_SUP,
        SUM(TOTAL_VEH_SOC) AS TOTAL_VEH_SOC,
        SUM(TOTAL_VEH_CIU) AS TOTAL_VEH_CIU,
        SUM(TOTAL_VEH_SEV) AS TOTAL_VEH_SEV
      FROM (
        SELECT
          SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SU,
          SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
          SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
          SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
        FROM SPEED400AT.TBL_ASIGNACION_DET tad 
        LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB tac 
        ON tad.ID_ASIGNACION  = tac.ID
        WHERE tac.ID_CLIENTE = ? AND tad.CLASE_CONTRATO = 'P'
        ${contratoId ? `AND tad.ID_CONTRATO = ?` : ""}
        UNION ALL
        SELECT
          SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SU,
          SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
          SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
          SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
        FROM SPEED400AT.TBL_ASIGNACION_DET tad 
        LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB tac 
        ON tad.ID_ASIGNACION  = tac.ID
        LEFT JOIN SPEED400AT.TBLDOCUMENTO_CAB tdc
        ON tad.ID_CONTRATO = tdc.ID
        WHERE tac.ID_CLIENTE = ? AND tad.CLASE_CONTRATO = 'H'
        ${contratoId ? `AND tdc.ID_PADRE = ?` : ""}
      )
    `;

    const sqlTotalAsign = `
      SELECT COUNT(*) AS TOTAL_ASIGNADOS FROM (
        SELECT AD.ID, AD.ID_CONTRATO, AD.CLASE_CONTRATO FROM SPEED400AT.TBL_ASIGNACION_DET AD
        LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB AC
        ON AD.ID_ASIGNACION = AC.ID
        LEFT JOIN SPEED400AT.TBLCONTRATO_CAB CC
        ON AD.ID_CONTRATO = CC.ID AND TRIM(AD.CLASE_CONTRATO) = 'P'
        WHERE AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'P'
        ${contratoId ? "AND CC.ID = ?" : ""}

        UNION ALL

        SELECT AD.ID, AD.ID_CONTRATO, AD.CLASE_CONTRATO FROM SPEED400AT.TBL_ASIGNACION_DET AD
        LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB AC
        ON AD.ID_ASIGNACION = AC.ID
        LEFT JOIN SPEED400AT.TBLDOCUMENTO_CAB DC
        ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
        LEFT JOIN SPEED400AT.TBLCONTRATO_CAB CC
        ON DC.ID_PADRE = CC.ID
        WHERE AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'H'
        ${contratoId ? "AND CC.ID = ?" : ""}
      )
    `;

    const sqlLeasing = `
      SELECT COUNT(*) AS TOTAL_LEASINGS FROM SPEED400AT.TBL_LEASING_CAB LC
      LEFT JOIN SPEED400AT.TBLCONTRATO_CAB CC
      ON LC.ID_CONTRATO = CC.ID AND LC.TIPCON = 'P'
      WHERE CC.ID_CLIENTE = ?
      ${contratoId ? `AND CC.ID = ?` : "AND (DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS) > CURRENT DATE"}
    `;

    const sqlDocumentos = `
      SELECT COUNT(*) AS TOTAL_DOCUMENTOS FROM SPEED400AT.TBLDOCUMENTO_CAB DC
      LEFT JOIN SPEED400AT.TBLCONTRATO_CAB CC
      ON CC.ID = DC.ID_PADRE
      WHERE CC.ID_CLIENTE = ?
      ${contratoId ? `AND CC.ID = ?` : "AND (DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS) > CURRENT DATE "}
    `;

    const sqlContrato = `
      SELECT DESCRIPCION, FECHA_FIRMA, DURACION FROM SPEED400AT.TBLCONTRATO_CAB
      WHERE ID_CLIENTE = ? 
      ${contratoId ? `AND ID = ?` : ""}
    `;

    let filtrosA = "";
    let filtrosB = "";
    let params = [];

    // filtro obligatorio
    filtrosA +=
      " AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'P' AND O.ID = V.ID_OPE AND V.ID_OPE != 109";
    filtrosB +=
      " AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'H' AND O.ID = V.ID_OPE AND V.ID_OPE != 109";
    params.push(clienteId);

    // opcionales
    if (contratoId) {
      filtrosA += " AND CC.ID = ?";
      filtrosB += " AND CC.ID = ?";
      params.push(contratoId);
    }

    const sqlTotalPlacasActivas = `
      SELECT COUNT(*) AS TOTAL_ACTIVAS FROM (
        SELECT 
          DISTINCT(AD.ID),
          C.CLINOM AS CLIENTE, 
          O.ID AS ID_OPE,
          O.DESCRIPCION AS OPERACIONES, 
          V.ID_OPE AS ID_OPE_ACTUAL,
          V.OPERACIONES AS OPERACION_ACTUAL, 
          AD.PLACA, 
          V.ANO,
          V.COLOR,
          MA.DESCRIPCION AS MARCA,
          MO.DESCRIPCION AS MODELO,
          AD.TP_TERRENO AS TERRENO,
          AD.LEASING,
          LC.FECHA_INI AS FECHA_INI_LEASING,
          LC.FECHA_FIN AS FECHA_FIN_LEASING,
          CC.NRO_CONTRATO AS CONTRATO, 
          CC.DURACION AS PLAZO, 
          AD.FECHA_INI AS FECHA_ENTREGA, 
          AD.FECHA_FIN, 
          DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
          DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
          CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
          CASE WHEN CC.MONEDA = '1' THEN 'SOLES' ELSE 'DÓLAR' END AS MONEDA
        FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
        LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
        ON AD.ID_ASIGNACION = AC.ID
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
        ON LC.NRO_LEASING = AD.LEASING
        LEFT JOIN (
          SELECT DISTINCT A.IDCLI, B.CLINOM 
          FROM ${SCHEMA_BD}.PO_OPERACIONES A 
          INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
          WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
          ORDER BY CLINOM ASC
        ) C
        ON AC.ID_CLIENTE = C.IDCLI
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
        ON O.ID = AD.ID_OPE
        LEFT JOIN (
          SELECT 
            V.ID,
            V.ANO,
            V.COLOR,
            O.ID AS ID_OPE,
            O.DESCRIPCION AS OPERACIONES,
            V.IDMAR,
            V.IDMOD
          FROM ${SCHEMA_BD}.PO_VEHICULO V
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
          ON V.SECOPE = O.ID
        ) V
        ON V.ID = AD.ID_VEH
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
        ON MA.ID = V.IDMAR
        LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
        ON MO.ID = V.IDMOD
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON AD.ID_CONTRATO = CC.ID AND TRIM(AD.CLASE_CONTRATO) = 'P'
        WHERE ${filtrosA}

        UNION ALL

        SELECT 
          DISTINCT(AD.ID),
          C.CLINOM AS CLIENTE, 
          O.ID AS ID_OPE,
          O.DESCRIPCION AS OPERACIONES, 
          V.ID_OPE AS ID_OPE_ACTUAL,
          V.OPERACIONES AS OPERACION_ACTUAL, 
          AD.PLACA, 
          V.ANO,
          V.COLOR,
          MA.DESCRIPCION AS MARCA,
          MO.DESCRIPCION AS MODELO,
          AD.TP_TERRENO AS TERRENO,
          AD.LEASING,
          LC.FECHA_INI AS FECHA_INI_LEASING,
          LC.FECHA_FIN AS FECHA_FIN_LEASING,
          DC.NRO_DOC AS CONTRATO,
          DC.DURACION AS PLAZO, 
          AD.FECHA_INI AS FECHA_ENTREGA, 
          AD.FECHA_FIN, 
          DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
          DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
          CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
          CASE WHEN CC.MONEDA = '1' THEN 'SOLES' ELSE 'DÓLAR' END AS MONEDA
        FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
        LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
        ON AD.ID_ASIGNACION = AC.ID
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
        ON LC.NRO_LEASING = AD.LEASING
        LEFT JOIN (
          SELECT DISTINCT A.IDCLI, B.CLINOM 
          FROM ${SCHEMA_BD}.PO_OPERACIONES A 
          INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
          WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
          ORDER BY CLINOM ASC
        ) C
        ON AC.ID_CLIENTE = C.IDCLI
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
        ON O.ID = AD.ID_OPE
        LEFT JOIN (
          SELECT 
            V.ID,
            V.ANO,
            V.COLOR,
            O.ID AS ID_OPE,
            O.DESCRIPCION AS OPERACIONES,
            V.IDMAR,
            V.IDMOD
          FROM ${SCHEMA_BD}.PO_VEHICULO V
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
          ON V.SECOPE = O.ID
        ) V
        ON V.ID = AD.ID_VEH
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
        ON MA.ID = V.IDMAR
        LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
        ON MO.ID = V.IDMOD
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
        ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON DC.ID_PADRE = CC.ID
        WHERE ${filtrosB}
      )
    `;

    const paramsTotalVeh = [];

    if (contratoId) {
      paramsTotalVeh.push(clienteId, contratoId, clienteId, contratoId);
    } else {
      paramsTotalVeh.push(clienteId, clienteId);
    }

    const resultCont = await cn.query(
      sqlContrato,
      contratoId ? [clienteId, contratoId] : [clienteId],
    );

    const resultDoc = await cn.query(
      sqlDocumentos,
      contratoId ? [clienteId, contratoId] : [clienteId],
    );

    const resultLea = await cn.query(
      sqlLeasing,
      contratoId ? [clienteId, contratoId] : [clienteId],
    );

    const resultTotalActivas = await cn.query(
      sqlTotalPlacasActivas,
      paramsTotalVeh,
    );

    const resultTotalVeh = await cn.query(sqlTotalVeh, paramsTotalVeh);

    const resultTotalAssign = await cn.query(sqlTotalAsign, paramsTotalVeh);

    // Suponemos que hay solo un contrato en los resultados
    const contrato = contratoId ? resultCont[0] : null;
    const documento = resultDoc[0];
    const leasing = resultLea[0];
    const totalActivas = resultTotalActivas[0];
    const totalVeh = resultTotalVeh[0];
    const totalVehAssign = resultTotalAssign[0];

    // Respuesta con los detalles del contrato
    res.json({
      success: true,
      data: {
        descripcion: contrato ? contrato.DESCRIPCION.trim() : "",
        fechaFirma: contrato ? contrato.FECHA_FIRMA : "",
        duracion: contrato ? contrato.DURACION.trim() : "",
        vehiculoSup: totalVeh.TOTAL_VEH_SUP,
        vehiculoSev: totalVeh.TOTAL_VEH_SEV,
        vehiculoSoc: totalVeh.TOTAL_VEH_SOC,
        vehiculoCiu: totalVeh.TOTAL_VEH_CIU,
        hayActivos: totalActivas.TOTAL_ACTIVAS > 0 ? true : false,
        cantidadVehiculos: totalActivas.TOTAL_ACTIVAS,
        cantidadDocumentos: documento.TOTAL_DOCUMENTOS,
        cantidadLeasing: leasing.TOTAL_LEASINGS,
        cantidadAsignados: totalVehAssign.TOTAL_ASIGNADOS,
      },
    });
  } catch (error) {
    console.error("Error al obtener los detalles del contrato:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los detalles del contrato",
    });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const detailVehByCont = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { contratoId, tipoTerr } = req.query;

  if (!contratoId)
    return res.status(400).json({
      success: false,
      message: "El parametro contratoId es obligatorio",
    });

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const sqlLeasing = `
      SELECT ID 
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB 
      WHERE ID_CONTRATO = ? AND TIPCON = 'P'
    `;

    const resultLea = await cn.query(sqlLeasing, [contratoId]);

    if (resultLea.length == 0)
      return res
        .status(404)
        .json({ success: false, message: "Sin placas contratadas" });

    const cleanLea = resultLea.map((row) => row.ID);

    const placeHolders = resultLea.map(() => "?").join(",");

    let sqlDetLea = `
      SELECT L.MODELO, L.PLACA, L.CANTIDAD, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, A.FECHA_FIN, LC.NRO_LEASING
      FROM ${SCHEMA_BD}.TBL_LEASING_DET L
      LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
      ON L.ID_VEH = V.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
      ON V.IDMAR = M.ID
      LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
      ON V.IDOPE = O.ID
      LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET A
      ON L.PLACA = A.PLACA
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LC.ID = L.ID_LEA_CAB
      WHERE ID_LEA_CAB IN (${placeHolders})
    `;

    const params = [...cleanLea];

    if (tipoTerr) {
      sqlDetLea += ` AND TIPO_TERRENO = ?`;
      params.push(tipoTerr.toUpperCase());
    }

    const resultDet = await cn.query(sqlDetLea, params);

    if (resultDet.length == 0)
      return res
        .status(404)
        .json({ success: false, message: "Sin placas encontradas" });

    const cleanedResult = resultDet.map((row) => ({
      modelo: row.MODELO.trim() ?? "",
      placa: row.PLACA.trim() ?? "",
      cantidad: row.CANTIDAD,
      año: row.ANO,
      color: row.COLOR.trim() ?? "",
      marca: row.MARCA.trim() ?? "",
      operacion: row.OPERACION.trim() ?? "",
      fechaFin: row.FECHA_FIN ? row.FECHA_FIN.trim() : "",
      nroLeasing: row.NRO_LEASING.trim() ?? "",
    }));

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener placas por documento",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const contContract = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { clienteId } = req.query;

  const cn = await connection(globalDbUser, globalPassword);

  try {
    let sql = `SELECT COUNT(DISTINCT A.ID) AS PADRE, SUM(CASE WHEN B.TIPO_DOC = 1 THEN 1 ELSE 0 END) AS TIPO_1, SUM(CASE WHEN B.TIPO_DOC = 2 THEN 1 ELSE 0 END) AS TIPO_2, SUM(CASE WHEN B.TIPO_DOC = 3 THEN 1 ELSE 0 END) AS TIPO_3 FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A FULL OUTER JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB B ON A.ID=B.ID_PADRE`;
    const params = [];

    if (clienteId) {
      sql += ` WHERE A.ID_CLIENTE = ?`;
      params.push(clienteId);
    }

    const result = await cn.query(sql, params);

    // Decodificar los resultados desde latin1
    const contra = result[0];

    // Respuesta con los detalles del contrato
    res.json({
      success: true,
      data: {
        PADRE: contra.PADRE,
        TIPO_1: contra.TIPO_1,
        TIPO_2: contra.TIPO_2,
        TIPO_3: contra.TIPO_3,
      },
    });
  } catch (error) {
    console.error("Error al obtener los contadores:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los contadores" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const contClient = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const result = await cn.query(`
              SELECT C.CLINOM, C.CLIABR, A.ID_CLIENTE, 
                  SUM(COALESCE(A.CANT_VEHI, 0) + COALESCE(B.CANT_VEHI, 0)) AS TOTAL_VEHICULOS 
              FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A
              LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB B ON A.ID = B.ID_PADRE
              LEFT JOIN ${SCHEMA_BD}.TCLIE C ON CASE 
                  WHEN C.CLICVE NOT LIKE '%[^0-9]%' THEN C.CLICVE ELSE NULL END = CAST(A.ID_CLIENTE AS VARCHAR(20))
              GROUP BY A.ID_CLIENTE, C.CLINOM, C.CLIABR
              ORDER BY TOTAL_VEHICULOS DESC 
              FETCH FIRST 3 ROWS ONLY
          `);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error al obtener los contadores:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los contadores" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const insertContract = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const {
    idCliente,
    nroContrato,
    cantVehiculos,
    fechaFirma,
    duracion,
    kmAdicional,
    kmTotal,
    vehSup,
    vehSev,
    vehSoc,
    vehCiu,
    tipoMoneda,
    tipoCliente,
    contratoEspecial,
    story,
    detalles,
    archivoPdf,
  } = req.body;

  const claseContra = "P";
  const fechaFormatoDB = convertirFecha(fechaFirma);

  const oldKey = archivoPdf;
  const newKey = oldKey.replace(/^temp\//, "");

  const pool = await connection(globalDbUser, globalPassword);
  const cn = await pool.connect();

  try {
    const sqlSearchContract = `SELECT * FROM ${SCHEMA_BD}.TBLCONTRATO_CAB WHERE UPPER(NRO_CONTRATO) = ?`;

    const findContract = await cn.query(sqlSearchContract, [
      nroContrato.toUpperCase(),
    ]);

    if (findContract.length > 0)
      return res.status(409).json({
        success: false,
        message: "El N° contrato ya se encuentra registrado",
      });

    // await cn.beginTransaction();

    const queryCabecera = `
              INSERT INTO ${SCHEMA_BD}.TBLCONTRATO_CAB 
              (ID_CLIENTE, NRO_CONTRATO, CANT_VEHI, FECHA_FIRMA, DURACION, KM_ADI, KM_TOTAL, VEH_SUP, VEH_SEV, VEH_SOC, VEH_CIU, TIPO_CONT, TIPO_CLI, MONEDA, DESCRIPCION, ARCHIVO_PDF, CLASE)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    const result = await cn.query(queryCabecera, [
      idCliente,
      nroContrato,
      cantVehiculos,
      fechaFormatoDB,
      duracion,
      kmAdicional,
      kmTotal,
      vehSup,
      vehSev,
      vehSoc,
      vehCiu,
      contratoEspecial,
      tipoCliente,
      tipoMoneda,
      story,
      newKey,
      claseContra,
    ]);

    await moveFile(oldKey, newKey)

    const idContratoCab = result.insertId || (await obtenerUltimoId(cn));

    const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBLCONTRATO_DET 
              (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    if (detalles && detalles.length > 0) {
      for (const detalle of detalles) {
        await cn.query(queryDetalle, [
          idContratoCab,
          detalle.secCon,
          detalle.modelo,
          detalle.tipoTerreno,
          detalle.tarifa,
          detalle.cpk,
          detalle.rm,
          detalle.cantidad,
          detalle.duracion,
          detalle.compraVeh,
          detalle.precioVeh,
        ]);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "El contrato no puede quedar sin ningun modelo detallado",
      });
    }

    // await cn.commit();

    res.json({ success: true });
  } catch (error) {
    await cn.rollback();
    console.error("Error al insertar contrato:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar contrato" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const updateContract = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { id } = req.params;

  const contractId = Number(id);

  if (isNaN(contractId))
    return res.status(400).json({
      success: false,
      message: "El parametro id no es un dato numérico",
    });

  const {
    idCliente,
    nroContrato,
    cantVehiculos,
    fechaFirma,
    duracion,
    kmAdicional,
    kmTotal,
    vehSup,
    vehSev,
    vehSoc,
    vehCiu,
    tipoMoneda,
    tipoCliente,
    contratoEspecial,
    story,
    detalles,
    archivoPdf,
  } = req.body;

  const claseContra = "P";
  const fechaFormatoDB = convertirFecha(fechaFirma);

  const oldKey = archivoPdf;
  const newKey = oldKey.replace(/^temp\//, "");

  const pool = await connection(globalDbUser, globalPassword);
  const cn = await pool.connect();

  try {
    // VALIDAR QUE EL ID EXISTA Y TRAIGA UN CONTRATO
    const sql = `
      SELECT C.*, C.DURACION AS PLAZO, D.*, D.ID AS ID_DET FROM SPEED400AT.TBLCONTRATO_CAB C
      LEFT JOIN SPEED400AT.TBLCONTRATO_DET D
      ON C.ID = D.ID_CON_CAB
      WHERE C.ID = ?
    `;

    const findContract = await cn.query(sql, [contractId]);

    if (findContract.length == 0)
      return res.status(404).json({
        success: false,
        message: "No se encontró el contrato solicitado",
      });

    // VALIDAR QUE NO SE DUPLIQUE UN NUMERO DE CONTRATO EN CASO SE PASE UNO NUEVO
    if (
      findContract[0].NRO_CONTRATO.trim().toUpperCase() !=
      nroContrato.toUpperCase()
    ) {
      const sqlSearchContract = `SELECT * FROM ${SCHEMA_BD}.TBLCONTRATO_CAB WHERE UPPER(NRO_CONTRATO) = ?`;

      const findNroContract = await cn.query(sqlSearchContract, [
        nroContrato.toUpperCase(),
      ]);

      if (findNroContract.length > 0)
        return res.status(409).json({
          success: false,
          message: "El N° contrato ya se encuentra registrado",
        });
    }

    // INICIAMOS LA TRANSACCION
    // await cn.beginTransaction();

    // ACTUALIZAMOS LA CABECERA DEL CONTRATO
    const queryCabecera = `
              UPDATE ${SCHEMA_BD}.TBLCONTRATO_CAB 
              SET ID_CLIENTE = ?, NRO_CONTRATO = ?, CANT_VEHI = ?, FECHA_FIRMA = ?, DURACION = ?, KM_ADI = ?, KM_TOTAL = ?, VEH_SUP = ?, VEH_SEV = ?, VEH_SOC = ?, VEH_CIU = ?, TIPO_CONT = ?, TIPO_CLI = ?, MONEDA = ?, DESCRIPCION = ?, ARCHIVO_PDF = ?, CLASE = ?
              WHERE ID = ?
          `;

    await cn.query(queryCabecera, [
      idCliente,
      nroContrato,
      cantVehiculos,
      fechaFormatoDB,
      duracion,
      kmAdicional,
      kmTotal,
      vehSup,
      vehSev,
      vehSoc,
      vehCiu,
      contratoEspecial,
      tipoCliente,
      tipoMoneda,
      story,
      newKey,
      claseContra,
      contractId,
    ]);

    await moveFile(oldKey, newKey)

    const idContractCab = contractId;

    // SECCION DE DETALLES

    const detailDelete = [];
    const detailUpdate = [];
    const detailNew = [];

    if (detalles && detalles.length > 0) {
      for (const detalle of detalles) {
        console.log(detalle);
        if (!detalle.idDet) {
          // ASIGNAMOS LA LISTA DE DETALLES PARA CREAR NUEVOS
          detailNew.push(detalle);
        } else {
          // ASIGNAMOS LA LISTA DE DETALLES PARA ACTUALIZAR
          detailUpdate.push(detalle);
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "El contrato no puede quedar sin ningun modelo detallado",
      });
    }

    // VALIDAMOS Y ASIGNAMOS LA LISTA DE DETALLES A ELIMINAR
    const paramsDet = detailUpdate.map(() => "?");

    const queryValidDelete = `
            SELECT D.ID FROM ${SCHEMA_BD}.TBLCONTRATO_DET D
            LEFT JOIN SPEED400AT.TBLCONTRATO_CAB C
            ON D.ID_CON_CAB = C.ID
            WHERE C.ID = ? AND D.ID NOT IN (${paramsDet.join(",")})
          `;
    
    const resultValidDelete = await cn.query(
      queryValidDelete,
      [idContractCab, ...detailUpdate.map((det) => det.idDet),]
    );

    if (resultValidDelete.length > 0) {
      resultValidDelete.forEach((row) => {
        detailDelete.push(row.ID);
      });
    }

    const queryUpdDetalle = `
      UPDATE ${SCHEMA_BD}.TBLCONTRATO_DET 
      SET SEC_CON = ?, MODELO = ?, TIPO_TERRENO = ?, TARIFA = ?, CPK = ?, RM = ?, CANTIDAD = ?, DURACION = ?, PRECIO_VEH = ?, PRECIO_VENTA = ?
      WHERE ID = ?
    `;

    // ACTUALIZAMOS LOS DETALLES
    for (const detalle of detailUpdate) {
      await cn.query(queryUpdDetalle, [
        detalle.secCon,
        detalle.modelo,
        detalle.tipoTerreno,
        detalle.tarifa,
        detalle.cpk,
        detalle.rm,
        detalle.cantidad,
        detalle.duracion,
        detalle.compraVeh,
        detalle.precioVeh,
        detalle.idDet,
      ]);
    }

    // CREAMOS LOS NUEVOS DETALLES
    const queryNewDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBLCONTRATO_DET 
              (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    for(const detalle of detailNew) {
      console.log(detailNew);
      await cn.query(queryNewDetalle, [
        idContractCab,
        detalle.secCon,
        detalle.modelo,
        detalle.tipoTerreno,
        detalle.tarifa,
        detalle.cpk,
        detalle.rm,
        detalle.cantidad,
        detalle.duracion,
        detalle.compraVeh,
        detalle.precioVeh,
      ]);
    }

    // ELIMINAMOS LOS DETALLES

    if (detailDelete.length > 0) {
      const paramsDel = detailDelete.map(() => "?");

      const queryDelDetalle = `
        DELETE FROM ${SCHEMA_BD}.TBLCONTRATO_DET
        WHERE ID IN (${paramsDel.join(",")})
      `;

      await cn.query(queryDelDetalle, detailDelete);
    }

    // await cn.commit();

    res.json({ success: true });
  } catch (error) {
    await cn.rollback();
    console.error("Error al insertar contrato:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar contrato" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const getContractById = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { id } = req.params;

  const contractId = Number(id);

  if (isNaN(contractId))
    return res.status(400).json({
      success: false,
      message: "El parametro id no es un dato numérico",
    });

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const sql = `
      SELECT * FROM SPEED400AT.TBLCONTRATO_CAB C
      WHERE C.ID = ?
    `;

    const result = await cn.query(sql, [contractId]);

    const sqlDetail = `
      SELECT * FROM SPEED400AT.TBLCONTRATO_DET D
      WHERE D.ID_CON_CAB = ?
    `

    const resultDet = await cn.query(sqlDetail, [contractId])

    if (result.length == 0)
      return res.status(404).json({
        success: false,
        message: "No se encontró el contrato solicitado",
      });

    const contractDetail = resultDet.map((row) => ({
      id: row.ID,
      idContratoCab: row.ID_CON_CAB,
      secCon: row.SEC_CON,
      modelo: row.MODELO.trim(),
      tipoTerreno: row.TIPO_TERRENO,
      tarifa: row.TARIFA,
      cpk: row.CPK,
      rm: row.RM,
      cantidad: row.CANTIDAD,
      duracion: row.DURACION.trim(),
      compraVeh: row.PRECIO_VEH,
      precioVeh: row.PRECIO_VENTA,
    }));

    const contractData = {
      idCliente: result[0].ID_CLIENTE,
      nroContrato: result[0].NRO_CONTRATO.trim(),
      cantVehiculos: result[0].CANT_VEHI || 0,
      fechaFirma: convertirFecha(result[0].FECHA_FIRMA.trim()),
      duracion: result[0].DURACION.trim(),
      kmAdicional: result[0].KM_ADI,
      kmTotal: result[0].KM_TOTAL,
      vehSup: result[0].VEH_SUP,
      vehSev: result[0].VEH_SEV,
      vehSoc: result[0].VEH_SOC,
      vehCiu: result[0].VEH_CIU,
      tipoMoneda: result[0].MONEDA.trim(),
      tipoCliente: result[0].TIPO_CLI.trim(),
      contratoEspecial: result[0].TIPO_CONT,
      story: result[0].DESCRIPCION.trim(),
      detalles: contractDetail,
      archivoPdf: result[0].ARCHIVO_PDF.trim(),
    };

    return res.status(200).json(contractData);
  } catch (error) {
    console.error("Error al obtener contrato por id", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener contrato por id" });
  } finally {
    if (cn) await cn.close();
  }
};

module.exports = {
  contractNro,
  contractNroAdi,
  tableContract,
  detailContract,
  detailVehByCont,
  contContract,
  contClient,
  insertContract,
  updateContract,
  getContractById,
};
