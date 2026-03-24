const { SCHEMA_BD } = require("../../shared/conf.js");
const { decodeString } = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");

const listVehicles = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

  try {
    // Consulta los contratos asociados al cliente
    // A.INIVAL1='0' AND
    const query = `
      SELECT A.ID, A.CODINI AS CODINI, A.NUMPLA AS PLACA, C.DESCRIPCION AS MARCA, B.DESCRIPCION AS MODELO, B.DESMODGEN AS GENERICO, D.DESCRIP AS TERRENO 
      FROM ${SCHEMA_BD}.PO_VEHICULO A 
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO B ON A.IDMOD=B.ID AND A.IDMODGEN=B.IDMODGEN 
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA C ON A.IDMAR=C.ID 
      LEFT JOIN ${SCHEMA_BD}.PO_TERRENO D ON A.TP_TRABAJO=D.TPTRA 
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_DET E ON A.ID=E.ID_VEH 
      WHERE E.ID_VEH IS NULL ORDER BY A.ID DESC
    `;
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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);

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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCli, nroLeasing } = req.query;
  let query = "";
  let params = [];

  const cn = await connection(globalDbUser, globalPassword);

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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
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

  const cn = await connection(globalDbUser, globalPassword);

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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const cn = await connection(globalDbUser, globalPassword);
  try {
    const sql = `SELECT DISTINCT(IDMODGEN), DESMODGEN FROM SPEED400AT.PO_MODELO ORDER BY IDMODGEN ASC`;
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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { modelId } = req.query;

  if(!modelId) return res.status(400).json({success: false, message: "El parametro modelId es obligatorio"})

  const cn = await connection(globalDbUser, globalPassword);
  try {
    const sql = `
      SELECT DISTINCT(ANO) FROM SPEED400AT.PO_VEHICULO V
      LEFT JOIN SPEED400AT.PO_MODELO MO
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

module.exports = {
  listVehicles,
  tableVehicles,
  contVehicles,
  vehicleLeasing,
  listVehiclesByContract,
  listModelGen,
  listYearByModelGen,
};
