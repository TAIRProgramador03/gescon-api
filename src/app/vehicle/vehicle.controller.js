const { SCHEMA_BD } = require("../../shared/conf.js");
const {
  decodeString,
  convertirFecha,
  transformType,
  withConnection,
} = require("../../shared/utils.js");

const listVehicles = async (req, res) => {
  try {
    const result = await withConnection(async (cn) => {
      // Consulta los contratos asociados al cliente
      // A.INIVAL1='0' AND
      const query = `SELECT A.ID, A.CODINI AS CODINI, A.NUMPLA AS PLACA, C.DESCRIPCION AS MARCA, B.DESCRIPCION AS MODELO, B.DESMODGEN AS GENERICO, D.DESCRIP AS TERRENO FROM ${SCHEMA_BD}.PO_VEHICULO A LEFT JOIN ${SCHEMA_BD}.PO_MODELO B ON A.IDMOD=B.ID AND A.IDMODGEN=B.IDMODGEN LEFT JOIN ${SCHEMA_BD}.PO_MARCA C ON A.IDMAR=C.ID LEFT JOIN ${SCHEMA_BD}.PO_TERRENO D ON A.TP_TRABAJO=D.TPTRA LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_DET E ON A.ID=E.ID_VEH WHERE E.ID_VEH IS NULL ORDER BY A.ID DESC`;
      return await cn.query(query);
    });

    // Devuelve los contratos como respuesta
    res.json(result);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  }
};

const tableVehicles = async (req, res) => {
  const {abreviature} = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `
      SELECT
        A.ID,
        A.CODINI AS CODINI,
        A.NUMPLA AS PLACA,
        A.NROSER AS SERIE,
        C.DESCRIPCION AS MARCA,
        B.DESCRIPCION AS MODELO,
        B.DESMODGEN AS GENERICO,
        D.DESCRIP AS TERRENO
      FROM ${SCHEMA_BD}.PO_VEHICULO A
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO B
        ON A.IDMOD = B.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA C
        ON A.IDMAR = C.ID
      LEFT JOIN ${SCHEMA_BD}.PO_TERRENO D
        ON A.TP_TRABAJO = D.TPTRA
      WHERE
        NOT EXISTS (
          SELECT 1
          FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
          WHERE TAD.ID_VEH = A.ID
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ${SCHEMA_BD}.TBL_LEASING_DET TLD
          WHERE TLD.ID_VEH = A.ID
        )
        AND (A.SECOPE IS NULL OR A.SECOPE NOT IN (211, 238, 109, 162))
        ${abreviature ? "AND A.CODINI LIKE ?" : ""}
      ORDER BY A.ID DESC
    `;

      const result = await cn.query(query, abreviature ? [`${abreviature}-%`] : []);

      return result.map((row) => {
        return {
          ID:
            row.ID !== null && row.ID !== undefined
              ? row.ID.toString().trim()
              : null,
          CODINI:
            row.CODINI !== null && row.CODINI !== undefined
              ? decodeString(row.CODINI.toString().trim())
              : null,
          PLACA:
            row.PLACA !== null && row.PLACA !== undefined
              ? decodeString(row.PLACA.toString().trim())
              : null,
          SERIE:
            row.SERIE !== null && row.SERIE !== undefined
              ? decodeString(row.SERIE.toString().trim())
              : null,
          MARCA:
            row.MARCA !== null && row.MARCA !== undefined
              ? decodeString(row.MARCA.toString().trim())
              : null,
          MODELO:
            row.MODELO !== null && row.MODELO !== undefined
              ? row.MODELO.toString().trim()
              : null,
          GENERICO:
            row.GENERICO !== null && row.GENERICO !== undefined
              ? decodeString(row.GENERICO.toString().trim())
              : null,
          TERRENO:
            row.TERRENO !== null && row.TERRENO !== undefined
              ? decodeString(row.TERRENO.toString().trim())
              : null,
        };
      });
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  }
};

