const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const contVehicleFeet = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { clienteId, status } = req.query; // Obtiene el idCli de los parámetros de consulta

  const cn = await connection(globalDbUser, globalPassword);

  try {
    let sql = `
      SELECT COALESCE(SUM(TOTAL_VEHICULO), 0) AS TOTAL_VEHICULO, COALESCE(SUM(TOTAL_VENTA), 0) AS TOTAL_VENTA 
      FROM (
        SELECT CC.ID_CLIENTE, SUM(CD.PRECIO_VEH * CD.CANTIDAD) AS TOTAL_VEHICULO, SUM(CD.PRECIO_VENTA * CD.CANTIDAD) AS TOTAL_VENTA FROM ${SCHEMA_BD}.TBLCONTRATO_DET CD
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON CC.ID = CD.ID_CON_CAB
        GROUP BY CC.ID_CLIENTE

        UNION ALL

        SELECT DC.ID_CLIENTE, SUM(DD.PRECIO_VEH * DD.CANTIDAD) AS TOTAL_VEHICULO, SUM(DD.PRECIO_VENTA * DD.CANTIDAD) AS TOTAL_VENTA FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET DD
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
        ON DC.ID = DD.ID_CON_CAB
        GROUP BY DC.ID_CLIENTE
      )
    `;

    const params = [];

    if (status) {
      if (status == "A") {
        sql = `
          SELECT COALESCE(SUM(TOTAL_VEHICULO), 0) AS TOTAL_VEHICULO, COALESCE(SUM(TOTAL_VENTA), 0) AS TOTAL_VENTA 
          FROM (
            SELECT CC.ID_CLIENTE, SUM(CD.PRECIO_VEH * CD.CANTIDAD) AS TOTAL_VEHICULO, SUM(CD.PRECIO_VENTA * CD.CANTIDAD) AS TOTAL_VENTA FROM ${SCHEMA_BD}.TBLCONTRATO_DET CD
            LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
            ON CC.ID = CD.ID_CON_CAB
            WHERE ADD_MONTHS(
              DATE(
                SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || 
                SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-'  ||
                SUBSTR(CC.FECHA_FIRMA, 7, 2)
              ),
              CAST(CC.DURACION AS INTEGER)
            ) > CURRENT DATE
            GROUP BY CC.ID_CLIENTE

            UNION ALL

            SELECT DC.ID_CLIENTE, SUM(DD.PRECIO_VEH * DD.CANTIDAD) AS TOTAL_VEHICULO, SUM(DD.PRECIO_VENTA * DD.CANTIDAD) AS TOTAL_VENTA FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET DD
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
            ON DC.ID = DD.ID_CON_CAB
            WHERE ADD_MONTHS(
              DATE(
                SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || 
                SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-'  ||
                SUBSTR(DC.FECHA_FIRMA, 7, 2)
              ),
              CAST(DC.DURACION AS INTEGER)
            ) > CURRENT DATE
          GROUP BY DC.ID_CLIENTE
          )
        `;
      } else if (status == "F") {
        sql = `
          SELECT COALESCE(SUM(TOTAL_VEHICULO), 0) AS TOTAL_VEHICULO, COALESCE(SUM(TOTAL_VENTA), 0) AS TOTAL_VENTA 
          FROM (
            SELECT CC.ID_CLIENTE, SUM(CD.PRECIO_VEH * CD.CANTIDAD) AS TOTAL_VEHICULO, SUM(CD.PRECIO_VENTA * CD.CANTIDAD) AS TOTAL_VENTA FROM ${SCHEMA_BD}.TBLCONTRATO_DET CD
            LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
            ON CC.ID = CD.ID_CON_CAB
            WHERE ADD_MONTHS(
              DATE(
                SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || 
                SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-'  ||
                SUBSTR(CC.FECHA_FIRMA, 7, 2)
              ),
              CAST(CC.DURACION AS INTEGER)
            ) < CURRENT DATE
            GROUP BY CC.ID_CLIENTE

            UNION ALL

            SELECT DC.ID_CLIENTE, SUM(DD.PRECIO_VEH * DD.CANTIDAD) AS TOTAL_VEHICULO, SUM(DD.PRECIO_VENTA * DD.CANTIDAD) AS TOTAL_VENTA FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET DD
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
            ON DC.ID = DD.ID_CON_CAB
            WHERE ADD_MONTHS(
              DATE(
                SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || 
                SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-'  ||
                SUBSTR(DC.FECHA_FIRMA, 7, 2)
              ),
              CAST(DC.DURACION AS INTEGER)
            ) < CURRENT DATE
          GROUP BY DC.ID_CLIENTE
          )
        `;
      }
    }

    if (clienteId) {
      sql += ` WHERE ID_CLIENTE = ?`;
      params.push(clienteId);
    }

    const result = await cn.query(sql, params);

    if (result.length == 0 || !result[0])
      return res
        .status(400)
        .json({ success: false, message: "No se encontraron resultados" });

    return res.status(200).json({
      totalCosto: result[0].TOTAL_VEHICULO,
      totalVenta: result[0].TOTAL_VENTA,
    });
  } catch (error) {
    console.error("Error al obtener reporte de flota vehicular", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener reporte de flota vehicular",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const contVehicleLeasings = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { clienteId } = req.query;

  const draw = parseInt(req.query.draw);
  let start = parseInt(req.query.start) || 0;
  let length = parseInt(req.query.length) || 10;
  const search = req.query.search || "";

  const cn = await connection(globalDbUser, globalPassword);

  try {
    let sql = `
      SELECT * FROM (
      SELECT 
        LD.ID,
        LD.PLACA,
        LD.MODELO,
        LC.NRO_LEASING,
        LC.ID_CLIENTE AS CLIENTE,
        LC.TIPCON AS TIPO_CON,
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        ) AS FECHA_INI_CON,
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        ) AS FECHA_FIN_CON,
        CAST(ROUND((DAYS(
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_CONTRATO,
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        ) AS FECHA_INI_LEA,
        DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        ) AS FECHA_FIN_LEA,
        CAST(ROUND((DAYS(
          DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_LEA,
        DAYS(
          ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
            CAST(C.DURACION AS INTEGER)
          )
        ) - DAYS (
          DATE(
            SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
            SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
            SUBSTR(LC.FECHA_FIN, 7, 2)
          )
        ) AS DIFERENCIA_DIAS
      FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB C
      ON LC.ID_CONTRATO = C.ID
      WHERE LC.TIPCON = 'P'
      UNION ALL
      SELECT 
        LD.ID,
        LD.PLACA,
        LD.MODELO,
        LC.NRO_LEASING,
        LC.ID_CLIENTE AS CLIENTE,
        LC.TIPCON AS TIPO_CON,
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        ) AS FECHA_INI_CON,
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        ) AS FECHA_FIN_CON,
        CAST(ROUND((DAYS(
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_CONTRATO,
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        ) AS FECHA_INI_LEA,
        DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        ) AS FECHA_FIN_LEA,
        CAST(ROUND((DAYS(
          DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_LEA,
        DAYS(
          ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
            CAST(C.DURACION AS INTEGER)
          )
        ) - DAYS (
          DATE(
            SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
            SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
            SUBSTR(LC.FECHA_FIN, 7, 2)
          )
        ) AS DIFERENCIA_DIAS
      FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB C
      ON LC.ID_CONTRATO = C.ID
      WHERE LC.TIPCON = 'H')
      WHERE (LOCATE_IN_STRING(UPPER(NRO_LEASING), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(PLACA), UPPER(?)) > 0)  
      ${clienteId ? `AND CLIENTE = ?` : ""}
      ORDER BY ID
      OFFSET ? ROWS
      FETCH NEXT ? ROWS ONLY
    `;

    const params = [];

    let sqlCount = `
    SELECT COUNT(ID) AS TOTAL FROM (
      SELECT 
        LD.ID,
        LD.PLACA,
        LD.MODELO,
        LC.NRO_LEASING,
        LC.ID_CLIENTE AS CLIENTE,
        LC.TIPCON AS TIPO_CON,
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        ) AS FECHA_INI_CON,
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        ) AS FECHA_FIN_CON,
        CAST(ROUND((DAYS(
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_CONTRATO,
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        ) AS FECHA_INI_LEA,
        DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        ) AS FECHA_FIN_LEA,
        CAST(ROUND((DAYS(
          DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_LEA,
        DAYS(
          ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
            CAST(C.DURACION AS INTEGER)
          )
        ) - DAYS (
          DATE(
            SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
            SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
            SUBSTR(LC.FECHA_FIN, 7, 2)
          )
        ) AS DIFERENCIA_DIAS
      FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB C
      ON LC.ID_CONTRATO = C.ID
      WHERE LC.TIPCON = 'P'
      UNION ALL
      SELECT 
        LD.ID,
        LD.PLACA,
        LD.MODELO,
        LC.NRO_LEASING,
        LC.ID_CLIENTE AS CLIENTE,
        LC.TIPCON AS TIPO_CON,
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        ) AS FECHA_INI_CON,
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        ) AS FECHA_FIN_CON,
        CAST(ROUND((DAYS(
        ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
          CAST(C.DURACION AS INTEGER)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
          SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
          SUBSTR(C.FECHA_FIRMA, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_CONTRATO,
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        ) AS FECHA_INI_LEA,
        DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        ) AS FECHA_FIN_LEA,
        CAST(ROUND((DAYS(
          DATE(
          SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_FIN, 7, 2)
        )
        ) -
        DAYS (
        DATE(
          SUBSTR(LC.FECHA_INI, 1, 4) || '-' || 
          SUBSTR(LC.FECHA_INI, 5, 2) || '-'  ||
          SUBSTR(LC.FECHA_INI, 7, 2)
        )
        )) / 365.25, 0) AS INTEGER) AS ANOS_LEA,
        DAYS(
          ADD_MONTHS(
          DATE(
            SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
            SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
            SUBSTR(C.FECHA_FIRMA, 7, 2)
          ),
            CAST(C.DURACION AS INTEGER)
          )
        ) - DAYS (
          DATE(
            SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || 
            SUBSTR(LC.FECHA_FIN, 5, 2) || '-'  ||
            SUBSTR(LC.FECHA_FIN, 7, 2)
          )
        ) AS DIFERENCIA_DIAS
      FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB C
      ON LC.ID_CONTRATO = C.ID
      WHERE LC.TIPCON = 'H')
      WHERE (LOCATE_IN_STRING(UPPER(NRO_LEASING), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(PLACA), UPPER(?)) > 0) 
      ${clienteId ? `AND CLIENTE = ?` : ""}
    `;

    const paramsTotal = [];

    if (clienteId) {
      params.push(search, search, clienteId, start, length);
      paramsTotal.push(search, search, clienteId);
    } else {
      params.push(search, search, start, length);
      paramsTotal.push(search, search);
    }

    const result = await cn.query(sql, params);

    const resultTotal = await cn.query(sqlCount, paramsTotal);

    const cleanedResult = result.map((row) => ({
      id: row.ID,
      placa: row.PLACA.trim(),
      modelo: row.MODELO.trim(),
      nroLeasing: row.NRO_LEASING.trim(),
      cliente: row.CLIENTE,
      tipoCont: row.TIPO_CON.trim(),
      fechaIniCont: row.FECHA_INI_CON.trim(),
      fechaFinCont: row.FECHA_FIN_CON.trim(),
      añosContrato: row.ANOS_CONTRATO,
      fechaIniLea: row.FECHA_INI_LEA.trim(),
      fechaFinLea: row.FECHA_FIN_LEA.trim(),
      añosLeasing: row.ANOS_LEA,
      diferenciaDias: row.DIFERENCIA_DIAS,
    }));

    const totalElements = resultTotal[0].TOTAL;

    return res.status(200).json({
      draw: draw,
      recordsTotal: totalElements,
      recordsFiltered: totalElements,
      data: cleanedResult,
    });
  } catch (error) {
    console.error("Error al obtener reporte de leasings", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener reportes de leasings",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const contLeasings = async (req, res) => {
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
    const sqlVencidos = `
      SELECT 
        COUNT(CASE WHEN  DIFERENCIA_DIAS < 0 AND DIFERENCIA_DIAS >= -30 THEN 1 END) AS "MENOR_30_DIAS" ,
        COUNT(CASE WHEN  DIFERENCIA_DIAS < -30 AND DIFERENCIA_DIAS >= -45 THEN 1 END) AS "ENTRE_30_Y_45_DIAS",
        COUNT(CASE WHEN  DIFERENCIA_DIAS < -45 AND DIFERENCIA_DIAS >= -60 THEN 1 END) AS "ENTRE_45_Y_60_DIAS",
        COUNT(CASE WHEN  DIFERENCIA_DIAS < -60 AND DIFERENCIA_DIAS >= -90 THEN 1 END) AS "ENTRE_60_Y_90_DIAS",
        COUNT(CASE WHEN  DIFERENCIA_DIAS < -90 THEN 1 END) AS "MAYOR_90_DIAS"
      FROM (
      SELECT LC.ID_CLIENTE, LD.MODELO, LD.PLACA, LC.NRO_LEASING, DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2)) AS FECHA_FIN, DAYS(DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2))) - DAYS(CURRENT DATE) AS DIFERENCIA_DIAS
      FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      ) ${clienteId ? "WHERE ID_CLIENTE = ?" : ""}
    `;

    const sqlPorVencer = `
      SELECT 
        COUNT(CASE WHEN  DIFERENCIA_DIAS > 0 AND DIFERENCIA_DIAS <= 30 THEN 1 END) AS "MENOR_30_DIAS" ,
        COUNT(CASE WHEN  DIFERENCIA_DIAS > 30 AND DIFERENCIA_DIAS <= 45 THEN 1 END) AS "ENTRE_30_Y_45_DIAS",
        COUNT(CASE WHEN  DIFERENCIA_DIAS > 45 AND DIFERENCIA_DIAS <= 60 THEN 1 END) AS "ENTRE_45_Y_60_DIAS",
        COUNT(CASE WHEN  DIFERENCIA_DIAS > 60 AND DIFERENCIA_DIAS <= 90 THEN 1 END) AS "ENTRE_60_Y_90_DIAS",
        COUNT(CASE WHEN  DIFERENCIA_DIAS > 90 THEN 1 END) AS "MAYOR_90_DIAS"
      FROM (
      SELECT LC.ID_CLIENTE, LD.MODELO, LD.PLACA, LC.NRO_LEASING, DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2)) AS FECHA_FIN, DAYS(DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2))) - DAYS(CURRENT DATE) AS DIFERENCIA_DIAS
      FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      ) ${clienteId ? "WHERE ID_CLIENTE = ?" : ""}
    `;

    const params = [];

    if (clienteId) params.push(clienteId);

    const resultVencidos = await cn.query(sqlVencidos, params);
    const resultPorVencer = await cn.query(sqlPorVencer, params);

    const clsVencidos = {
      menor30Dias: resultVencidos[0].MENOR_30_DIAS,
      entre30Y45Dias: resultVencidos[0].ENTRE_30_Y_45_DIAS,
      entre45Y60Dias: resultVencidos[0].ENTRE_45_Y_60_DIAS,
      entre60Y90Dias: resultVencidos[0].ENTRE_60_Y_90_DIAS,
      mayor90Dias: resultVencidos[0].MAYOR_90_DIAS,
    };

    const clsPorVencer = {
      menor30Dias: resultPorVencer[0].MENOR_30_DIAS,
      entre30Y45Dias: resultPorVencer[0].ENTRE_30_Y_45_DIAS,
      entre45Y60Dias: resultPorVencer[0].ENTRE_45_Y_60_DIAS,
      entre60Y90Dias: resultPorVencer[0].ENTRE_60_Y_90_DIAS,
      mayor90Dias: resultPorVencer[0].MAYOR_90_DIAS,
    };

    return res.status(200).json({
      vencidos: clsVencidos,
      porVencer: clsPorVencer,
    });
  } catch (error) {
    console.error("Error al obtener leasings vencidos y por vencer", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener leasings vencidos y por vencer",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const listVehicleLeasingExpire = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { label, clienteId } = req.query;

  if (!label)
    return res
      .status(400)
      .json({ success: false, message: "El parametro label es obligatorio" });

  const draw = parseInt(req.query.draw);
  let start = parseInt(req.query.start) || 0;
  let length = parseInt(req.query.length) || 10;
  const search = req.query.search || "";

  const cn = await connection(globalDbUser, globalPassword);

  try {
    let sentences;

    switch (label) {
      case "Menor 30 dias":
        sentences = "DIFERENCIA_DIAS < 0 AND DIFERENCIA_DIAS >= -30";
        break;
      case "Entre 30 y 45 dias":
        sentences = "DIFERENCIA_DIAS < -30 AND DIFERENCIA_DIAS >= -45";
        break;
      case "Entre 45 y 60 dias":
        sentences = "DIFERENCIA_DIAS < -45 AND DIFERENCIA_DIAS >= -60";
        break;
      case "Entre 60 y 90 dias":
        sentences = "DIFERENCIA_DIAS < -60 AND DIFERENCIA_DIAS >= -90";
        break;
      case "Mayor 90 dias":
        sentences = "DIFERENCIA_DIAS < -90";
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "El label no es valido" });
    }

    const sql = `
      SELECT *
      FROM (
        SELECT LD.ID, LC.ID_CLIENTE, C.CLINOM AS CLIENTE, LD.MODELO, LD.PLACA, M.DESCRIPCION AS MARCA,  LC.NRO_LEASING, DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2)) AS FECHA_FIN, DAYS(DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2))) - DAYS(CURRENT DATE) AS DIFERENCIA_DIAS
        FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
        ON LD.ID_LEA_CAB = LC.ID
        LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
        ON LD.ID_VEH = V.ID
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
        ON V.IDMAR = M.ID
        LEFT JOIN (
              SELECT DISTINCT A.IDCLI, B.CLINOM 
              FROM ${SCHEMA_BD}.PO_OPERACIONES A 
              INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
              WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
              ORDER BY CLINOM ASC
        ) C ON LC.ID_CLIENTE = C.IDCLI
      ) WHERE ${sentences} ${clienteId ? "AND ID_CLIENTE = ?" : ""} AND (LOCATE_IN_STRING(UPPER(CLIENTE), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(PLACA), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(NRO_LEASING), UPPER(?)) > 0)
      ORDER BY ID
      OFFSET ? ROWS
      FETCH NEXT ? ROWS ONLY
    `;

    const params = [];

    const sqlTotal = `
      SELECT COUNT(*) AS TOTAL
      FROM (
        SELECT LD.ID, LC.ID_CLIENTE, C.CLINOM AS CLIENTE, LD.MODELO, LD.PLACA, M.DESCRIPCION AS MARCA,  LC.NRO_LEASING, DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2)) AS FECHA_FIN, DAYS(DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2))) - DAYS(CURRENT DATE) AS DIFERENCIA_DIAS
        FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
        ON LD.ID_LEA_CAB = LC.ID
        LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
        ON LD.ID_VEH = V.ID
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
        ON V.IDMAR = M.ID
        LEFT JOIN (
              SELECT DISTINCT A.IDCLI, B.CLINOM 
              FROM ${SCHEMA_BD}.PO_OPERACIONES A 
              INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
              WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
              ORDER BY CLINOM ASC
        ) C ON LC.ID_CLIENTE = C.IDCLI
      ) WHERE ${sentences} ${clienteId ? "AND ID_CLIENTE = ?" : ""} AND (LOCATE_IN_STRING(UPPER(CLIENTE), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(PLACA), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(NRO_LEASING), UPPER(?)) > 0)
    `;

    const paramsTotal = [];

    if (clienteId) {
      params.push(clienteId);
      paramsTotal.push(clienteId);
    }

    params.push(search, search, search, start, length);
    paramsTotal.push(search, search, search);

    const result = await cn.query(sql, params);
    const resultTotal = await cn.query(sqlTotal, paramsTotal);

    const cleanedResult = result.map((row) => ({
      placa: row.PLACA.trim(),
      modelo: row.MODELO.trim(),
      marca: row.MARCA.trim(),
      nroLeasing: row.NRO_LEASING.trim(),
      fechaFin: row.FECHA_FIN.trim(),
      cliente: row.CLIENTE.trim(),
    }));

    const totalElements = resultTotal[0].TOTAL;

    return res.status(200).json({
      draw: draw,
      recordsTotal: totalElements,
      recordsFiltered: totalElements,
      data: cleanedResult,
    });
  } catch (error) {
    console.error("Error al obtener vehiculos por grafico", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener vehiculos por grafico",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const listVehicleLeasingToExpire = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { label, clienteId } = req.query;

  if (!label)
    return res
      .status(400)
      .json({ success: false, message: "El parametro label es obligatorio" });

  const draw = parseInt(req.query.draw);
  let start = parseInt(req.query.start) || 0;
  let length = parseInt(req.query.length) || 10;
  const search = req.query.search || "";

  const cn = await connection(globalDbUser, globalPassword);

  try {
    let sentences;

    switch (label) {
      case "Menor 30 dias":
        sentences = "DIFERENCIA_DIAS > 0 AND DIFERENCIA_DIAS <= 30";
        break;
      case "Entre 30 y 45 dias":
        sentences = "DIFERENCIA_DIAS > 30 AND DIFERENCIA_DIAS <= 45";
        break;
      case "Entre 45 y 60 dias":
        sentences = "DIFERENCIA_DIAS > 45 AND DIFERENCIA_DIAS <= 60";
        break;
      case "Entre 60 y 90 dias":
        sentences = "DIFERENCIA_DIAS > 60 AND DIFERENCIA_DIAS <= 90";
        break;
      case "Mayor 90 dias":
        sentences = "DIFERENCIA_DIAS > 90";
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "El label no es valido" });
    }

    const sql = `
      SELECT *
      FROM (
        SELECT LD.ID, LC.ID_CLIENTE, C.CLINOM AS CLIENTE, LD.MODELO, LD.PLACA, M.DESCRIPCION AS MARCA,  LC.NRO_LEASING, DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2)) AS FECHA_FIN, DAYS(DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2))) - DAYS(CURRENT DATE) AS DIFERENCIA_DIAS
        FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
        ON LD.ID_LEA_CAB = LC.ID
        LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
        ON LD.ID_VEH = V.ID
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
        ON V.IDMAR = M.ID
        LEFT JOIN (
              SELECT DISTINCT A.IDCLI, B.CLINOM 
              FROM ${SCHEMA_BD}.PO_OPERACIONES A 
              INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
              WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
              ORDER BY CLINOM ASC
        ) C ON LC.ID_CLIENTE = C.IDCLI
      ) WHERE ${sentences} ${clienteId ? "AND ID_CLIENTE = ?" : ""} AND (LOCATE_IN_STRING(UPPER(CLIENTE), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(PLACA), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(NRO_LEASING), UPPER(?)) > 0)
      ORDER BY ID
      OFFSET ? ROWS
      FETCH NEXT ? ROWS ONLY
    `;

    const params = [];

    const sqlTotal = `
      SELECT COUNT(*) AS TOTAL
      FROM (
        SELECT LD.ID, LC.ID_CLIENTE, C.CLINOM AS CLIENTE, LD.MODELO, LD.PLACA, M.DESCRIPCION AS MARCA,  LC.NRO_LEASING, DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2)) AS FECHA_FIN, DAYS(DATE(SUBSTR(LC.FECHA_FIN, 1, 4) || '-' || SUBSTR(LC.FECHA_FIN, 5, 2) || '-' || SUBSTR(LC.FECHA_FIN, 7, 2))) - DAYS(CURRENT DATE) AS DIFERENCIA_DIAS
        FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
        ON LD.ID_LEA_CAB = LC.ID
        LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
        ON LD.ID_VEH = V.ID
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
        ON V.IDMAR = M.ID
        LEFT JOIN (
              SELECT DISTINCT A.IDCLI, B.CLINOM 
              FROM ${SCHEMA_BD}.PO_OPERACIONES A 
              INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
              WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
              ORDER BY CLINOM ASC
        ) C ON LC.ID_CLIENTE = C.IDCLI
      ) WHERE ${sentences} ${clienteId ? "AND ID_CLIENTE = ?" : ""} AND (LOCATE_IN_STRING(UPPER(CLIENTE), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(PLACA), UPPER(?)) > 0 OR LOCATE_IN_STRING(UPPER(NRO_LEASING), UPPER(?)) > 0)
    `;

    const paramsTotal = [];

    if (clienteId) {
      params.push(clienteId);
      paramsTotal.push(clienteId);
    }

    params.push(search, search, search, start, length);
    paramsTotal.push(search, search, search);

    const result = await cn.query(sql, params);
    const resultTotal = await cn.query(sqlTotal, paramsTotal);

    const cleanedResult = result.map((row) => ({
      placa: row.PLACA.trim(),
      modelo: row.MODELO.trim(),
      marca: row.MARCA.trim(),
      nroLeasing: row.NRO_LEASING.trim(),
      fechaFin: row.FECHA_FIN.trim(),
      cliente: row.CLIENTE.trim(),
    }));

    const totalElements = resultTotal[0].TOTAL;

    return res.status(200).json({
      draw: draw,
      recordsTotal: totalElements,
      recordsFiltered: totalElements,
      data: cleanedResult,
    });
  } catch (error) {
    console.error("Error al obtener vehiculos por grafico", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener vehiculos por grafico",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const contVehiculeByClient = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { clientesId } = req.query;

  const listClient = clientesId
    ? Array.isArray(clientesId)
      ? clientesId
      : [clientesId]
    : [];

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const valueQuery = listClient.map(() => "?");

    const sql = `
      SELECT COUNT(*) AS TOTAL_VEH, C.IDCLI AS ID_CLIENTE, C.CLINOM AS CLIENTE FROM ${SCHEMA_BD}.TBL_LEASING_DET LD
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      ON LD.ID_LEA_CAB = LC.ID
      LEFT JOIN (
        SELECT DISTINCT A.IDCLI, B.CLINOM 
        FROM ${SCHEMA_BD}.PO_OPERACIONES A 
        INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE 
        WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***' 
        ORDER BY CLINOM ASC
      ) C
      ON LC.ID_CLIENTE = C.IDCLI
      ${listClient.length > 0 ? `WHERE C.IDCLI IN (${valueQuery.join(",")})` : ""}
      GROUP BY C.CLINOM, C.IDCLI
      ORDER BY TOTAL_VEH DESC
    `;

    const result = await cn.query(sql, listClient);

    return res.status(200).json(
      result.map((row) => ({
        id: row.ID_CLIENTE.trim(),
        cliente: row.CLIENTE.trim(),
        total: row.TOTAL_VEH,
      })),
    );
  } catch (error) {
    console.error("Error al obtener vehiculos por cliente");
    return res.status(500).json({
      success: false,
      message: "Error al obtener vehiculos por cliente",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const contComparationDays = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { contractId, leasingId } = req.query; // Obtiene el idCli de los parámetros de consulta

  if (!contractId || !leasingId)
    return res.status(400).json({
      success: false,
      message: "Los parametros contractId y leasingId son obligatorios",
    });

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const sql = `
      SELECT 
      DATE(
      SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' ||
      SUBSTR(C.FECHA_FIRMA, 5, 2) || '-' ||
      SUBSTR(C.FECHA_FIRMA, 7, 2)
      ) AS FECHA_INI_CON,

      ADD_MONTHS(
      DATE(
      SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' ||
      SUBSTR(C.FECHA_FIRMA, 5, 2) || '-' ||
      SUBSTR(C.FECHA_FIRMA, 7, 2)
      ),
      CAST(C.DURACION AS INTEGER)
      ) AS FECHA_FIN_CON,

      DATE(
      SUBSTR(L.FECHA_INI, 1, 4) || '-' ||
      SUBSTR(L.FECHA_INI, 5, 2) || '-' ||
      SUBSTR(L.FECHA_INI, 7, 2)
      ) AS FECHA_INI_LEA,

      DATE(
      SUBSTR(L.FECHA_FIN, 1, 4) || '-' ||
      SUBSTR(L.FECHA_FIN, 5, 2) || '-' ||
      SUBSTR(L.FECHA_FIN, 7, 2)
      ) AS FECHA_FIN_LEA,
       
      DAYS(
      ADD_MONTHS(
      DATE(
      SUBSTR(C.FECHA_FIRMA, 1, 4) || '-' || 
      SUBSTR(C.FECHA_FIRMA, 5, 2) || '-'  ||
      SUBSTR(C.FECHA_FIRMA, 7, 2)
      ),
      CAST(C.DURACION AS INTEGER)
      )
      ) - DAYS (
      DATE(
      SUBSTR(L.FECHA_FIN, 1, 4) || '-' || 
      SUBSTR(L.FECHA_FIN, 5, 2) || '-'  ||
      SUBSTR(L.FECHA_FIN, 7, 2)
      )
      ) AS DIFERENCIA_DIAS
      FROM SPEED400AT.TBLCONTRATO_CAB C
      LEFT JOIN SPEED400AT.TBL_LEASING_CAB L
      ON C.ID = L.ID_CONTRATO
      WHERE C.ID = ? AND L.ID = ?
    `;

    const result = await cn.query(sql, [contractId, leasingId]);

    return res.status(200).json({
      fechaIniCont: result[0] ? result[0].FECHA_INI_CON : "",
      fechaFinCont: result[0] ? result[0].FECHA_FIN_CON : "",
      fechaIniLea: result[0] ? result[0].FECHA_INI_LEA : "",
      fechaFinLea: result[0] ? result[0].FECHA_FIN_LEA : "",
      diferenciaDias: result[0] ? result[0].DIFERENCIA_DIAS : "",
    });
  } catch (error) {
    console.error("Error al obtener la diferencia de dias", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener la diferencia de dias",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const contTotalPriceByModel = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { modelId, years } = req.query;

  const listYears = years ? (Array.isArray(years) ? years : [years]) : [];

  if (!modelId)
    return res.status(400).json("El parametro modelId es obligatorio");

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const params = listYears.map(() => "?");

    const sql = `
      SELECT 
      mc.IDMODGEN ,
      mc.DESCRIPCION,
      ac.ANIO,
      SUM(cc.costo) AS total_costo
      FROM (
        SELECT 
              td.ID_CON_CAB,
              SUM(td.PRECIO_VEH * td.CANTIDAD) AS COSTO
          FROM SPEED400AT.TBLCONTRATO_DET td
          GROUP BY td.ID_CON_CAB 
      ) cc
      JOIN (
        SELECT DISTINCT
              l.ID_CONTRATO,
              m.IDMODGEN,
              m.DESCRIPCION
          FROM SPEED400AT.TBL_LEASING_CAB l
          JOIN SPEED400AT.TBL_LEASING_DET dl 
              ON dl.ID_LEA_CAB = l.ID
          JOIN SPEED400AT.PO_VEHICULO v 
              ON v.ID = dl.ID_VEH
          JOIN SPEED400AT.PO_MODELO m 
              ON m.ID = v.IDMOD
          WHERE m.IDMODGEN = ? 
      ) mc 
      ON mc.ID_CONTRATO  = cc.ID_CON_CAB 
      JOIN (
        SELECT 
              ID_CONTRATO,
              YEAR(DATE(SUBSTR(l.FECHA_INI, 1, 4) || '-' || SUBSTR(l.FECHA_INI, 5, 2) || '-' || SUBSTR(l.FECHA_INI, 7, 2)) - 2 MONTHS) AS ANIO
          FROM SPEED400AT.TBL_LEASING_CAB l 
          WHERE YEAR(DATE(SUBSTR(l.FECHA_INI, 1, 4) || '-' || SUBSTR(l.FECHA_INI, 5, 2) || '-' || SUBSTR(l.FECHA_INI, 7, 2)) - 2 MONTHS) IN (${params})
      ) ac 
      ON ac.ID_CONTRATO  = cc.ID_CON_CAB 
      GROUP BY 
          mc.IDMODGEN,
          mc.DESCRIPCION,
          ac.ANIO 
      ORDER BY 
      mc.IDMODGEN,
      ac.ANIO
    `;

    const result = await cn.query(sql, [modelId, ...listYears]);

    const cleanedResult = result.map((row) => ({
      MODELO: row.DESCRIPCION.trim(),
      ANO: row.ANIO,
      T_PRECIO_VEH: row.TOTAL_COSTO,
    }));

    // 1. Obtener una lista única de modelos
    const modelosUnicos = [...new Set(cleanedResult.map((item) => item.MODELO))];

    // 2. Generar la matriz completa (Modelo x Año)
    const resultado = modelosUnicos.flatMap((modelo) => {
      return listYears.map((anio) => {
        // Buscamos si el dato existe en el JSON original
        const registroExistente = cleanedResult.find(
          (d) => d.MODELO == modelo && d.ANO == anio,
        );

        // Si existe lo devolvemos, si no, creamos uno con precio 0
        return (
          registroExistente || {
            MODELO: modelo,
            ANO: anio,
            T_PRECIO_VEH: 0,
          }
        );
      });
    });

    return res.status(200).json(resultado);
  } catch (error) {
    console.error("Error al obtener costos por modelos", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener costos por modelo" });
  } finally {
    if (cn) await cn.close();
  }
};

module.exports = {
  contVehicleFeet,
  contVehicleLeasings,
  contLeasings,
  listVehicleLeasingExpire,
  listVehicleLeasingToExpire,
  contVehiculeByClient,
  contComparationDays,
  contTotalPriceByModel,
};
