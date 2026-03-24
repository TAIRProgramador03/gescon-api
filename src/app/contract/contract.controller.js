const { IP_LOCAL, SCHEMA_BD } = require("../../shared/conf.js");
const {
  decodeString,
  convertirFecha,
  obtenerUltimoId,
  funcionNumerica,
  funcionParteVar,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");

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
    // const query = `
    //           SELECT A.DESCRIPCION, A.FECHA_FIRMA, A.DURACION, A.VEH_SUP, A.VEH_SEV, A.VEH_SOC, A.VEH_CIU, (A.CANT_VEHI + COALESCE(SUM(B.CANT_VEHI), 0)) AS TOTAL_VEHICULOS, COUNT(B.ID) AS CANT_DOC
    //           FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB B ON A.ID=B.ID_PADRE WHERE NRO_CONTRATO = ?
    //           GROUP BY A.DESCRIPCION, A.FECHA_FIRMA, A.DURACION, A.VEH_SUP, A.VEH_SEV, A.VEH_SOC, A.VEH_CIU, A.CANT_VEHI, A.ID`;

    // const query = `
    //   SELECT
    //     A.DESCRIPCION,
    //     A.FECHA_FIRMA,
    //     A.DURACION,
    //     A.VEH_SUP,
    //     A.VEH_SEV,
    //     A.VEH_SOC,
    //     A.VEH_CIU,
    //     (
    //     	SELECT (A.CANT_VEHI + COALESCE(SUM(B.CANT_VEHI), 0)) AS TOTAL_VEHICULOS
    //       FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A
    //       LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB B
    //       ON A.ID=B.ID_PADRE
    //       WHERE A.ID_CLIENTE = ? AND A.ID = ?
    //       GROUP BY A.CANT_VEHI
    //     ) AS TOTAL_VEHICULOS,
    //     COUNT(DISTINCT B.ID) AS CANT_DOC,
    //     COUNT(DISTINCT C.ID) AS CANT_LEA,
    //     COUNT(DISTINCT D.ID) AS CANT_ASSIGN
    //   FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A
    //   LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB B ON A.ID=B.ID_PADRE
    //   LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB C ON A.ID=C.ID_CONTRATO AND A.ID_CLIENTE = C.ID_CLIENTE
    //   LEFT JOIN (
    //     SELECT B.ID AS ID, B.ID_CONTRATO AS ID_CONTRATO FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A
    //     LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B
    //     ON A.ID = B.ID_ASIGNACION
    //     WHERE A.ID_CLIENTE = ?
    //   ) D
    //   ON A.ID = D.ID_CONTRATO
    //   WHERE A.ID = ?
    //   GROUP BY A.DESCRIPCION, A.FECHA_FIRMA, A.DURACION, A.VEH_SUP, A.VEH_SEV, A.VEH_SOC, A.VEH_CIU, A.CANT_VEHI, A.ID
    // `;

    const sqlTotalVeh = `
      SELECT 
        COALESCE(CC.TOTAL_VEHI, 0) + SUM(COALESCE(DC.TOTAL_VEHI, 0)) AS TOTAL_VEHI,
        COALESCE(CC.TOTAL_VEH_SUP, 0) + SUM(COALESCE(DC.TOTAL_VEH_SUP, 0)) AS TOTAL_VEH_SUP,
        COALESCE(CC.TOTAL_VEH_SEV, 0) + SUM(COALESCE(DC.TOTAL_VEH_SEV, 0)) AS TOTAL_VEH_SEV,
        COALESCE(CC.TOTAL_VEH_SOC, 0) + SUM(COALESCE(DC.TOTAL_VEH_SOC, 0)) AS TOTAL_VEH_SOC,
        COALESCE(CC.TOTAL_VEH_CIU, 0) + SUM(COALESCE(DC.TOTAL_VEH_CIU, 0)) AS TOTAL_VEH_CIU
      FROM (
        SELECT 
          SUM(COALESCE(CC.CANT_VEHI, 0)) AS TOTAL_VEHI, 
          COALESCE(SUM(CC.VEH_SUP), 0) AS TOTAL_VEH_SUP, 
          COALESCE(SUM(CC.VEH_SEV), 0) AS TOTAL_VEH_SEV, 
          COALESCE(SUM(CC.VEH_SOC), 0) AS TOTAL_VEH_SOC, 
          COALESCE(SUM(CC.VEH_CIU), 0) AS TOTAL_VEH_CIU
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        WHERE ID_CLIENTE = ? 
        ${contratoId ? "AND ID = ?" : "AND (DATE(SUBSTR(FECHA_FIRMA, 1, 4) || '-' || SUBSTR(FECHA_FIRMA, 5, 2) || '-' || SUBSTR(FECHA_FIRMA, 7, 2)) + CAST(DURACION AS INTEGER) MONTHS) > CURRENT DATE"}
      ) CC
      CROSS JOIN (
        SELECT 
          SUM(COALESCE(DC.CANT_VEHI, 0)) AS TOTAL_VEHI, 
          COALESCE(SUM(DC.VEH_SUP), 0) AS TOTAL_VEH_SUP, 
          COALESCE(SUM(DC.VEH_SEV), 0) AS TOTAL_VEH_SEV, 
          COALESCE(SUM(DC.VEH_SOC), 0) AS TOTAL_VEH_SOC, 
          COALESCE(SUM(DC.VEH_CIU), 0) AS TOTAL_VEH_CIU
        FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
        WHERE DC.ID_CLIENTE = ? ${contratoId ? "AND ID_PADRE = ?" : "AND (DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS) > CURRENT DATE"}
      ) DC
      GROUP BY CC.TOTAL_VEHI, CC.TOTAL_VEH_SUP, CC.TOTAL_VEH_SEV, CC.TOTAL_VEH_SOC, CC.TOTAL_VEH_CIU
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
      SELECT COUNT(*) AS TOTAL_DOCUMENTOS FROM SPEED400AT.TBLCONTRATO_CAB CC
      LEFT JOIN SPEED400AT.TBLDOCUMENTO_CAB DC
      ON CC.ID = DC.ID_PADRE
      WHERE CC.ID_CLIENTE = ?
      ${contratoId ? `AND CC.ID = ?` : "AND (DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS) > CURRENT DATE "}
    `;

    const sqlContrato = `
      SELECT DESCRIPCION, FECHA_FIRMA, DURACION FROM SPEED400AT.TBLCONTRATO_CAB
      WHERE ID_CLIENTE = ? 
      ${contratoId ? `AND ID = ?` : ""}
    `;

    const sqlTotalPlacasActivas = `
      SELECT COUNT(*) AS TOTAL_ACTIVOS FROM (
        SELECT AD.PLACA, DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) AS FECHA_FIN_ACTA, DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO, AD.CLASE_CONTRATO 
        FROM SPEED400AT.TBL_ASIGNACION_DET AD
        LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB AC
        ON AD.ID_ASIGNACION = AC.ID
        LEFT JOIN SPEED400AT.TBLCONTRATO_CAB CC
        ON AD.ID_CONTRATO = CC.ID
        WHERE AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'P' AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) > (DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS)
        ${contratoId ? `AND CC.ID = ?` : ""}
        UNION ALL
        SELECT AD.PLACA, DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) AS FECHA_FIN_ACTA, DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO, AD.CLASE_CONTRATO
        FROM SPEED400AT.TBL_ASIGNACION_DET AD
        LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB AC
        ON AD.ID_ASIGNACION = AC.ID
        LEFT JOIN SPEED400AT.TBLDOCUMENTO_CAB DC
        ON AD.ID_CONTRATO = DC.ID
        LEFT JOIN SPEED400AT.TBLCONTRATO_CAB CC
        ON DC.ID_PADRE = CC.ID
        WHERE AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'H' AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) > (DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS)
        ${contratoId ? `AND CC.ID = ?` : ""}
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
        hayActivos: totalActivas.TOTAL_ACTIVOS > 0 ? true : false,
        cantidadVehiculos: totalVeh.TOTAL_VEHI,
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
  let nombreArchivo = `http://${IP_LOCAL}/tair-web/public/pdf/contracts/${archivoPdf}`;

  const cn = await connection(globalDbUser, globalPassword);

  try {
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
      nombreArchivo,
      claseContra,
    ]);

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
    }

    res.json({ success: true });
  } catch (error) {
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

const valideContractQuantity = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { detalles } = req.body;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res
      .status(400)
      .json({ success: false, mensaje: "Detalles faltantes o vacíos" });
  }

  const agrupados = {};
  for (let d of detalles) {
    let clase = funcionParteVar(d.idContrato);
    console.log(clase);
    let idContrato = funcionNumerica(d.idContrato);
    console.log(idContrato);

    if (!clase || !idContrato) {
      return res.status(400).json({
        success: false,
        mensaje: `Formato de contrato inválido en el detalle: ${d.idContrato}`,
      });
    }

    let key = `${clase}_${idContrato}`;
    if (!agrupados[key]) {
      agrupados[key] = {
        clase,
        idContrato,
        terrenos: [],
      };
    }

    agrupados[key].terrenos.push(d.idTerreno);
    console.log(d.idTerreno);
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    for (let key in agrupados) {
      let { clase, idContrato, terrenos } = agrupados[key];
      let squery = "";

      // Consulta SQL según el tipo de contrato
      if (clase.trim() === "H") {
        squery = `SELECT A.ID, A.CANT_VEHI, A.VEH_SUP, A.VEH_SEV, A.VEH_SOC, A.VEH_CIU, TRIM(A.CLASE) AS CLASE, 
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='0') AS SUPERFICIE,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='1') AS SOCAVON,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='2') AS CIUDAD,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='3') AS SEVERO,
                          (SELECT COUNT(*) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND CLASE_CONTRATO=A.CLASE) AS CANTIDAD 
                          FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A WHERE A.ID = ? AND CLASE='H'`;
      } else {
        squery = `SELECT A.ID, A.CANT_VEHI, A.VEH_SUP, A.VEH_SEV, A.VEH_SOC, A.VEH_CIU, TRIM(A.CLASE) AS CLASE,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='0') AS SUPERFICIE,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='1') AS SOCAVON,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='2') AS CIUDAD,
                          (SELECT COUNT(TP_TERRENO) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND TRIM(CLASE_CONTRATO)=TRIM(A.CLASE) AND TP_TERRENO='3') AS SEVERO,
                          (SELECT COUNT(*) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET WHERE ID_CONTRATO=A.ID AND CLASE_CONTRATO=A.CLASE) AS CANTIDAD 
                          FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A WHERE A.ID = ? AND CLASE='P'`;
      }

      let result = await cn.query(squery, [idContrato]);

      if (!result || result.length === 0) {
        return res.status(404).json({
          success: false,
          mensaje: `Contrato no encontrado: ${clase}_${idContrato}`,
        });
      }

      let row = result[0];
      let contadorNuevo = { 0: 0, 1: 0, 2: 0, 3: 0 };

      // Contamos cuántos terrenos de cada tipo existen en el detalle
      terrenos.forEach((tipo) => {
        let t = tipo?.toString();
        if (t in contadorNuevo) contadorNuevo[t]++;
      });

      console.log(contadorNuevo);

      let validaciones = [
        {
          tipo: "SUPERFICIE",
          cod: "0",
          maximo: row.VEH_SUP,
          actual: row.SUPERFICIE,
        },
        { tipo: "SOCAVÓN", cod: "1", maximo: row.VEH_SOC, actual: row.SOCAVON },
        { tipo: "CIUDAD", cod: "2", maximo: row.VEH_CIU, actual: row.CIUDAD },
        { tipo: "SEVERO", cod: "3", maximo: row.VEH_SEV, actual: row.SEVERO },
      ];

      for (let v of validaciones) {
        let nuevos = contadorNuevo[v.cod] || 0;
        console.log(
          `Tipo: ${v.tipo}, Actual: ${v.actual}, Nuevos: ${nuevos}, Máximo: ${v.maximo}`,
        );
        if (v.actual + nuevos > v.maximo) {
          console.log("Límite excedido para terreno tipo: " + v.tipo);
          return res.json({
            success: false,
            mensaje: `Límite excedido para terreno tipo ${v.tipo} en contrato ${clase}_${idContrato}. Permitido: ${v.maximo}, asignados: ${v.actual}, nuevos: ${nuevos}.`,
          });
        }
      }
      // Validación de límite de vehículos
      if (row.CANTIDAD + terrenos.length > row.CANT_VEHI) {
        return res.json({
          success: false,
          mensaje: `Límite total de vehículos excedido para contrato ${clase}_${idContrato}. Máximo: ${row.CANT_VEHI}, asignados: ${row.CANTIDAD}, nuevos: ${terrenos.length}.`,
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error en validación de contratos:", error);
    return res.status(500).json({
      success: false,
      mensaje: "Error interno del servidor durante la validación",
    });
  } finally {
    if (cn) {
      await cn.close();
    }
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
  valideContractQuantity,
};