const contVehicles = async (req, res) => {
  try {
    const cleanedResult = await withConnection(async (cn) => {
      // Consulta los contratos asociados al cliente
      const query = `SELECT*FROM (SELECT MODELO, PRECIO_VEH FROM ${SCHEMA_BD}.TBLCONTRATO_DET) UNION (SELECT MODELO, PRECIO_VEH FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_DET B ON A.ID=B.ID_CON_CAB) ORDER BY PRECIO_VEH ASC`;
      const result = await cn.query(query);

      return result.map((row) => {
        return {
          MODELO:
            row.MODELO !== null && row.MODELO !== undefined
              ? decodeString(row.MODELO.toString().trim())
              : null,
          PRECIO_VEH:
            row.PRECIO_VEH !== null && row.PRECIO_VEH !== undefined
              ? row.PRECIO_VEH.toString().trim()
              : null,
        };
      });
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  }
};

const vehicleLeasing = async (req, res) => {
  const { idCli, nroLeasing } = req.query;
  let query = "";
  let params = [];

  try {
    const data = await withConnection(async (cn) => {
      if (nroLeasing === "all") {
        query = `SELECT DISTINCT A.CODINI, A.PLACA, C.NROSER, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING  FROM (SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID = B.ID_LEA_CAB) A LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C ON A.ID_VEH = C.ID LEFT JOIN ${SCHEMA_BD}.PO_MARCA D ON C.IDMAR = D.ID LEFT JOIN (SELECT * FROM (SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A LEFT JOIN (SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B ON A.ID=B.ID_ASIGNACION) B ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH) E ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
              WHERE (A.ID_CLIENTE = ?) AND E.VEHICULO IS NULL GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING, C.NROSER ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA`;

        params = [idCli];
      } else if (nroLeasing) {
        query = `SELECT DISTINCT A.CODINI, A.PLACA, C.NROSER, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING  FROM (SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID = B.ID_LEA_CAB) A LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C ON A.ID_VEH = C.ID LEFT JOIN ${SCHEMA_BD}.PO_MARCA D ON C.IDMAR = D.ID LEFT JOIN (SELECT * FROM (SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A LEFT JOIN (SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B ON A.ID=B.ID_ASIGNACION) B ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH) E ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
              WHERE (A.ID = ? AND A.ID_CLIENTE = ?) AND E.VEHICULO IS NULL GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING, C.NROSER ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA`;

        params = [nroLeasing, idCli];
      }

      // Consulta los detalles del contrato
      return await cn.query(query, params);
    });

    if (data.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Contrato no encontrado" });
    }

    res.json({
      success: true,
      data: data.map((row) => ({
        codini: row.CODINI,
        placa: row.PLACA,
        nroSer: row.NROSER.trim(),
        marca: row.MARCA,
        modelo: row.MODELO,
        nro_leasing: row.NRO_LEASING.trim(),
      })),
    });
  } catch (error) {
    console.error("Error al obtener los detalles del contrato:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los detalles del contrato",
    });
  }
};

const listVehiclesByContract = async (req, res) => {
  const { contratoId, clienteId } = req.query;

  if (!contratoId || !clienteId)
    return res.status(400).json({
      success: false,
      message: "Los parametros contratoId y clienteId son obligatorio",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT A.ID AS CONTRATO, A.ID_CLIENTE AS CLIENTE, CAST(NULL AS INT) AS DOCUMENTO, A.CANT_VEHI AS CANTIDAD, A.CLASE AS CLASE, B.ID AS ID_DET, B.TIPO_TERRENO AS TERRENO, B.CANTIDAD AS CANT_DET, C.DESCRIPCION AS MODELO, B.TARIFA AS TARIFA
      FROM ${SCHEMA_BD}.TBLCONTRATO_CAB A
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_DET B
      ON A.ID = B.ID_CON_CAB
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO C
      ON B.MODELO = C.ID
      WHERE A.ID_CLIENTE =? AND A.ID = ?

      UNION ALL

      SELECT A.ID_PADRE AS CONTRATO, A.ID_CLIENTE AS CLIENTE, A.ID AS DOCUMENTO, A.CANT_VEHI AS CANTIDAD, A.CLASE AS CLASE, B.ID AS ID_DET, B.TIPO_TERRENO AS TERRENO, B.CANTIDAD AS CANT_DET, C.DESCRIPCION AS MODELO, B.TARIFA AS TARIFA
      FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_DET B
      ON A.ID = B.ID_CON_CAB
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO C
      ON B.MODELO = C.ID
      WHERE A.ID_CLIENTE = ? AND A.ID_PADRE = ?
    `;

      const result = await cn.query(sql, [
        clienteId,
        contratoId,
        clienteId,
        contratoId,
      ]);

      return result.map((row) => {
        return {
          idContrato: row.CONTRATO,
          idCliente: row.CLIENTE,
          idDocumento: row.DOCUMENTO,
          cantidadVeh: row.CANTIDAD,
          clase: row.CLASE.trim(),
          idDetalle: row.ID_DET,
          terreno: row.TERRENO,
          cantVehDet: row.CANT_DET,
          modelo: row.MODELO.trim(),
          tarifa: row.TARIFA,
        };
      });
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener lista de vehiculos por contrato", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener lista de vehiculos por contrato",
    });
  }
};

const listModelGen = async (req, res) => {
  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT DISTINCT UPPER(PM.DESMODGEN) AS DESMODGEN, PM.IDMODGEN
      FROM ${SCHEMA_BD}.PO_MODELO PM
      ORDER BY DESMODGEN
    `;
      const result = await cn.query(sql);

      return result.map((row) => ({
        id: row.IDMODGEN,
        description: row.DESMODGEN.trim(),
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar modelos genericos", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al listar modelos genericos" });
  }
};

const listYearByModelGen = async (req, res) => {
  const { modelId } = req.query;

  if (!modelId)
    return res
      .status(400)
      .json({ success: false, message: "El parametro modelId es obligatorio" });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT DISTINCT CAST(SUBSTRING(TC.FECHA_FIRMA, 1, 4) AS INT) AS ANIOS FROM ${SCHEMA_BD}.TBLCONTRATO_DET td
      JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB tc
      ON TC.ID = TD.ID_CON_CAB
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO pm
      ON TD.MODELO = PM.ID
      WHERE PM.IDMODGEN = ?
      ORDER BY ANIOS
    `;
      const result = await cn.query(sql, [modelId]);

      return result.map((row) => row.ANIOS);
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar años por modelo", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al listar años por modelo" });
  }
};

// const listPlateTraceability = async (req, res) => {
//   const { id: idUser, roleId } = req.user;

//   const { idContrato, idCliente, idLeasing, tipoTerr, fromDate, toDate } = req.query;

//   try {
//     const convertResult = await withConnection(async (cn) => {
//       // const statusArray = typeof status === "string" ? status.split(",") : [];

//       const toYYYYMMDD = (dateStr) => dateStr.replaceAll("-", "");

//       let filtrosA = "";
//       let filtrosB = "";
//       let params = [];

//       let typeDoc = "";
//       let idDoc;

//       // filtro obligatorio
//       if (idCliente) {
//         filtrosA += " AND CAST(C.IDCLI AS INTEGER) = ?";
//         filtrosB += " AND CAST(C.IDCLI AS INTEGER) = ?";
//         params.push(parseInt(idCliente, 10));
//       }

//       // opcionales
//       if (idContrato) {
//         typeDoc = idContrato.split("_")[0];
//         idDoc = idContrato.split("_")[1];

//         if (typeDoc == "P") {
//           filtrosA += " AND CC.ID = ?";
//           filtrosB += " AND CC.ID = ?";
//         } else {
//           filtrosA += "";
//           filtrosB += " AND DC.ID = ?";
//         }

//         params.push(idDoc);
//       }

//       if (idLeasing) {
//         filtrosA += " AND AD.LEASING = ?";
//         filtrosB += " AND AD.LEASING = ?";
//         params.push(idLeasing);
//       }

//       if (tipoTerr) {
//         filtrosA += " AND AD.TP_TERRENO = ?";
//         filtrosB += " AND AD.TP_TERRENO = ?";
//         params.push(tipoTerr);
//       }

//       // if (status?.length) {
//       //   const conditions = [];

//       //   if (statusArray.includes("A")) {
//       //     conditions.push("(O.ID = V.ID_OPE AND V.ID_OPE != 109)");
//       //   }

//       //   if (statusArray.includes("I")) {
//       //     conditions.push(
//       //       "(O.ID != V.ID_OPE AND V.ID_OPE != 109 AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) < CURRENT_DATE)",
//       //     );
//       //   }

//       //   if (statusArray.includes("PR")) {
//       //     conditions.push(
//       //       "(O.ID != V.ID_OPE AND V.ID_OPE != 109 AND CAST(CC.ID_CLIENTE AS VARCHAR(20)) <> V.IDCLI AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) > CURRENT_DATE)",
//       //     );
//       //   }

//       //   if (statusArray.includes("PA")) {
//       //     conditions.push(
//       //       "(O.ID != V.ID_OPE AND V.ID_OPE != 109 AND CAST(CC.ID_CLIENTE AS VARCHAR(20)) = V.IDCLI AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) > CURRENT_DATE)",
//       //     );
//       //   }

//       //   if (statusArray.includes("V")) {
//       //     conditions.push("(V.ID_OPE = 109)");
//       //   }

//       //   if (conditions.length) {
//       //     const filter = ` AND (${conditions.join(" OR ")})`;

//       //     filtrosA += filter;
//       //     filtrosB += filter;
//       //   }
//       // }

//       if (fromDate && toDate) {
//         filtrosA += "AND AD.FECHA_FIN BETWEEN ? AND ?"
//         filtrosB += "AND AD.FECHA_FIN BETWEEN ? AND ?"
//         params.push(toYYYYMMDD(fromDate), toYYYYMMDD(toDate));
//       } else if (fromDate) {
//         filtrosA += "AND AD.FECHA_FIN >= ?"
//         filtrosB += "AND AD.FECHA_FIN >= ?"
//         params.push(toYYYYMMDD(fromDate));
//       } else if (toDate) {
//         filtrosA += "AND AD.FECHA_FIN <= ?"
//         filtrosB += "AND AD.FECHA_FIN <= ?"
//         params.push(toYYYYMMDD(toDate));
//       }

//       let sql = `
//     SELECT *
//     FROM (
//       SELECT
//         T.*,
//         ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
//       FROM (
//         SELECT
//           DISTINCT(AD.ID),
//           C.CLINOM AS CLIENTE,
//           CC.ID_CLIENTE AS ID_CLIENTE_CONT,
//           V.IDCLI AS ID_CLIENTE_OPE,
//           O.ID AS ID_OPE,
//           O.DESCRIPCION AS OPERACIONES,
//           V.ID_OPE AS ID_OPE_ACTUAL,
//           V.OPERACIONES AS OPERACION_ACTUAL,
//           AD.PLACA,
//           V.ANO,
//           V.COLOR,
//           AD.NROSER,
//           MA.DESCRIPCION AS MARCA,
//           MO.DESCRIPCION AS MODELO,
//           AD.TP_TERRENO AS TERRENO,
//           AD.LEASING,
//           LC.FECHA_INI AS FECHA_INI_LEASING,
//           LC.FECHA_FIN AS FECHA_FIN_LEASING,
//           CC.NRO_CONTRATO AS CONTRATO,
//           CC.DURACION AS PLAZO,
//           AD.FECHA_INI AS FECHA_ENTREGA,
//           AD.FECHA_FIN AS FECHA_DEVOLUCION,
//           DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
//           DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
//           CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
//           CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
//           AD.ARCHIVO_PDF AS ARCHIVO_PDF,
//           AD.CONDICION AS CONDICION
//         FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//         LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
//         ON AD.ID_ASIGNACION = AC.ID
//         LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
//         ON LC.NRO_LEASING = AD.LEASING
//         LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//         ON AD.ID_CONTRATO = CC.ID AND TRIM(AD.CLASE_CONTRATO) = 'P'
//         LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//         ON O.ID = AD.ID_OPE
//         LEFT JOIN (
//           SELECT DISTINCT A.IDCLI, B.CLINOM
//           FROM ${SCHEMA_BD}.PO_OPERACIONES A
//           INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE
//           WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***'
//           ORDER BY CLINOM ASC
//         ) C
//         ON O.IDCLI = C.IDCLI
//         LEFT JOIN (
//           SELECT
//             V.ID,
//             V.ANO,
//             V.COLOR,
//             O.ID AS ID_OPE,
//             O.DESCRIPCION AS OPERACIONES,
//             O.IDCLI,
//             V.IDMAR,
//             V.IDMOD
//           FROM ${SCHEMA_BD}.PO_VEHICULO V
//           LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//           ON V.SECOPE = O.ID
//         ) V
//         ON V.ID = AD.ID_VEH
//         LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
//         ON MA.ID = V.IDMAR
//         LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
//         ON MO.ID = V.IDMOD
//         WHERE AD.CLASE_CONTRATO = 'P' ${filtrosA}

//         UNION ALL

//         SELECT
//           DISTINCT(AD.ID),
//           C.CLINOM AS CLIENTE,
//           DC.ID_CLIENTE AS ID_CLIENTE_CONT,
//           V.IDCLI AS ID_CLIENTE_OPE,
//           O.ID AS ID_OPE,
//           O.DESCRIPCION AS OPERACIONES,
//           V.ID_OPE AS ID_OPE_ACTUAL,
//           V.OPERACIONES AS OPERACION_ACTUAL,
//           AD.PLACA,
//           V.ANO,
//           V.COLOR,
//           AD.NROSER,
//           MA.DESCRIPCION AS MARCA,
//           MO.DESCRIPCION AS MODELO,
//           AD.TP_TERRENO AS TERRENO,
//           AD.LEASING,
//           LC.FECHA_INI AS FECHA_INI_LEASING,
//           LC.FECHA_FIN AS FECHA_FIN_LEASING,
//           DC.NRO_DOC AS CONTRATO,
//           DC.DURACION AS PLAZO,
//           AD.FECHA_INI AS FECHA_ENTREGA,
//           AD.FECHA_FIN AS FECHA_DEVOLUCION,
//           DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
//           DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
//           CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
//           CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
//           AD.ARCHIVO_PDF AS ARCHIVO_PDF,
//           AD.CONDICION AS CONDICION
//         FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//         LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
//         ON AD.ID_ASIGNACION = AC.ID
//         LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
//         ON LC.NRO_LEASING = AD.LEASING
//         LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
//         ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
//         LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//         ON DC.ID_PADRE = CC.ID
//         LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//         ON O.ID = AD.ID_OPE
//         LEFT JOIN (
//           SELECT DISTINCT A.IDCLI, B.CLINOM
//           FROM ${SCHEMA_BD}.PO_OPERACIONES A
//           INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE
//           WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***'
//           ORDER BY CLINOM ASC
//         ) C
//         ON O.IDCLI = C.IDCLI
//         LEFT JOIN (
//           SELECT
//             V.ID,
//             V.ANO,
//             V.COLOR,
//             O.ID AS ID_OPE,
//             O.DESCRIPCION AS OPERACIONES,
//             O.IDCLI,
//             V.IDMAR,
//             V.IDMOD
//           FROM ${SCHEMA_BD}.PO_VEHICULO V
//           LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//           ON V.SECOPE = O.ID
//         ) V
//         ON V.ID = AD.ID_VEH
//         LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
//         ON MA.ID = V.IDMAR
//         LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
//         ON MO.ID = V.IDMOD
//         WHERE AD.CLASE_CONTRATO = 'H' ${filtrosB}
//         ) T
//       ) X
//       WHERE RN = 1
//     `;

//       let sqlDoc = `
//     SELECT *
//     FROM (
//       SELECT
//         T.*,
//         ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
//       FROM (
//         SELECT
//           DISTINCT(AD.ID),
//           C.CLINOM AS CLIENTE,
//           DC.ID_CLIENTE AS ID_CLIENTE_CONT,
//           V.IDCLI AS ID_CLIENTE_OPE,
//           O.ID AS ID_OPE,
//           O.DESCRIPCION AS OPERACIONES,
//           V.ID_OPE AS ID_OPE_ACTUAL,
//           V.OPERACIONES AS OPERACION_ACTUAL,
//           AD.PLACA,
//           V.ANO,
//           V.COLOR,
//           AD.NROSER,
//           MA.DESCRIPCION AS MARCA,
//           MO.DESCRIPCION AS MODELO,
//           AD.TP_TERRENO AS TERRENO,
//           AD.LEASING,
//           LC.FECHA_INI AS FECHA_INI_LEASING,
//           LC.FECHA_FIN AS FECHA_FIN_LEASING,
//           DC.NRO_DOC AS CONTRATO,
//           DC.DURACION AS PLAZO,
//           AD.FECHA_INI AS FECHA_ENTREGA,
//           AD.FECHA_FIN AS FECHA_DEVOLUCION,
//           DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
//           DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
//           CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
//           CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
//           AD.ARCHIVO_PDF AS ARCHIVO_PDF,
//           AD.CONDICION AS CONDICION
//         FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//         LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
//         ON AD.ID_ASIGNACION = AC.ID
//         LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
//         ON LC.NRO_LEASING = AD.LEASING
//         LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
//         ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
//         LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//         ON DC.ID_PADRE = CC.ID
//         LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//         ON O.ID = AD.ID_OPE
//         LEFT JOIN (
//           SELECT DISTINCT A.IDCLI, B.CLINOM
//           FROM ${SCHEMA_BD}.PO_OPERACIONES A
//           INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE
//           WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***'
//           ORDER BY CLINOM ASC
//         ) C
//         ON O.IDCLI = C.IDCLI
//         LEFT JOIN (
//           SELECT
//             V.ID,
//             V.ANO,
//             V.COLOR,
//             O.ID AS ID_OPE,
//             O.DESCRIPCION AS OPERACIONES,
//             O.IDCLI,
//             V.IDMAR,
//             V.IDMOD
//           FROM ${SCHEMA_BD}.PO_VEHICULO V
//           LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//           ON V.SECOPE = O.ID
//         ) V
//         ON V.ID = AD.ID_VEH
//         LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
//         ON MA.ID = V.IDMAR
//         LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
//         ON MO.ID = V.IDMOD
//         WHERE AD.CLASE_CONTRATO = 'H' ${filtrosB}
//         ) T
//       ) X
//       WHERE RN = 1
//     `;

//       if (roleId == 3) {
//         filtrosA += ` AND C.ID_USU = ${idUser}`;
//         filtrosB += ` AND C.ID_USU = ${idUser}`;

//         sql = `
//         SELECT *
//         FROM (
//           SELECT
//             T.*,
//             ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
//           FROM (
//             SELECT
//               DISTINCT(AD.ID),
//               C.CLINOM AS CLIENTE,
//               CC.ID_CLIENTE AS ID_CLIENTE_CONT,
//               V.IDCLI AS ID_CLIENTE_OPE,
//               O.ID AS ID_OPE,
//               O.DESCRIPCION AS OPERACIONES,
//               V.ID_OPE AS ID_OPE_ACTUAL,
//               V.OPERACIONES AS OPERACION_ACTUAL,
//               AD.PLACA,
//               V.ANO,
//               V.COLOR,
//               AD.NROSER,
//               MA.DESCRIPCION AS MARCA,
//               MO.DESCRIPCION AS MODELO,
//               AD.TP_TERRENO AS TERRENO,
//               AD.LEASING,
//               LC.FECHA_INI AS FECHA_INI_LEASING,
//               LC.FECHA_FIN AS FECHA_FIN_LEASING,
//               CC.NRO_CONTRATO AS CONTRATO,
//               CC.DURACION AS PLAZO,
//               AD.FECHA_INI AS FECHA_ENTREGA,
//               AD.FECHA_FIN AS FECHA_DEVOLUCION,
//               DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
//               DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
//               CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
//               CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
//               AD.ARCHIVO_PDF AS ARCHIVO_PDF,
//               AD.CONDICION AS CONDICION
//             FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//             LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
//             ON AD.ID_ASIGNACION = AC.ID
//             LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
//             ON LC.NRO_LEASING = AD.LEASING
//             LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//             ON AD.ID_CONTRATO = CC.ID AND TRIM(AD.CLASE_CONTRATO) = 'P'
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//             ON O.ID = AD.ID_OPE
//             LEFT JOIN (
//               SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
//               FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
//               LEFT JOIN (
//                 SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
//                 FROM ${SCHEMA_BD}.PO_OPERACIONES A
//                 INNER JOIN ${SCHEMA_BD}.TCLIE B
//                 ON A.IDCLI = B.CLICVE
//                 WHERE A.ID <> 86
//                 AND B.CLINOM <> '*** ANULADO ***'
//               )PO
//               ON MOXU.IDOPERACION = PO.ID
//               LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
//               ON MOXU.CH_CODI_USUARIO = TUG.USU
//               LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
//               ON TUG.ID_RL = TRG.ID
//               WHERE TUG.USU IS NOT NULL
//             ) C
//             ON O.IDCLI = C.IDCLI AND C.ID_OPERACION = O.ID
//             LEFT JOIN (
//               SELECT
//                 V.ID,
//                 V.ANO,
//                 V.COLOR,
//                 O.ID AS ID_OPE,
//                 O.DESCRIPCION AS OPERACIONES,
//                 O.IDCLI,
//                 V.IDMAR,
//                 V.IDMOD
//               FROM ${SCHEMA_BD}.PO_VEHICULO V
//               LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//               ON V.SECOPE = O.ID
//             ) V
//             ON V.ID = AD.ID_VEH
//             LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
//             ON MA.ID = V.IDMAR
//             LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
//             ON MO.ID = V.IDMOD
//             WHERE AD.CLASE_CONTRATO = 'P' ${filtrosA}

//             UNION ALL

//             SELECT
//               DISTINCT(AD.ID),
//               C.CLINOM AS CLIENTE,
//               DC.ID_CLIENTE AS ID_CLIENTE_CONT,
//               V.IDCLI AS ID_CLIENTE_OPE,
//               O.ID AS ID_OPE,
//               O.DESCRIPCION AS OPERACIONES,
//               V.ID_OPE AS ID_OPE_ACTUAL,
//               V.OPERACIONES AS OPERACION_ACTUAL,
//               AD.PLACA,
//               V.ANO,
//               V.COLOR,
//               AD.NROSER,
//               MA.DESCRIPCION AS MARCA,
//               MO.DESCRIPCION AS MODELO,
//               AD.TP_TERRENO AS TERRENO,
//               AD.LEASING,
//               LC.FECHA_INI AS FECHA_INI_LEASING,
//               LC.FECHA_FIN AS FECHA_FIN_LEASING,
//               DC.NRO_DOC AS CONTRATO,
//               DC.DURACION AS PLAZO,
//               AD.FECHA_INI AS FECHA_ENTREGA,
//               AD.FECHA_FIN AS FECHA_DEVOLUCION,
//               DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
//               DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
//               CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
//               CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
//               AD.ARCHIVO_PDF AS ARCHIVO_PDF,
//               AD.CONDICION AS CONDICION
//             FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//             LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
//             ON AD.ID_ASIGNACION = AC.ID
//             LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
//             ON LC.NRO_LEASING = AD.LEASING
//             LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
//             ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
//             LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//             ON DC.ID_PADRE = CC.ID
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//             ON O.ID = AD.ID_OPE
//             LEFT JOIN (
//               SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
//               FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
//               LEFT JOIN (
//                 SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
//                 FROM ${SCHEMA_BD}.PO_OPERACIONES A
//                 INNER JOIN ${SCHEMA_BD}.TCLIE B
//                 ON A.IDCLI = B.CLICVE
//                 WHERE A.ID <> 86
//                 AND B.CLINOM <> '*** ANULADO ***'
//               )PO
//               ON MOXU.IDOPERACION = PO.ID
//               LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
//               ON MOXU.CH_CODI_USUARIO = TUG.USU
//               LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
//               ON TUG.ID_RL = TRG.ID
//               WHERE TUG.USU IS NOT NULL
//             ) C
//             ON O.IDCLI = C.IDCLI AND C.ID_OPERACION = O.ID
//             LEFT JOIN (
//               SELECT
//                 V.ID,
//                 V.ANO,
//                 V.COLOR,
//                 O.ID AS ID_OPE,
//                 O.DESCRIPCION AS OPERACIONES,
//                 O.IDCLI,
//                 V.IDMAR,
//                 V.IDMOD
//               FROM ${SCHEMA_BD}.PO_VEHICULO V
//               LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//               ON V.SECOPE = O.ID
//             ) V
//             ON V.ID = AD.ID_VEH
//             LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
//             ON MA.ID = V.IDMAR
//             LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
//             ON MO.ID = V.IDMOD
//             WHERE AD.CLASE_CONTRATO = 'H' ${filtrosB}
//             ) T
//           ) X
//           WHERE RN = 1
//       `;

//         sqlDoc = `
//         SELECT *
//         FROM (
//           SELECT
//             T.*,
//             ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
//           FROM (
//             SELECT
//               DISTINCT(AD.ID),
//               C.CLINOM AS CLIENTE,
//               DC.ID_CLIENTE AS ID_CLIENTE_CONT,
//               V.IDCLI AS ID_CLIENTE_OPE,
//               O.ID AS ID_OPE,
//               O.DESCRIPCION AS OPERACIONES,
//               V.ID_OPE AS ID_OPE_ACTUAL,
//               V.OPERACIONES AS OPERACION_ACTUAL,
//               AD.PLACA,
//               V.ANO,
//               V.COLOR,
//               AD.NROSER,
//               MA.DESCRIPCION AS MARCA,
//               MO.DESCRIPCION AS MODELO,
//               AD.TP_TERRENO AS TERRENO,
//               AD.LEASING,
//               LC.FECHA_INI AS FECHA_INI_LEASING,
//               LC.FECHA_FIN AS FECHA_FIN_LEASING,
//               DC.NRO_DOC AS CONTRATO,
//               DC.DURACION AS PLAZO,
//               AD.FECHA_INI AS FECHA_ENTREGA,
//               AD.FECHA_FIN AS FECHA_DEVOLUCION,
//               DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) AS FECHA_INI_CONTRATO,
//               DATE(SUBSTR(DC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(DC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(DC.FECHA_FIRMA, 7, 2)) + CAST(DC.DURACION AS INTEGER) MONTHS AS FECHA_FIN_CONTRATO,
//               CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
//               CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
//               AD.ARCHIVO_PDF AS ARCHIVO_PDF,
//               AD.CONDICION AS CONDICION
//             FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//             LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
//             ON AD.ID_ASIGNACION = AC.ID
//             LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
//             ON LC.NRO_LEASING = AD.LEASING
//             LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
//             ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
//             LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//             ON DC.ID_PADRE = CC.ID
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//             ON O.ID = AD.ID_OPE
//             LEFT JOIN (
//               SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO_ID AS ID_OPERACION
//               FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
//               LEFT JOIN (
//                 SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
//                 FROM ${SCHEMA_BD}.PO_OPERACIONES A
//                 INNER JOIN ${SCHEMA_BD}.TCLIE B
//                 ON A.IDCLI = B.CLICVE
//                 WHERE A.ID <> 86
//                 AND B.CLINOM <> '*** ANULADO ***'
//               )PO
//               ON MOXU.IDOPERACION = PO.ID
//               LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
//               ON MOXU.CH_CODI_USUARIO = TUG.USU
//               LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
//               ON TUG.ID_RL = TRG.ID
//               WHERE TUG.USU IS NOT NULL
//             ) C
//             ON O.IDCLI = C.IDCLI AND C.ID_OPERACION = O.ID
//             LEFT JOIN (
//               SELECT
//                 V.ID,
//                 V.ANO,
//                 V.COLOR,
//                 O.ID AS ID_OPE,
//                 O.DESCRIPCION AS OPERACIONES,
//                 O.IDCLI,
//                 V.IDMAR,
//                 V.IDMOD
//               FROM ${SCHEMA_BD}.PO_VEHICULO V
//               LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
//               ON V.SECOPE = O.ID
//             ) V
//             ON V.ID = AD.ID_VEH
//             LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
//             ON MA.ID = V.IDMAR
//             LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
//             ON MO.ID = V.IDMOD
//             WHERE AD.CLASE_CONTRATO = 'H' ${filtrosB}
//             ) T
//           ) X
//           WHERE RN = 1
//       `;
//       }

//       const mapRow = (row) => ({
//         idAssing: row.ID,
//         cliente: row.CLIENTE ? row.CLIENTE.trim() : "Sin cliente",
//         idCliCont: row.ID_CLIENTE_CONT,
//         idCliOpe: row.ID_CLIENTE_OPE.trim(),
//         idOpe: row.ID_OPE,
//         operacion: row.OPERACIONES ? row.OPERACIONES.trim() : "Sin operacion",
//         idOpeActual: row.ID_OPE_ACTUAL,
//         opeActual: row.OPERACION_ACTUAL
//           ? row.OPERACION_ACTUAL.trim()
//           : "Sin operacion",
//         placa: row.PLACA ? row.PLACA.trim() : "Sin placa",
//         año: row.ANO,
//         color: row.COLOR ? row.COLOR.trim() : "Sin color",
//         marca: row.MARCA ? row.MARCA.trim() : "Sin marca",
//         modelo: row.MODELO ? row.MODELO.trim() : "Sin modelo",
//         nroSer: row.NROSER ? row.NROSER.trim() : "Sin serie",
//         terreno: row.TERRENO,
//         leasing: row.LEASING ? row.LEASING.trim() : "Sin leasing",
//         fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
//         fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
//         contrato: row.CONTRATO ? row.CONTRATO.trim() : "Sin contrato",
//         plazo: row.PLAZO,
//         fechaIni: row.FECHA_ENTREGA
//           ? convertirFecha(row.FECHA_ENTREGA.trim())
//           : "Sin fecha",
//         fechaFin: row.FECHA_DEVOLUCION
//           ? convertirFecha(row.FECHA_DEVOLUCION.trim())
//           : "Sin fecha",
//         fechaIniCon: row.FECHA_INI_CONTRATO,
//         fechaFinCon: row.FECHA_FIN_CONTRATO,
//         tarifa: row.TARIFA,
//         moneda: row.MONEDA,
//         archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
//         condicion: row.CONDICION ? row.CONDICION : "",
//       });

//       if (typeDoc == "H") {
//         const result = await cn.query(sqlDoc, [...params]);
//         return result.map(mapRow);
//       } else if (typeDoc == "P") {
//         const result = await cn.query(sql, [...params, ...params]);
//         return result.map(mapRow);
//       } else {
//         const result = await cn.query(sql, [...params, ...params]);
//         return result.map(mapRow);
//       }
//     });

//     return res.status(200).json(convertResult);
//   } catch (error) {
//     console.error("Error al listar asignaciones de un contrato", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error al listar asignaciones de un contrato",
//     });
//   }
// };

const listPlateTraceability = async (req, res) => {
  const { id: idUser, roleId } = req.user;
  const { idContrato, idCliente, idLeasing, tipoTerr, fromDate, toDate } = req.query;

  try {
    const convertResult = await withConnection(async (cn) => {
      const toYYYYMMDD = (dateStr) => dateStr.replaceAll("-", "");

      const conditions = [];
      const params = [];

      // Cliente (obligatorio)
      if (idCliente) {
        conditions.push("CAST(C.IDCLI AS INTEGER) = ?");
        params.push(parseInt(idCliente, 10));
      }

      // Contrato específico (padre 'P' o documento 'H')
      if (idContrato) {
        const [tipo, idDoc] = idContrato.split("_");
        conditions.push("TRIM(AD.CLASE_CONTRATO) = ? AND AD.ID_CONTRATO = ?");
        params.push(tipo, idDoc);
      }

      if (idLeasing) {
        conditions.push("AD.LEASING = ?");
        params.push(idLeasing);
      }

      if (tipoTerr) {
        conditions.push("AD.TP_TERRENO = ?");
        params.push(tipoTerr);
      }

      if (fromDate && toDate) {
        conditions.push("AD.FECHA_FIN BETWEEN ? AND ?");
        params.push(toYYYYMMDD(fromDate), toYYYYMMDD(toDate));
      } else if (fromDate) {
        conditions.push("AD.FECHA_FIN >= ?");
        params.push(toYYYYMMDD(fromDate));
      } else if (toDate) {
        conditions.push("AD.FECHA_FIN <= ?");
        params.push(toYYYYMMDD(toDate));
      }

      // JOIN de cliente: cambia según el rol (flota restringida por usuario)
      let joinCliente;
      if (roleId == 3) {
        joinCliente = `
          LEFT JOIN (
            SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
            FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
            LEFT JOIN (
              SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
              FROM ${SCHEMA_BD}.PO_OPERACIONES A
              INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI = B.CLICVE
              WHERE A.ID <> 86 AND B.CLINOM <> '*** ANULADO ***'
            ) PO ON MOXU.IDOPERACION = PO.ID
            LEFT JOIN ${SCHEMA_BD}.T_US_GC tug ON MOXU.CH_CODI_USUARIO = TUG.USU
            LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg ON TUG.ID_RL = TRG.ID
            WHERE TUG.USU IS NOT NULL
          ) C
          ON O.IDCLI = C.IDCLI AND C.ID_OPERACION = O.ID
        `;
        conditions.push("C.ID_USU = ?");
        params.push(idUser);
      } else {
        joinCliente = `
          LEFT JOIN (
            SELECT DISTINCT A.IDCLI, B.CLINOM
            FROM ${SCHEMA_BD}.PO_OPERACIONES A
            INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI = B.CLICVE
            WHERE A.ID <> 86 AND B.CLINOM <> '*** ANULADO ***'
          ) C
          ON O.IDCLI = C.IDCLI
        `;
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const sql = `
        SELECT *
        FROM (
          SELECT
            BASE.*,
            CASE WHEN BASE.FECHA_FIRMA_EFECTIVA IS NULL THEN NULL
              ELSE DATE(
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 1, 4) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 5, 2) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 7, 2)
              )
            END AS FECHA_INI_CONTRATO,
            CASE WHEN BASE.FECHA_FIRMA_EFECTIVA IS NULL OR BASE.PLAZO IS NULL THEN NULL
              ELSE DATE(
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 1, 4) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 5, 2) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 7, 2)
              ) + CAST(BASE.PLAZO AS INTEGER) MONTHS
            END AS FECHA_FIN_CONTRATO,
            ROW_NUMBER() OVER(PARTITION BY BASE.ID ORDER BY BASE.ID) AS RN
          FROM (
            SELECT
              DISTINCT(AD.ID),
              C.CLINOM AS CLIENTE,
              COALESCE(DC.ID_CLIENTE, CC.ID_CLIENTE) AS ID_CLIENTE_CONT,
              V.IDCLI AS ID_CLIENTE_OPE,
              O.ID AS ID_OPE,
              O.DESCRIPCION AS OPERACIONES,
              V.ID_OPE AS ID_OPE_ACTUAL,
              V.OPERACIONES AS OPERACION_ACTUAL,
              AD.PLACA,
              V.ANO,
              V.COLOR,
              AD.NROSER,
              MA.DESCRIPCION AS MARCA,
              MO.DESCRIPCION AS MODELO,
              AD.TP_TERRENO AS TERRENO,
              AD.LEASING,
              LC.FECHA_INI AS FECHA_INI_LEASING,
              LC.FECHA_FIN AS FECHA_FIN_LEASING,
              COALESCE(DC.NRO_DOC, CC.NRO_CONTRATO) AS CONTRATO,
              COALESCE(DC.DURACION, CC.DURACION) AS PLAZO,
              AD.FECHA_INI AS FECHA_ENTREGA,
              AD.FECHA_FIN AS FECHA_DEVOLUCION,
              COALESCE(DC.FECHA_FIRMA, CC.FECHA_FIRMA) AS FECHA_FIRMA_EFECTIVA,
              CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
              CASE 
                WHEN CC.MONEDA IS NULL THEN NULL
                WHEN CC.MONEDA = '1' THEN 'DÓLAR' 
                ELSE 'SOLES' 
              END AS MONEDA,
              AD.ARCHIVO_PDF AS ARCHIVO_PDF,
              AD.CONDICION AS CONDICION
            FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
            LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
              ON AD.ID_ASIGNACION = AC.ID
            LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
              ON LC.NRO_LEASING = AD.LEASING
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
              ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
            LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
              ON (TRIM(AD.CLASE_CONTRATO) = 'P' AND AD.ID_CONTRATO = CC.ID)
              OR (TRIM(AD.CLASE_CONTRATO) = 'H' AND DC.ID_PADRE = CC.ID)
            LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
              ON O.ID = AD.ID_OPE
            ${joinCliente}
            LEFT JOIN (
              SELECT
                V.ID,
                V.ANO,
                V.COLOR,
                O.ID AS ID_OPE,
                O.DESCRIPCION AS OPERACIONES,
                O.IDCLI,
                V.IDMAR,
                V.IDMOD
              FROM ${SCHEMA_BD}.PO_VEHICULO V
              LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O ON V.SECOPE = O.ID
            ) V ON V.ID = AD.ID_VEH
            LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA ON MA.ID = V.IDMAR
            LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO ON MO.ID = V.IDMOD
            ${whereClause}
          ) BASE
        ) X
        WHERE RN = 1
      `;

      const mapRow = (row) => ({
        idAssing: row.ID,
        cliente: row.CLIENTE ? row.CLIENTE.trim() : "Sin cliente",
        idCliCont: row.ID_CLIENTE_CONT,
        idCliOpe: row.ID_CLIENTE_OPE ? row.ID_CLIENTE_OPE.trim() : "Sin cliente",
        idOpe: row.ID_OPE,
        operacion: row.OPERACIONES ? row.OPERACIONES.trim() : "Sin operacion",
        idOpeActual: row.ID_OPE_ACTUAL,
        opeActual: row.OPERACION_ACTUAL
          ? row.OPERACION_ACTUAL.trim()
          : "Sin operacion",
        placa: row.PLACA ? row.PLACA.trim() : "Sin placa",
        año: row.ANO,
        color: row.COLOR ? row.COLOR.trim() : "Sin color",
        marca: row.MARCA ? row.MARCA.trim() : "Sin marca",
        modelo: row.MODELO ? row.MODELO.trim() : "Sin modelo",
        nroSer: row.NROSER ? row.NROSER.trim() : "Sin serie",
        terreno: row.TERRENO,
        leasing: row.LEASING ? row.LEASING.trim() : "Sin leasing",
        fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
        fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
        contrato: row.CONTRATO ? row.CONTRATO.trim() : "Sin contrato",
        plazo: row.PLAZO ?? null,
        fechaIni: row.FECHA_ENTREGA
          ? convertirFecha(row.FECHA_ENTREGA.trim())
          : "Sin fecha",
        fechaFin: row.FECHA_DEVOLUCION
          ? convertirFecha(row.FECHA_DEVOLUCION.trim())
          : "Sin fecha",
        fechaIniCon: row.FECHA_INI_CONTRATO,
        fechaFinCon: row.FECHA_FIN_CONTRATO,
        tarifa: row.TARIFA ?? null,
        moneda: row.MONEDA,
        archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
        condicion: row.CONDICION ? row.CONDICION : "",
      });

      const result = await cn.query(sql, params);
      return result.map(mapRow);
    });

    return res.status(200).json(convertResult);
  } catch (error) {
    console.error("Error al listar asignaciones de un contrato", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar asignaciones de un contrato",
    });
  }
};

const listVehicleTraceability = async (req, res) => {
  const { id: idUser, roleId } = req.user;
  const { idCliente } = req.query;

  if (!idCliente) {
    return res.status(400).json({
      success: false,
      message: "El parametro idCliente es obligatorio",
    });
  }

  try {
    const convertResult = await withConnection(async (cn) => {
      // Filtro adicional de usuario, solo si aplica por rol
      let filtroUsuarioVeh = "";
      const paramsVehiculos = [idCliente, idCliente, idCliente];

      if (roleId == 3) {
        filtroUsuarioVeh = `
          AND EXISTS (
            SELECT 1
            FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
            LEFT JOIN ${SCHEMA_BD}.T_US_GC tug ON moxu.CH_CODI_USUARIO = tug.USU
            WHERE moxu.IDOPERACION = PO.ID
            AND tug.ID = ?
          )
        `;
        paramsVehiculos.push(idUser);
      }

      // Conjunto de vehículos que pasaron por el cliente (actuales + históricos vía reasignación)
      const sqlVehiculos = `
        SELECT DISTINCT VEHICULO FROM (
          SELECT AD.ID_VEH AS VEHICULO
          FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
              ON AD.ID_OPE = PO.ID
          WHERE TRIM(PO.IDCLI) = ?
          ${filtroUsuarioVeh}

          UNION

          SELECT AD.ID_VEH AS VEHICULO
          FROM ${SCHEMA_BD}.T_GC_RE_CAB RC
          LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
              ON RC.ID_ASG_DET = AD.ID
          LEFT JOIN ${SCHEMA_BD}.T_GC_RE_DET_A DA
              ON DA.ID_CAB = RC.ID
          LEFT JOIN ${SCHEMA_BD}.T_GC_RE_DET_B DB
              ON DB.ID_CAB = RC.ID
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE_A
              ON DA.ID_OPE = OPE_A.ID
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE_B
              ON DB.ID_OPE = OPE_B.ID
          WHERE TRIM(OPE_A.IDCLI) = ?
          OR TRIM(OPE_B.IDCLI) = ?
        ) T
      `;

      // JOIN de cliente para mostrar el nombre — normal o restringido por usuario
      let joinCliente;
      const params = [...paramsVehiculos];

      if (roleId == 3) {
        joinCliente = `
          LEFT JOIN (
            SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
            FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
            LEFT JOIN (
              SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
              FROM ${SCHEMA_BD}.PO_OPERACIONES A
              INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI = B.CLICVE
              WHERE A.ID <> 86 AND B.CLINOM <> '*** ANULADO ***'
            ) PO ON MOXU.IDOPERACION = PO.ID
            LEFT JOIN ${SCHEMA_BD}.T_US_GC tug ON MOXU.CH_CODI_USUARIO = TUG.USU
            LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg ON TUG.ID_RL = TRG.ID
            WHERE TUG.USU IS NOT NULL
          ) C
          ON O.IDCLI = C.IDCLI AND C.ID_OPERACION = O.ID
        `;
      } else {
        joinCliente = `
          LEFT JOIN (
            SELECT DISTINCT A.IDCLI, B.CLINOM
            FROM ${SCHEMA_BD}.PO_OPERACIONES A
            INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI = B.CLICVE
            WHERE A.ID <> 86 AND B.CLINOM <> '*** ANULADO ***'
          ) C
          ON O.IDCLI = C.IDCLI
        `;
      }

      // Misma base unificada de listAssingByContract/listPlateTraceability,
      // pero filtrando por el conjunto de vehículos (sin filtrar por cliente actual)
      const sql = `
        SELECT *
        FROM (
          SELECT
            BASE.*,
            CASE WHEN BASE.FECHA_FIRMA_EFECTIVA IS NULL THEN NULL
              ELSE DATE(
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 1, 4) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 5, 2) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 7, 2)
              )
            END AS FECHA_INI_CONTRATO,
            CASE WHEN BASE.FECHA_FIRMA_EFECTIVA IS NULL OR BASE.PLAZO IS NULL THEN NULL
              ELSE DATE(
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 1, 4) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 5, 2) || '-' ||
                SUBSTR(BASE.FECHA_FIRMA_EFECTIVA, 7, 2)
              ) + CAST(BASE.PLAZO AS INTEGER) MONTHS
            END AS FECHA_FIN_CONTRATO,
            ROW_NUMBER() OVER(PARTITION BY BASE.ID ORDER BY BASE.ID) AS RN
          FROM (
            SELECT
              DISTINCT(AD.ID),
              C.CLINOM AS CLIENTE,
              COALESCE(DC.ID_CLIENTE, CC.ID_CLIENTE) AS ID_CLIENTE_CONT,
              V.IDCLI AS ID_CLIENTE_OPE,
              O.ID AS ID_OPE,
              O.DESCRIPCION AS OPERACIONES,
              V.ID_OPE AS ID_OPE_ACTUAL,
              V.OPERACIONES AS OPERACION_ACTUAL,
              AD.PLACA,
              V.ANO,
              V.COLOR,
              AD.NROSER,
              MA.DESCRIPCION AS MARCA,
              MO.DESCRIPCION AS MODELO,
              AD.TP_TERRENO AS TERRENO,
              AD.LEASING,
              LC.FECHA_INI AS FECHA_INI_LEASING,
              LC.FECHA_FIN AS FECHA_FIN_LEASING,
              COALESCE(DC.NRO_DOC, CC.NRO_CONTRATO) AS CONTRATO,
              COALESCE(DC.DURACION, CC.DURACION) AS PLAZO,
              AD.FECHA_INI AS FECHA_ENTREGA,
              AD.FECHA_FIN AS FECHA_DEVOLUCION,
              COALESCE(DC.FECHA_FIRMA, CC.FECHA_FIRMA) AS FECHA_FIRMA_EFECTIVA,
              CAST(AD.TARIFA AS DECIMAL(10, 2)) AS TARIFA,
              CASE 
                WHEN CC.MONEDA IS NULL THEN NULL
                WHEN CC.MONEDA = '1' THEN 'DÓLAR' 
                ELSE 'SOLES' 
              END AS MONEDA,
              AD.ARCHIVO_PDF AS ARCHIVO_PDF,
              AD.CONDICION AS CONDICION
            FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
            LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB AC
              ON AD.ID_ASIGNACION = AC.ID
            LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
              ON LC.NRO_LEASING = AD.LEASING
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
              ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
            LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
              ON (TRIM(AD.CLASE_CONTRATO) = 'P' AND AD.ID_CONTRATO = CC.ID)
              OR (TRIM(AD.CLASE_CONTRATO) = 'H' AND DC.ID_PADRE = CC.ID)
            LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
              ON O.ID = AD.ID_OPE
            ${joinCliente}
            LEFT JOIN (
              SELECT
                V.ID,
                V.ANO,
                V.COLOR,
                O.ID AS ID_OPE,
                O.DESCRIPCION AS OPERACIONES,
                O.IDCLI,
                V.IDMAR,
                V.IDMOD
              FROM ${SCHEMA_BD}.PO_VEHICULO V
              LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O ON V.SECOPE = O.ID
            ) V ON V.ID = AD.ID_VEH
            LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA ON MA.ID = V.IDMAR
            LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO ON MO.ID = V.IDMOD
            WHERE AD.ID_VEH IN (${sqlVehiculos})
          ) BASE
        ) X
        WHERE RN = 1
      `;

      const mapRow = (row) => ({
        idAssing: row.ID,
        cliente: row.CLIENTE ? row.CLIENTE.trim() : "Sin cliente",
        idCliCont: row.ID_CLIENTE_CONT,
        idCliOpe: row.ID_CLIENTE_OPE ? row.ID_CLIENTE_OPE.trim() : "Sin cliente",
        idOpe: row.ID_OPE,
        operacion: row.OPERACIONES ? row.OPERACIONES.trim() : "Sin operacion",
        idOpeActual: row.ID_OPE_ACTUAL,
        opeActual: row.OPERACION_ACTUAL
          ? row.OPERACION_ACTUAL.trim()
          : "Sin operacion",
        placa: row.PLACA ? row.PLACA.trim() : "Sin placa",
        año: row.ANO,
        color: row.COLOR ? row.COLOR.trim() : "Sin color",
        marca: row.MARCA ? row.MARCA.trim() : "Sin marca",
        modelo: row.MODELO ? row.MODELO.trim() : "Sin modelo",
        nroSer: row.NROSER ? row.NROSER.trim() : "Sin serie",
        terreno: row.TERRENO,
        leasing: row.LEASING ? row.LEASING.trim() : "Sin leasing",
        fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
        fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
        contrato: row.CONTRATO ? row.CONTRATO.trim() : "Sin contrato",
        plazo: row.PLAZO ?? null,
        fechaIni: row.FECHA_ENTREGA
          ? convertirFecha(row.FECHA_ENTREGA.trim())
          : "Sin fecha",
        fechaFin: row.FECHA_DEVOLUCION
          ? convertirFecha(row.FECHA_DEVOLUCION.trim())
          : "Sin fecha",
        fechaIniCon: row.FECHA_INI_CONTRATO,
        fechaFinCon: row.FECHA_FIN_CONTRATO,
        tarifa: row.TARIFA ?? null,
        moneda: row.MONEDA,
        archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
        condicion: row.CONDICION ? row.CONDICION : "",
      });

      const result = await cn.query(sql, params);
      return result.map(mapRow);
    });

    return res.status(200).json(convertResult);
  } catch (error) {
    console.error("Error al listar trazabilidad de vehículos", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar trazabilidad de vehículos",
    });
  }
};

const listPlateHistory = async (req, res) => {
  const { placa } = req.query;
 
  if (!placa) {
    return res.status(400).json({
      success: false,
      message: "El parametro placa es obligatorio",
    });
  }
 
  try {
    const result = await withConnection(async (cn) => {
      // -----------------------------------------------------------------
      // PASO 1: ID de asignacion a partir de la placa (el mas reciente)
      // -----------------------------------------------------------------
      const sqlAsignacion = `
        SELECT ID AS ID_ASIGNACION
        FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET
        WHERE TRIM(PLACA) = TRIM(CAST(? AS CHAR(50)))
        ORDER BY ID DESC
        FETCH FIRST 1 ROW ONLY
      `;
      const [asignacion] = await cn.query(sqlAsignacion, [placa]);
 
      if (!asignacion) {
        return { placa, idAsignacion: null, historial: [] };
      }
 
      const idAsignacion = asignacion.ID_ASIGNACION;
 
      // -----------------------------------------------------------------
      // PASO 2: ¿esta asignacion tiene movimientos de reasignacion?
      // -----------------------------------------------------------------
      const sqlCabeceras = `
        SELECT ID AS ID_CAB
        FROM ${SCHEMA_BD}.T_GC_RE_CAB
        WHERE ID_ASG_DET = ?
      `;
      const cabeceras = await cn.query(sqlCabeceras, [idAsignacion]);
 
      let eventos = [];
      let documentos = [];
 
      if (cabeceras.length > 0) {
        // ---------------------------------------------------------------
        // CASO CON reasignaciones: PASO 3 (anterior + nuevo + extra) + PASO 4
        // ---------------------------------------------------------------
        const sqlEventos = `
          SELECT
              cab.ID                                   AS ID_CAB,
              CAST(TRIM(cab.FRE) AS CHAR(8))          AS FECHA_REASIGNACION,
              TRIM(cab.TRE)                            AS TIPO_REASIGNACION,
 
              ta.CLICVE                                AS ANT_COD_CLIENTE,
              TRIM(ta.CLINOM)                           AS ANT_CLIENTE,
              poa.ID                                    AS ANT_ID_OPERACION,
              TRIM(poa.DESCRIPCION)                     AS ANT_OPERACION,
              CAST(TRIM(da.FEN) AS CHAR(8))            AS ANT_FECHA_ENTREGA,
              CAST(TRIM(da.FDV) AS CHAR(8))            AS ANT_FECHA_DEVOLUCION,
              CAST(TRIM(da.FTR) AS CHAR(8))            AS ANT_FECHA_TRASLADO,
 
              tn.CLICVE                                AS NUE_COD_CLIENTE,
              TRIM(tn.CLINOM)                           AS NUE_CLIENTE,
              pon.ID                                    AS NUE_ID_OPERACION,
              TRIM(pon.DESCRIPCION)                     AS NUE_OPERACION,
              CAST(TRIM(db.FEN) AS CHAR(8))            AS NUE_FECHA_ENTREGA,
              CAST(TRIM(db.FDV) AS CHAR(8))            AS NUE_FECHA_DEVOLUCION,
              CAST(TRIM(db.FTR) AS CHAR(8))            AS NUE_FECHA_TRASLADO,
 
              CAST(TRIM(ea.FVE) AS CHAR(8))            AS VENTA_FECHA,
              ea.PVE                                    AS VENTA_PRECIO,
              ea.MND                                    AS VENTA_MONEDA,
 
              TRIM(eb.NST)                               AS PERDIDA_NST,
              CAST(TRIM(eb.FCP) AS CHAR(8))              AS PERDIDA_FECHA_CARTA,
              eb.ASG                                      AS PERDIDA_ASG,
              TRIM(eb.NCT)                                AS PERDIDA_NCT,
              CAST(NULL AS CHAR(300))                     AS ARCHIVO_PDF
          FROM ${SCHEMA_BD}.T_GC_RE_CAB        cab
          JOIN ${SCHEMA_BD}.T_GC_RE_DET_A      da  ON da.ID_CAB = cab.ID
          JOIN ${SCHEMA_BD}.PO_OPERACIONES     poa ON poa.ID = da.ID_OPE
          JOIN ${SCHEMA_BD}.TCLIE              ta  ON TRIM(ta.CLICVE) = TRIM(CAST(poa.IDCLI AS CHAR(10)))
          JOIN ${SCHEMA_BD}.T_GC_RE_DET_B      db  ON db.ID_CAB = cab.ID
          JOIN ${SCHEMA_BD}.PO_OPERACIONES     pon ON pon.ID = db.ID_OPE
          JOIN ${SCHEMA_BD}.TCLIE              tn  ON TRIM(tn.CLICVE) = TRIM(CAST(pon.IDCLI AS CHAR(10)))
          LEFT JOIN ${SCHEMA_BD}.T_GC_RE_EXT_A ea  ON ea.ID_CAB = cab.ID
          LEFT JOIN ${SCHEMA_BD}.T_GC_RE_EXT_B eb  ON eb.ID_CAB = cab.ID
          WHERE cab.ID_ASG_DET = ?
          ORDER BY cab.FRE
        `;
        eventos = await cn.query(sqlEventos, [idAsignacion]);
 
        const sqlDocumentos = `
          SELECT
              doc.ID_CAB                 AS ID_CAB,
              TRIM(tip.DSC)              AS TIPO_DOCUMENTO,
              doc.ACH                     AS ARCHIVO,
              doc.FCH_REG                 AS FECHA_REGISTRO,
              TRIM(doc.USU_REG)           AS USUARIO_REGISTRO
          FROM ${SCHEMA_BD}.T_GC_RE_DOC          doc
          LEFT JOIN ${SCHEMA_BD}.T_GC_RE_DOC_TIP tip ON tip.ID = doc.ID_TIP
          WHERE doc.ID_CAB IN (
              SELECT ID FROM ${SCHEMA_BD}.T_GC_RE_CAB WHERE ID_ASG_DET = ?
          )
          ORDER BY doc.ID_CAB, doc.FCH_REG
        `;
        documentos = await cn.query(sqlDocumentos, [idAsignacion]);
      } else {
        // ---------------------------------------------------------------
        // CASO SIN reasignaciones: PASO 3B, fallback a TBL_ASIGNACION_DET
        // ---------------------------------------------------------------
        const sqlFallback = `
          SELECT
              CAST(NULL AS INTEGER)                           AS ID_CAB,
              CAST(NULLIF(TRIM(ad.FECHA_INI), 'undefined') AS CHAR(8)) AS FECHA_REASIGNACION,
              CAST(NULL AS CHAR(1))                           AS TIPO_REASIGNACION,
 
              CAST(NULL AS CHAR(10))                          AS ANT_COD_CLIENTE,
              CAST(NULL AS CHAR(40))                          AS ANT_CLIENTE,
              CAST(NULL AS INTEGER)                           AS ANT_ID_OPERACION,
              CAST(NULL AS CHAR(50))                          AS ANT_OPERACION,
              CAST(NULL AS CHAR(8))                           AS ANT_FECHA_ENTREGA,
              CAST(NULL AS CHAR(8))                           AS ANT_FECHA_DEVOLUCION,
              CAST(NULL AS CHAR(8))                           AS ANT_FECHA_TRASLADO,
 
              t.CLICVE                                        AS NUE_COD_CLIENTE,
              TRIM(t.CLINOM)                                   AS NUE_CLIENTE,
              po.ID                                            AS NUE_ID_OPERACION,
              TRIM(po.DESCRIPCION)                             AS NUE_OPERACION,
              CAST(NULLIF(TRIM(ad.FECHA_INI), 'undefined') AS CHAR(8)) AS NUE_FECHA_ENTREGA,
              CAST(NULLIF(TRIM(ad.FECHA_FIN), 'undefined') AS CHAR(8)) AS NUE_FECHA_DEVOLUCION,
              CAST(NULL AS CHAR(8))                           AS NUE_FECHA_TRASLADO,
 
              CAST(NULL AS CHAR(8))         AS VENTA_FECHA,
              CAST(NULL AS DECIMAL(10,2))   AS VENTA_PRECIO,
              CAST(NULL AS CHAR(1))         AS VENTA_MONEDA,
              CAST(NULL AS CHAR(30))        AS PERDIDA_NST,
              CAST(NULL AS CHAR(8))         AS PERDIDA_FECHA_CARTA,
              CAST(NULL AS CHAR(1))         AS PERDIDA_ASG,
              CAST(NULL AS CHAR(50))        AS PERDIDA_NCT,
              TRIM(ad.ARCHIVO_PDF)           AS ARCHIVO_PDF
          FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET ad
          JOIN ${SCHEMA_BD}.PO_OPERACIONES     po ON po.ID = ad.ID_OPE
          JOIN ${SCHEMA_BD}.TCLIE              t  ON TRIM(t.CLICVE) = TRIM(CAST(po.IDCLI AS CHAR(10)))
          WHERE ad.ID = ?
        `;
        eventos = await cn.query(sqlFallback, [idAsignacion]);
        // No hay tabla 1:N de documentos para este caso; se arma mas abajo
        // desde la columna ARCHIVO_PDF de cada "evento".
      }
 
      // Agrupar documentos por ID_CAB para adjuntarlos a cada evento
      const docsPorCab = documentos.reduce((acc, d) => {
        (acc[d.ID_CAB] ??= []).push({
          tipo: d.TIPO_DOCUMENTO,
          archivo: d.ARCHIVO,
          fechaRegistro: d.FECHA_REGISTRO,
          usuarioRegistro: d.USUARIO_REGISTRO,
        });
        return acc;
      }, {});
 
      const historial = eventos.map((ev) => ({
        idCab: ev.ID_CAB,
        fechaReasignacion: ev.FECHA_REASIGNACION,
        tipoReasignacion: ev.TIPO_REASIGNACION,
        anterior: ev.ANT_COD_CLIENTE
          ? {
              cliente: { cod: ev.ANT_COD_CLIENTE, nombre: ev.ANT_CLIENTE },
              operacion: { id: ev.ANT_ID_OPERACION, nombre: ev.ANT_OPERACION },
              fechaEntrega: ev.ANT_FECHA_ENTREGA,
              fechaDevolucion: ev.ANT_FECHA_DEVOLUCION,
              fechaTraslado: ev.ANT_FECHA_TRASLADO,
            }
          : null,
        nuevo: {
          cliente: { cod: ev.NUE_COD_CLIENTE, nombre: ev.NUE_CLIENTE },
          operacion: { id: ev.NUE_ID_OPERACION, nombre: ev.NUE_OPERACION },
          fechaEntrega: ev.NUE_FECHA_ENTREGA,
          fechaDevolucion: ev.NUE_FECHA_DEVOLUCION,
          fechaTraslado: ev.NUE_FECHA_TRASLADO,
        },
        venta: ev.VENTA_FECHA
          ? { fecha: ev.VENTA_FECHA, precio: ev.VENTA_PRECIO, moneda: ev.VENTA_MONEDA }
          : null,
        perdida: ev.PERDIDA_FECHA_CARTA
          ? {
              nst: ev.PERDIDA_NST,
              fechaCarta: ev.PERDIDA_FECHA_CARTA,
              asg: ev.PERDIDA_ASG,
              nct: ev.PERDIDA_NCT,
            }
          : null,
        documentos:
          docsPorCab[ev.ID_CAB] ??
          (ev.ARCHIVO_PDF ? [{ archivo: ev.ARCHIVO_PDF }] : []),
      }));
 
      const ultimoTramo = historial[historial.length - 1] ?? null;
 
      return {
        placa: placa.trim().toUpperCase(),
        idAsignacion,
        clienteActual: ultimoTramo?.nuevo ?? null,
        totalClientesDistintos: new Set(
          historial.flatMap((h) =>
            [h.anterior?.cliente?.cod, h.nuevo?.cliente?.cod].filter(Boolean)
          )
        ).size,
        historial,
      };
    });
 
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error al listar historial de la placa", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar historial de la placa",
    });
  }
};

const listPlateByRegion = async (req, res) => {
  const { region, clienteId } = req.query;

  if (!region)
    return res
      .status(400)
      .json({ success: false, message: "El parametro region es obligatorio" });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT
        TAD.PLACA,
        TAD.NROSER,
        PM.DESCRIPCION AS MARCA,
        PM2.DESCRIPCION AS MODELO,
        TAD.TP_TERRENO AS TERRENO,
        TAD.CONDICION AS CONDICION,
        PV.ANO AS ANIO,
        TAD.FECHA_INI AS FECHA_INICIO,
        TAD.FECHA_FIN AS FECHA_FIN,
        PO.DESCRIPCION AS OPERACION,
        CL.CLINOM AS CLIENTE
      FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
      LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
        ON TAD.ID_OPE = PO.ID
      LEFT JOIN ${SCHEMA_BD}.TBL_UBICACION_OPE tuo
        ON TUO.ID_OPE = PO.ID
      LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB tac
        ON TAD.ID_ASIGNACION = TAC.ID
      LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO pv
        ON TAD.ID_VEH = PV.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA pm
        ON PV.IDMAR = PM.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO pm2
        ON PV.IDMOD = PM2.ID
      LEFT JOIN (
        SELECT DISTINCT A.IDCLI, B.CLINOM
        FROM ${SCHEMA_BD}.PO_OPERACIONES A
        INNER JOIN ${SCHEMA_BD}.TCLIE B
          ON A.IDCLI = B.CLICVE
        WHERE A.ID <> 86
          AND B.CLINOM <> '*** ANULADO ***'
      ) CL
        ON PO.IDCLI = CL.IDCLI
      WHERE TUO.DEPARTAMENTO = ? ${clienteId ? "AND TAC.ID_CLIENTE = ?" : ""}
    `;

      const params = [region.toUpperCase()];

      if (clienteId) {
        params.push(clienteId);
      }

      const result = await cn.query(sql, params);

      return result.map((row) => ({
        placa: row.PLACA.trim(),
        nroSer: row.NROSER.trim(),
        marca: row.MARCA.trim(),
        modelo: row.MODELO.trim(),
        terreno: transformType(row.TERRENO, {
          0: "Superficie",
          1: "Socavón",
          2: "Ciudad",
          3: "Severo",
          4: "Pendiente",
        }),
        condicion: transformType(row.CONDICION, {
          0: "Titular",
          1: "Retén",
          2: "Logística",
          3: "Pendiente",
        }),
        anio: row.ANIO,
        fechaIni: row.FECHA_INICIO?.trim() ?? "",
        fechaFin: row.FECHA_FIN?.trim() ?? "",
        operacion: row.OPERACION.trim(),
        cliente: row.CLIENTE.trim(),
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener vehiculos por region", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener vehiculos por region",
    });
  }
};

module.exports = {
  listVehicles,
  tableVehicles,
  contVehicles,
  vehicleLeasing,
  listVehiclesByContract,
  listModelGen,
  listYearByModelGen,
  listPlateTraceability,
  listPlateByRegion,
  listVehicleTraceability,
  listPlateHistory 
};
