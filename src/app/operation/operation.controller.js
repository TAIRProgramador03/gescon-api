const {
  decodeString,
  obtenerUltimoIdAsigna,
  convertirFecha,
  funcionNumerica,
  funcionParteVar,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const { moveFile } = require("../../shared/service/aws-s3.js");

const listOperations = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
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

  const cn = await connection();

  try {
    // Consulta los contratos asociados al cliente
    const query = `
      SELECT ID, DESCRIPCION 
      FROM ${SCHEMA_BD}.PO_OPERACIONES 
      WHERE SITUACION='S' AND IDCLI = ?
    `;
    const result = await cn.query(query, [idCli]);

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
    console.error("Error al obtener las operaciones:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener las operaciones" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const listAssingByContract = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idContrato, idCliente, idLeasing, tipoTerr, status } = req.query;

  if (!idCliente)
    return res.status(400).json({
      success: false,
      message: "El parametro idCliente es obligatorio",
    });

  const cn = await connection();

  try {
    // let sql = `
    //   SELECT  B.PLACA, B.TARIFA, B.TP_TERRENO AS TERRENO, B.FECHA_INI, B.FECHA_FIN, B.LEASING, V.COLOR AS COLOR, V.ANO AS ANO, MA.DESCRIPCION AS MARCA, MO.DESCRIPCION AS MODELO, A.ID_CLIENTE
    //   FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A
    //   LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B
    //   ON A.ID = B.ID_ASIGNACION
    //   LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
    //   ON B.ID_VEH = V.ID
    //   LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
    //   ON MA.ID = V.IDMAR
    //   LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
    //   ON MO.ID = V.IDMOD
    //   WHERE B.ID_CONTRATO = ? AND A.ID_CLIENTE = ?
    // `;

    let filtrosA = "";
    let filtrosB = "";
    let params = [];

    // filtro obligatorio
    filtrosA += " AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'P'";
    filtrosB += " AC.ID_CLIENTE = ? AND AD.CLASE_CONTRATO = 'H'";
    params.push(idCliente);

    // opcionales
    if (idContrato) {
      filtrosA += " AND CC.ID = ?";
      filtrosB += " AND CC.ID = ?";
      params.push(idContrato);
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
        WHERE ${filtrosB}
        ) T
      ) X
      WHERE RN = 1
    `;

    const result = await cn.query(sql, [...params, ...params]);

    const convertResult = result.map((row) => ({
      cliente: row.CLIENTE.trim(),
      idOpe: row.ID_OPE,
      operacion: row.OPERACIONES.trim(),
      idOpeActual: row.ID_OPE_ACTUAL,
      opeActual: row.OPERACION_ACTUAL.trim(),
      placa: row.PLACA.trim(),
      año: row.ANO,
      color: row.COLOR.trim(),
      marca: row.MARCA.trim(),
      modelo: row.MODELO.trim(),
      terreno: row.TERRENO,
      leasing: row.LEASING.trim(),
      fechaIniLea: convertirFecha(row.FECHA_INI_LEASING),
      fechaFinLea: convertirFecha(row.FECHA_FIN_LEASING),
      contrato: row.CONTRATO.trim(),
      plazo: row.PLAZO,
      fechaIni: convertirFecha(row.FECHA_ENTREGA.trim()),
      fechaFin: convertirFecha(row.FECHA_FIN.trim()),
      fechaIniCon: row.FECHA_INI_CONTRATO,
      fechaFinCon: row.FECHA_FIN_CONTRATO,
      tarifa: row.TARIFA,
      moneda: row.MONEDA,
      archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
    }));

    return res.status(200).json(convertResult);
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

const insertOperation = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCliente, valorRepe, detalles } = req.body;

  const cn = await connection();

  let fechita = new Date().toISOString().split("T")[0];
  let converFecha = convertirFecha(fechita);

  try {
    const queryCabecera = `
              INSERT INTO ${SCHEMA_BD}.TBL_ASIGNACION_CAB 
              (ID_CLIENTE, FECHA, USUARIO)
              VALUES (?, ?, ?)
          `;

    const result = await cn.query(queryCabecera, [
      idCliente,
      converFecha,
      "analista",
    ]);

    const idAsignaCab = result.insertId || (await obtenerUltimoIdAsigna(cn));

    const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBL_ASIGNACION_DET 
              (ID_ASIGNACION, ID_VEH, SEC_CON, PLACA, TARIFA, ID_OPE, ID_CONTRATO, TP_TERRENO, FECHA_INI, FECHA_FIN, LEASING, CLASE_CONTRATO, ARCHIVO_PDF, CONDICION)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    /*const queryTarifa = `
              INSERT INTO ${SCHEMA_BD}.PO_TARIFAS 
              (PLACA, REGISTRO, INIVAL, TARIFA, MONEDA, CPK, RECMEN, FECHADEVOLUCION, IDOPE, USUARIO)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;*/

    /*if (detalles && detalles.length > 0) {
              for (const detalle of detalles) {
                  await connection.query(queryDetalle, [
                      idAsignaCab,
                      detalle.idveh,
                      detalle.secCon,
                      detalle.numpla,
                      detalle.tarifa,
                      detalle.idOperacion,
                      funcionNumerica(detalle.idContrato),
                      detalle.idTerreno,
                      convertirFecha(detalle.fechaIni),
                      convertirFecha(detalle.fechaFin),
                      detalle.leasing,
                      funcionParteVar(detalle.idContrato)
                  ]);
              }
          }*/

    if (detalles && detalles.length > 0) {
      let fechaIniGlobal = null;
      let fechaFinGlobal = null;

      for (let i = 0; i < detalles.length; i++) {
        const detalle = detalles[i];

        const oldKey = detalle.archivoPdf;
        const newKey = oldKey.replace(/^temp\//, "");

        // Si valorRepe es true, toma las fechas del primer detalle y reutilízalas
        if (valorRepe === true || valorRepe === "true") {
          if (i === 0) {
            fechaIniGlobal = convertirFecha(detalle.fechaIni);
            fechaFinGlobal = convertirFecha(detalle.fechaFin);
          }
        }

        await cn.query(queryDetalle, [
          idAsignaCab,
          detalle.idveh,
          detalle.secCon,
          detalle.numpla,
          detalle.tarifa,
          detalle.idOperacion,
          funcionNumerica(detalle.idContrato),
          detalle.idTerreno,
          valorRepe ? fechaIniGlobal : convertirFecha(detalle.fechaIni),
          valorRepe ? fechaFinGlobal : convertirFecha(detalle.fechaFin),
          detalle.leasing,
          funcionParteVar(detalle.idContrato),
          newKey,
          detalle.condicion,
        ]);

        await moveFile(oldKey, newKey);
      }
    }

    /*if (detalles && detalles.length > 0) {
              for (const detalle of detalles) {
                  await connection.query(queryTarifa, [
                      detalle.numpla,
                      date.now(),
                      convertirFecha(detalle.fechaIni),
                      detalle.tarifa,
                      '1',
                      '0',
                      '0',
                      convertirFecha(detalle.fechaFin),
                      detalle.idOperacion,
                      globalDbUser
                  ]);
              }
          }*/

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar la asignacion vehicular:", error);
    res.status(500).json({
      success: false,
      message: "Error al insertar la asignacion vehicular",
    });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const valideAssign = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
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

  const cn = await connection();

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

const updateAssign = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const pool = await connection();
  const cn = await pool.connect();

  const id = Number(req.params.id);

  if(isNaN(id)) {
    return res.status(400).json({success: false, message: "El parametro id debe ser numerico"});
  }

  const {condicion, terreno, archivoPdf} = req.body;

  try {
    // await cn.beginTransaction();

    const sqlFind = `
      SELECT CONDICION, ARCHIVO_PDF, TP_TERRENO FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET
      WHERE ID = ?
    `

    const findAssign = await cn.query(sqlFind, [id]);

    if(!findAssign[0]) return res.status(404).json({success: false, message: "No se encontro la asignación"})

    const fields = [];
    const params = [];

    if(condicion !== undefined) {
      fields.push(`CONDICION = ?`)
      params.push(condicion)
    }

    if(terreno !== undefined) {
      fields.push(`TP_TERRENO = ?`)
      params.push(terreno)
    }

    if(archivoPdf) {
      fields.push(`ARCHIVO_PDF = ?`)

      let keyFile = archivoPdf;

      if(archivoPdf.startsWith('temp/')) {
        keyFile = archivoPdf.replace(/^temp\//, "");

        await moveFile(archivoPdf, keyFile);
      }

      params.push(keyFile)
    }

    if(fields.length === 0) return res.status(400).json({success: false, message: "No se detectaron campos para modificar"})

    console.log(fields.join(", "));
    console.log(params);

    const sqlUpd = `
      UPDATE ${SCHEMA_BD}.TBL_ASIGNACION_DET
      SET ${fields.join(", ")}
      WHERE ID = ?
    `

    await cn.query(sqlUpd, [...params, id]);

    // await cn.commit();

    return res.status(200).json({success: true, message: "Actualización realizada"});
  } catch (error) {
    // await cn.rollback();
    console.error(error);
    return res.status(500).json({success: false, message: `Error al actualizar las placas: ${error}` })
  } finally {
    if (cn) await cn.close();
  }
};

module.exports = {
  listOperations,
  listAssingByContract,
  insertOperation,
  valideAssign,
  updateAssign
};
