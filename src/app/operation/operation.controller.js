const {
  decodeString,
  obtenerUltimoIdAsigna,
  convertirFecha,
  funcionNumerica,
  funcionParteVar,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const listOperations = async (req, res) => {
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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idContrato, idCliente, idLeasing, tipoTerr } = req.query;

  if (!idContrato || !idCliente)
    return res.status(400).json({
      success: false,
      message: "Los parametros idContrato e idCliente son obligatorio",
    });

  const cn = await connection(globalDbUser, globalPassword);

  try {
    let sql = `
      SELECT  B.PLACA, B.TARIFA, B.TP_TERRENO AS TERRENO, B.FECHA_INI, B.FECHA_FIN, B.LEASING, V.COLOR AS COLOR, V.ANO AS ANO, MA.DESCRIPCION AS MARCA, MO.DESCRIPCION AS MODELO, A.ID_CLIENTE
      FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A
      LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B
      ON A.ID = B.ID_ASIGNACION
      LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
      ON B.ID_VEH = V.ID
      LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
      ON MA.ID = V.IDMAR
      LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
      ON MO.ID = V.IDMOD
      WHERE B.ID_CONTRATO = ? AND A.ID_CLIENTE = ?
    `;

    const params = [idContrato, idCliente];

    if (idLeasing) {
      sql += " AND LEASING = ?";
      params.push(idLeasing);
    }

    if (tipoTerr) {
      sql += " AND TP_TERRENO = ?";
      params.push(tipoTerr);
    }

    const result = await cn.query(sql, params);

    const convertResult = result.map((row) => ({
      placa: row.PLACA.trim(),
      tarifa: row.TARIFA,
      terreno: row.TERRENO,
      fechaIni: convertirFecha(row.FECHA_INI.trim()),
      fechaFin: convertirFecha(row.FECHA_FIN.trim()),
      leasing: row.LEASING.trim(),
      año: row.ANO,
      color: row.COLOR.trim(),
      marca: row.MARCA.trim(),
      modelo: row.MODELO.trim(),
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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { idCliente, valorRepe, detalles } = req.body;

  const cn = await connection(globalDbUser, globalPassword);

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
      globalDbUser,
    ]);

    const idAsignaCab = result.insertId || (await obtenerUltimoIdAsigna(cn));

    const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBL_ASIGNACION_DET 
              (ID_ASIGNACION, ID_VEH, SEC_CON, PLACA, TARIFA, ID_OPE, ID_CONTRATO, TP_TERRENO, FECHA_INI, FECHA_FIN, LEASING, CLASE_CONTRATO)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ]);
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

module.exports = {
  listOperations,
  listAssingByContract,
  insertOperation,
};
