const { SCHEMA_BD } = require("../../shared/conf.js");
const { decodeString, convertirFecha } = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");

const listVehicles = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection();

  try {
    // Consulta los contratos asociados al cliente
    // A.INIVAL1='0' AND
    const query = `SELECT A.ID, A.CODINI AS CODINI, A.NUMPLA AS PLACA, C.DESCRIPCION AS MARCA, B.DESCRIPCION AS MODELO, B.DESMODGEN AS GENERICO, D.DESCRIP AS TERRENO FROM ${SCHEMA_BD}.PO_VEHICULO A LEFT JOIN ${SCHEMA_BD}.PO_MODELO B ON A.IDMOD=B.ID AND A.IDMODGEN=B.IDMODGEN LEFT JOIN ${SCHEMA_BD}.PO_MARCA C ON A.IDMAR=C.ID LEFT JOIN ${SCHEMA_BD}.PO_TERRENO D ON A.TP_TRABAJO=D.TPTRA LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_DET E ON A.ID=E.ID_VEH WHERE E.ID_VEH IS NULL ORDER BY A.ID DESC`;
    const result = await cn.query(query);

    // Devuelve los contratos como respuesta
    res.json(result);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const tableVehicles = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection();

  try {
    // Consulta los contratos asociados al cliente
    // A.INIVAL1='0' AND
    // const query = `
    //   SELECT A.ID, A.CODINI AS CODINI, A.NUMPLA AS PLACA, C.DESCRIPCION AS MARCA, B.DESCRIPCION AS MODELO, B.DESMODGEN AS GENERICO, D.DESCRIP AS TERRENO 
    //   FROM ${SCHEMA_BD}.PO_VEHICULO A 
    //   LEFT JOIN ${SCHEMA_BD}.PO_MODELO B ON A.IDMOD=B.ID AND A.IDMODGEN=B.IDMODGEN 
    //   LEFT JOIN ${SCHEMA_BD}.PO_MARCA C ON A.IDMAR=C.ID 
    //   LEFT JOIN ${SCHEMA_BD}.PO_TERRENO D ON A.TP_TRABAJO=D.TPTRA 
    //   LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_DET E ON A.ID=E.ID_VEH 
    //   WHERE E.ID_VEH IS NULL ORDER BY A.ID DESC
    // `;

    const query = `
      SELECT A.ID, A.CODINI AS CODINI, A.NUMPLA AS PLACA, C.DESCRIPCION AS MARCA, B.DESCRIPCION AS MODELO, B.DESMODGEN AS GENERICO, D.DESCRIP AS TERRENO 
      FROM ${SCHEMA_BD}.PO_VEHICULO A
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO B ON A.IDMOD=B.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA C ON A.IDMAR=C.ID 
      LEFT JOIN ${SCHEMA_BD}.PO_TERRENO D ON A.TP_TRABAJO=D.TPTRA 
      LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
      ON A.ID = tad.ID_VEH
      WHERE tad.ID_OPE IS NULL AND A.SECOPE NOT IN (211, 238, 109, 162) ORDER BY A.ID DESC
    `
    const result = await cn.query(query);

    const cleanedResult = result.map((row) => {
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

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const contVehicles = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection();

  try {
    // Consulta los contratos asociados al cliente
    const query = `SELECT*FROM (SELECT MODELO, PRECIO_VEH FROM ${SCHEMA_BD}.TBLCONTRATO_DET) UNION (SELECT MODELO, PRECIO_VEH FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_DET B ON A.ID=B.ID_CON_CAB) ORDER BY PRECIO_VEH ASC`;
    const result = await cn.query(query);

    const cleanedResult = result.map((row) => {
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

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los datos" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const vehicleLeasing = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli, nroLeasing } = req.query;
  let query = "";
  let params = [];

  const cn = await connection();

  try {
    if (nroLeasing === "all") {
      query = `SELECT DISTINCT A.CODINI, A.PLACA, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING  FROM (SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID = B.ID_LEA_CAB) A LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C ON A.ID_VEH = C.ID LEFT JOIN ${SCHEMA_BD}.PO_MARCA D ON C.IDMAR = D.ID LEFT JOIN (SELECT * FROM (SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A LEFT JOIN (SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B ON A.ID=B.ID_ASIGNACION) B ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH) E ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
              WHERE (A.ID_CLIENTE = ?) AND E.VEHICULO IS NULL GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA`;

      params = [idCli];
    } else if (nroLeasing) {
      query = `SELECT DISTINCT A.CODINI, A.PLACA, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING  FROM (SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID = B.ID_LEA_CAB) A LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C ON A.ID_VEH = C.ID LEFT JOIN ${SCHEMA_BD}.PO_MARCA D ON C.IDMAR = D.ID LEFT JOIN (SELECT * FROM (SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A LEFT JOIN (SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B ON A.ID=B.ID_ASIGNACION) B ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH) E ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
              WHERE (A.NRO_LEASING = ? AND A.ID_CLIENTE = ?) AND E.VEHICULO IS NULL GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA`;

      params = [nroLeasing, idCli];
    }

    // Consulta los detalles del contrato
    // const query = `
    //         SELECT DISTINCT A.CODINI, A.PLACA, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING  FROM (SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID = B.ID_LEA_CAB) A LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C ON A.ID_VEH = C.ID LEFT JOIN ${SCHEMA_BD}.PO_MARCA D ON C.IDMAR = D.ID LEFT JOIN (SELECT * FROM (SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO FROM ${SCHEMA_BD}.TBL_LEASING_CAB A INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A LEFT JOIN (SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B ON A.ID=B.ID_ASIGNACION) B ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH) E ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
    //         WHERE (A.NRO_LEASING = '${nroLeasing}' AND A.ID_CLIENTE = '${idCli}') AND E.VEHICULO IS NULL GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA`;

    const result = await cn.query(query, params);

    if (result.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Contrato no encontrado" });
    }

    res.json({
      success: true,
      data: result.map((row) => ({
        codini: row.CODINI,
        placa: row.PLACA,
        marca: row.MARCA,
        modelo: row.MODELO,
        nro_leasing: row.NRO_LEASING,
      })),
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

const listVehiclesByContract = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { contratoId, clienteId } = req.query;

  if (!contratoId || !clienteId)
    return res.status(400).json({
      success: false,
      message: "Los parametros contratoId y clienteId son obligatorio",
    });

  const cn = await connection();

  try {
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

    const cleanedResult = result.map((row) => {
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

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener lista de vehiculos por contrato", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener lista de vehiculos por contrato",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const listModelGen = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection();
  try {
    const sql = `SELECT DISTINCT(IDMODGEN), DESMODGEN FROM ${SCHEMA_BD}.PO_MODELO ORDER BY IDMODGEN ASC`;
    const result = await cn.query(sql);

    const cleanedResult = result.map((row) => ({
      id: row.IDMODGEN,
      description: row.DESMODGEN.trim(),
    }));

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar modelos genericos", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al listar modelos genericos" });
  } finally {
    if (cn) await cn.close();
  }
};

const listYearByModelGen = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { modelId } = req.query;

  if (!modelId)
    return res
      .status(400)
      .json({ success: false, message: "El parametro modelId es obligatorio" });

  const cn = await connection();
  try {
    const sql = `
      SELECT DISTINCT(ANO) FROM ${SCHEMA_BD}.PO_VEHICULO V
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
      ON MO.ID = V.IDMOD
      WHERE ANO != '0' AND MO.IDMODGEN = ?
      ORDER BY ANO DESC
    `;
    const result = await cn.query(sql, [modelId]);

    const cleanedResult = result.map((row) => row.ANO);

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar años por modelo", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al listar años por modelo" });
  } finally {
    if (cn) await cn.close();
  }
};

const listPlateTraceability = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idContrato, idCliente, idLeasing, tipoTerr, status } = req.query;

  const cn = await connection();

  try {
    let filtrosA = "";
    let filtrosB = "";
    let params = [];

    let typeDoc = "";
    let idDoc;

    // filtro obligatorio
    if (idCliente) {
      filtrosA += " AND AC.ID_CLIENTE = ?";
      filtrosB += " AND AC.ID_CLIENTE = ?";
      params.push(idCliente);
    }

    // opcionales
    if (idContrato) {
      typeDoc = idContrato.split("_")[0];
      idDoc = idContrato.split("_")[1];

      if (typeDoc == "P") {
        filtrosA += " AND CC.ID = ?";
        filtrosB += " AND CC.ID = ?";
      } else {
        filtrosA += "";
        filtrosB += " AND DC.ID = ?";
      }

      params.push(idDoc);
    }

    if (idLeasing) {
      filtrosA += " AND AD.LEASING = ?";
      filtrosB += " AND AD.LEASING = ?";
      params.push(idLeasing);
    }

    if (tipoTerr) {
      filtrosA += " AND AD.TP_TERRENO = ?";
      filtrosB += " AND AD.TP_TERRENO = ?";
      params.push(tipoTerr);
    }

    if (status) {
      if (status == "A") {
        filtrosA += " AND O.ID = V.ID_OPE AND V.ID_OPE != 109";
        filtrosB += " AND O.ID = V.ID_OPE AND V.ID_OPE != 109";
      } else if (status == "I") {
        filtrosA += " AND O.ID != V.ID_OPE AND V.ID_OPE != 109";
        filtrosB += " AND O.ID != V.ID_OPE AND V.ID_OPE != 109";
      } else if (status == "V") {
        filtrosA += " AND V.ID_OPE = 109";
        filtrosB += " AND V.ID_OPE = 109";
      }
    }

    const sql = `
    SELECT *
    FROM (
      SELECT 
        T.*,
        ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
      FROM (
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
          CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
          AD.ARCHIVO_PDF AS ARCHIVO_PDF,
          AD.CONDICION AS CONDICION
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
        WHERE AD.CLASE_CONTRATO = 'P' ${filtrosA}

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
          CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
          AD.ARCHIVO_PDF AS ARCHIVO_PDF,
          AD.CONDICION AS CONDICION
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
        WHERE AD.CLASE_CONTRATO = 'H' ${filtrosB}
        ) T
      ) X
      WHERE RN = 1
    `;

    const sqlDoc = `
    SELECT *
    FROM (
      SELECT 
        T.*,
        ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
      FROM (
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
          CASE WHEN CC.MONEDA = '1' THEN 'DÓLAR' ELSE 'SOLES' END AS MONEDA,
          AD.ARCHIVO_PDF AS ARCHIVO_PDF
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
        WHERE AD.CLASE_CONTRATO = 'H' ${filtrosB}
        ) T
      ) X
      WHERE RN = 1
    `;

    if (typeDoc == "H") {
      const result = await cn.query(sqlDoc, [...params]);

      const convertResult = result.map((row) => ({
        idAssing: row.ID,
        cliente: row.CLIENTE.trim(),
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
        terreno: row.TERRENO,
        leasing: row.LEASING ? row.LEASING.trim() : "Sin leasing",
        fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
        fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
        contrato: row.CONTRATO ? row.CONTRATO.trim() : "Sin contrato",
        plazo: row.PLAZO,
        fechaIni: row.FECHA_ENTREGA
          ? convertirFecha(row.FECHA_ENTREGA.trim())
          : "Sin fecha",
        fechaFin: row.FECHA_FIN
          ? convertirFecha(row.FECHA_FIN.trim())
          : "Sin fecha",
        fechaIniCon: row.FECHA_INI_CONTRATO,
        fechaFinCon: row.FECHA_FIN_CONTRATO,
        tarifa: row.TARIFA,
        moneda: row.MONEDA,
        archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
        condicion: row.CONDICION ? row.CONDICION : ""
      }));

      return res.status(200).json(convertResult);
    } else if (typeDoc == "P") {
      const result = await cn.query(sql, [...params, ...params]);

      const convertResult = result.map((row) => ({
        idAssing: row.ID,
        cliente: row.CLIENTE.trim(),
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
        terreno: row.TERRENO,
        leasing: row.LEASING ? row.LEASING.trim() : "Sin leasing",
        fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
        fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
        contrato: row.CONTRATO ? row.CONTRATO.trim() : "Sin contrato",
        plazo: row.PLAZO,
        fechaIni: row.FECHA_ENTREGA
          ? convertirFecha(row.FECHA_ENTREGA.trim())
          : "Sin fecha",
        fechaFin: row.FECHA_FIN
          ? convertirFecha(row.FECHA_FIN.trim())
          : "Sin fecha",
        fechaIniCon: row.FECHA_INI_CONTRATO,
        fechaFinCon: row.FECHA_FIN_CONTRATO,
        tarifa: row.TARIFA,
        moneda: row.MONEDA,
        archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
        condicion: row.CONDICION ? row.CONDICION : ""
      }));

      return res.status(200).json(convertResult);
    } else {
      const result = await cn.query(sql, [...params, ...params]);

      const convertResult = result.map((row) => ({
        idAssing: row.ID,
        cliente: row.CLIENTE.trim(),
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
        terreno: row.TERRENO,
        leasing: row.LEASING ? row.LEASING.trim() : "Sin leasing",
        fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
        fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
        contrato: row.CONTRATO ? row.CONTRATO.trim() : "Sin contrato",
        plazo: row.PLAZO,
        fechaIni: row.FECHA_ENTREGA
          ? convertirFecha(row.FECHA_ENTREGA.trim())
          : "Sin fecha",
        fechaFin: row.FECHA_FIN
          ? convertirFecha(row.FECHA_FIN.trim())
          : "Sin fecha",
        fechaIniCon: row.FECHA_INI_CONTRATO,
        fechaFinCon: row.FECHA_FIN_CONTRATO,
        tarifa: row.TARIFA,
        moneda: row.MONEDA,
        archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
        condicion: row.CONDICION ? row.CONDICION : ""
      }));

      return res.status(200).json(convertResult);
    }
  } catch (error) {
    console.error("Error al listar asignaciones de un contrato", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar asignaciones de un contrato",
    });
  } finally {
    if (cn) await cn.close();
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
};
