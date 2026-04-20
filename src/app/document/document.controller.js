const {
  convertirFecha,
  obtenerUltimoIdDoc,
  transformType,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const { moveFile, fileExists } = require("../../shared/service/aws-s3.js");

const listDocumentByNroContract = async (req, res) => {
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
      SELECT A.ID, A.NRO_DOC, A.CANT_VEHI, A.FECHA_FIRMA, A.DURACION
      FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A 
      INNER JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB B ON B.ID=A.ID_PADRE AND B.ID_CLIENTE=A.ID_CLIENTE 
      WHERE B.ID = ? AND B.ID_CLIENTE = ?
    `;

    const result = await cn.query(sql, [contratoId, clienteId]);

    const cleanedResult = result.map((row) => ({
      id: row.ID,
      nroDocumento: row.NRO_DOC ? row.NRO_DOC.trim() : "",
      fechaFirma: row.FECHA_FIRMA ? row.FECHA_FIRMA.trim() : "",
      cantVehi: row.CANT_VEHI,
      duracion: row.DURACION ? row.DURACION.trim() : "",
    }));

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar documentos por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar documentos por contrato",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const detailDocument = async (req, res) => {
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
      message: "El parametro documentoId es obligatorio",
    });

  const cn = await connection();

  try {
    const sql = `
      SELECT D.ID, D.NRO_DOC, D.TIPO_DOC, D.CANT_VEHI, D.FECHA_FIRMA, D.DURACION, D.KM_ADI, D.KM_TOTAL, D.VEH_SUP, D.VEH_SEV, D.VEH_SOC, D.VEH_CIU, D.ARCHIVO_PDF, D.DESCRIPCION, D.MOTIVO, COUNT(L.ID) AS CANT_LEA  
      FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB D
      LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB L
      ON D.ID = L.ID_CONTRATO AND L.TIPCON='H'
      WHERE D.ID = ?
      GROUP BY D.ID, D.NRO_DOC, D.TIPO_DOC, D.CANT_VEHI, D.FECHA_FIRMA, D.DURACION, D.KM_ADI, D.KM_TOTAL, D.VEH_SUP, D.VEH_SEV, D.VEH_SOC, D.VEH_CIU, D.ARCHIVO_PDF, D.DESCRIPCION, D.MOTIVO
    `;

    const result = await cn.query(sql, [documentoId]);

    if (result.length == 0 || !result[0])
      return res
        .status(404)
        .json({ success: false, message: "No se encontro el documento" });

    const findDocument = result[0];

    return res.status(200).json({
      id: findDocument.ID,
      firma: findDocument.FECHA_FIRMA.trim(),
      duracion: findDocument.DURACION.trim(),
      tipoDocumento: transformType(findDocument.TIPO_DOC, {
        1: "Adendas",
        2: "Carta",
        3: "Orden de Compra",
        4: "Orden de Servicio",
        5: "Orden de Cambio",
      }),
      kmAdi: findDocument.KM_ADI,
      kmTotal: findDocument.KM_TOTAL,
      vehSup: findDocument.VEH_SUP,
      vehSev: findDocument.VEH_SEV,
      vehSoc: findDocument.VEH_SOC,
      vehCiu: findDocument.VEH_CIU,
      motivoDoc: transformType(findDocument.MOTIVO.trim(), {
        1: "Ampliación",
        2: "Renovación",
        3: "Actualización de datos del cliente",
        4: "Devolución",
      }),
      archivoPdf: findDocument.ARCHIVO_PDF
        ? findDocument.ARCHIVO_PDF.trim()
        : "",
      descripcion: findDocument.DESCRIPCION
        ? findDocument.DESCRIPCION.trim()
        : "",
      cantLea: findDocument.CANT_LEA,
      nroDocumento: findDocument.NRO_DOC.trim()
    });
  } catch (error) {
    console.error("Error al obtener detalle de documento", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener detalle de documento",
    });
  } finally {
    if (cn) await cn.close();
  }
};

const detailVehByDocu = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const { documentoId, tipoTerr } = req.query;

  if (!documentoId || !tipoTerr)
    return res.status(400).json({
      success: false,
      message: "Los parametros documentoId y tipoTerr son obligatorios",
    });

  const cn = await connection();

  try {
    const sqlLeasing = `
      SELECT ID 
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB 
      WHERE ID_CONTRATO = ? AND TIPCON = 'H'
    `;

    const resultLea = await cn.query(sqlLeasing, [documentoId]);

    if (resultLea.length == 0)
      return res
        .status(404)
        .json({ success: false, message: "Sin placas contratadas" });

    const cleanLea = resultLea.map((row) => row.ID);

    const placeHolders = resultLea.map(() => "?").join(",");

    const sqlDetLea = `
      SELECT L.MODELO, L.PLACA, L.CANTIDAD, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, A.FECHA_FIN, LC.NRO_LEASING
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
      WHERE ID_LEA_CAB IN (${placeHolders}) AND TIPO_TERRENO = ?
    `;

    const resultDet = await cn.query(sqlDetLea, [
      ...cleanLea,
      tipoTerr.toUpperCase(),
    ]);

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

const insertDocument = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const {
    idCliente,
    idContrato,
    tipoContrato,
    nroContrato,
    vehiculo,
    duracion,
    kmAdicional,
    kmTotal,
    vehSup,
    vehSev,
    vehSoc,
    vehCiu,
    fechaFirma,
    Especial,
    motivo,
    story,
    detalles,
    archivoPdf,
  } = req.body;

  const oldKey = archivoPdf;
  const newKey = oldKey.replace(/^temp\//, "");

  const claseDocu = "H";
  const fechaFormatoDB = convertirFecha(fechaFirma);

  const cn = await connection();

  try {
    console.log("Valores para queryCabecera:", [
      idCliente,
      idContrato,
      tipoContrato,
      nroContrato,
      vehiculo,
      fechaFormatoDB,
      duracion,
      kmAdicional,
      kmTotal,
      vehSup,
      vehSev,
      vehSoc,
      vehCiu,
      Especial,
      motivo,
      story,
    ]);

    const queryCabecera = `
              INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_CAB 
              (ID_CLIENTE, ID_PADRE, TIPO_DOC, NRO_DOC, CANT_VEHI, FECHA_FIRMA, DURACION, KM_ADI, KM_TOTAL, VEH_SUP, VEH_SEV, VEH_SOC, VEH_CIU, TIPO_ESPE, DESCRIPCION, ARCHIVO_PDF, CLASE, MOTIVO)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    console.log(queryCabecera, [
      idCliente,
      idContrato,
      tipoContrato,
      nroContrato,
      vehiculo,
      fechaFormatoDB,
      duracion,
      kmAdicional,
      kmTotal,
      vehSup,
      vehSev,
      vehSoc,
      vehCiu,
      Especial,
      story,
      newKey,
      claseDocu,
      motivo,
    ]);

    const result = await cn.query(queryCabecera, [
      idCliente,
      idContrato,
      tipoContrato,
      nroContrato,
      vehiculo,
      fechaFormatoDB,
      duracion,
      kmAdicional,
      kmTotal,
      vehSup,
      vehSev,
      vehSoc,
      vehCiu,
      Especial,
      story,
      newKey,
      claseDocu,
      motivo,
    ]);

    await moveFile(oldKey, newKey);

    const idDocumentoCab = result.insertId || (await obtenerUltimoIdDoc(cn));

    const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_DET
              (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA, KM_ADI, CONDICION)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    if (detalles && detalles.length > 0) {
      for (const detalle of detalles) {
        console.log("Valores para queryDetalle:", [
          idDocumentoCab,
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
          detalle.kmAdicional,
          detalle.condicion,
        ]);
        await cn.query(queryDetalle, [
          idDocumentoCab,
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
          detalle.kmAdicional,
          detalle.condicion,
        ]);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar documento:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar documento" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const updateDocument = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const id = Number(req.params.id);

  if (isNaN(id))
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });

  const {
    idCliente,
    idContrato,
    tipoContrato,
    nroContrato,
    vehiculo,
    duracion,
    kmAdicional,
    kmTotal,
    vehSup,
    vehSev,
    vehSoc,
    vehCiu,
    fechaFirma,
    Especial,
    motivo,
    story,
    detalles,
    archivoPdf,
  } = req.body;

  const oldKey = archivoPdf;
  let newKey = oldKey;

  const claseDocu = "H";
  const fechaFormatoDB = convertirFecha(fechaFirma);

  const pool = await connection();
  const cn = await pool.connect();

  try {
    // VALIDAR QUE EL ID EXISTA Y TRAIGA UN DOCUMENTO
    const sql = `
      SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC
      WHERE TC.ID = ?
    `;

    const findDocument = await cn.query(sql, [id]);

    if (findDocument.length == 0)
      return res.status(404).json({
        success: false,
        message: "No se encontró el documento solicitado",
      });

    // VALIDAR QUE NO SE DUPLIQUE UN NUMERO DE CONTRATO EN CASO SE PASE UNO NUEVO
    if (
      findDocument[0].NRO_DOC.trim().toUpperCase() != nroContrato.toUpperCase()
    ) {
      const sqlSearchContract = `SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB WHERE UPPER(NRO_DOC) = ?`;

      const findNroContract = await cn.query(sqlSearchContract, [
        nroContrato.toUpperCase(),
      ]);

      if (findNroContract.length > 0)
        return res.status(409).json({
          success: false,
          message: "El N° documento ya se encuentra registrado",
        });
    }

    const queryCabecera = `
              UPDATE ${SCHEMA_BD}.TBLDOCUMENTO_CAB  
              SET TIPO_DOC = ?, NRO_DOC = ?, CANT_VEHI = ?, FECHA_FIRMA = ?, DURACION = ?, KM_ADI = ?, KM_TOTAL = ?, VEH_SUP = ?, VEH_SEV = ?, VEH_SOC = ?, VEH_CIU = ?, TIPO_ESPE = ?, DESCRIPCION = ?, ARCHIVO_PDF = ?, MOTIVO = ?
              WHERE ID = ?
          `;

    if (oldKey.startsWith("temp/")) {
      newKey = oldKey.replace(/^temp\//, "");

      const isExistInTemp = await fileExists(oldKey);

      if (isExistInTemp) {
        await moveFile(oldKey, newKey);
      }
    }

    const result = await cn.query(queryCabecera, [
      tipoContrato,
      nroContrato,
      vehiculo,
      fechaFormatoDB,
      duracion,
      kmAdicional,
      kmTotal,
      vehSup,
      vehSev,
      vehSoc,
      vehCiu,
      Especial,
      story,
      newKey,
      motivo,
      id,
    ]);

    const idDocumentoCab = id;

    // SECCION DE DETALLES

    const detailDelete = [];
    const detailUpdate = [];
    const detailNew = [];

    if (detalles && detalles.length > 0) {
      for (const detalle of detalles) {
        if (!detalle.idDet) {
          // ASIGNAMOS LA LISTA DE DETALLES PARA CREAR NUEVOS
          detailNew.push(detalle);
        } else {
          // ASIGNAMOS LA LISTA DE DETALLES PARA ACTUALIZAR
          detailUpdate.push(detalle);
        }
      }
    }

    const paramsDet = detailUpdate.map(() => "?");

    const queryValidDelete = `
            SELECT D.ID FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET D
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB C
            ON D.ID_CON_CAB = C.ID
            WHERE C.ID = ? AND D.ID NOT IN (${paramsDet.join(",")})
          `;

    const resultValidDelete = await cn.query(queryValidDelete, [
      idDocumentoCab,
      ...detailUpdate.map((det) => det.idDet),
    ]);

    if (resultValidDelete.length > 0) {
      resultValidDelete.forEach((row) => {
        detailDelete.push(row.ID);
      });
    }

    const queryUpdDetalle = `
      UPDATE ${SCHEMA_BD}.TBLDOCUMENTO_DET
      SET SEC_CON = ?, MODELO = ?, TIPO_TERRENO = ?, TARIFA = ?, CPK = ?, RM = ?, CANTIDAD = ?, DURACION = ?, KM_ADI = ?, PRECIO_VEH = ?, PRECIO_VENTA = ?, CONDICION = ?
      WHERE ID = ?
    `;

    if (detalles && detalles.length > 0) {
      for (const detalle of detalles) {
        await cn.query(queryUpdDetalle, [
          detalle.secCon,
          detalle.modelo,
          detalle.tipoTerreno,
          detalle.tarifa,
          detalle.cpk,
          detalle.rm,
          detalle.cantidad,
          detalle.duracion,
          detalle.kmAdicional,
          detalle.compraVeh,
          detalle.precioVeh,
          detalle.condicion,
          detalle.idDet,
        ]);
      }
    }

    const queryNewDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_DET
              (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA, KM_ADI, CONDICION)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    for (const detalle of detailNew) {
      await cn.query(queryNewDetalle, [
        idDocumentoCab,
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
        detalle.kmAdicional,
        detalle.condicion,
      ]);
    }

    // ELIMINAMOS LOS DETALLES

    if (detailDelete.length > 0) {
      const paramsDel = detailDelete.map(() => "?");

      const queryDelDetalle = `
        DELETE FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET
        WHERE ID IN (${paramsDel.join(",")})
      `;

      await cn.query(queryDelDetalle, detailDelete);
    }

    await cn.commit();

    res.json({ success: true });
  } catch (error) {
    await cn.rollback();

    console.error("Error al insertar documento:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar documento" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const getDocumentById = async (req, res) => {
  const { id: idUser } = req.user;

  // Validación de token y sus datos
  if (!idUser) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o no proporcionado" });
  }

  const id = Number(req.params.id);

  if (isNaN(id))
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });

  const pool = await connection();
  const cn = await pool.connect();
  try {
    const sql = `
      SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC
      WHERE TC.ID = ?
    `;

    const result = await cn.query(sql, [id]);

    if (!result[0])
      return res
        .status(404)
        .json({ success: false, message: "No se encontró el documento" });

    const sqlDetail = `
      SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET TD
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC 
      ON TD.ID_CON_CAB = TC.ID
      WHERE TC.ID = ?
    `

    const resultDetail = await cn.query(sqlDetail, [id]);

    return res.status(200).json({
      id: result[0].ID,
      idCliente: result[0].ID_CLIENTE,
      idPadre: result[0].ID_PADRE,
      tipoDoc: result[0].TIPO_DOC,
      nroDoc: result[0].NRO_DOC.trim(),
      cantidad: result[0].CANT_VEHI,
      fechaFirma: convertirFecha(result[0].FECHA_FIRMA.trim()),
      duracion: result[0].DURACION.trim(),
      kmAdicional: result[0].KM_ADI,
      kmTotal: result[0].KM_TOTAL,
      vehSup: result[0].VEH_SUP,
      vehSev: result[0].VEH_SEV,
      vehSoc: result[0].VEH_SOC,
      vehCiu: result[0].VEH_CIU,
      tipoEsp: result[0].TIPO_ESPE,
      archivoPdf: result[0].ARCHIVO_PDF.trim(),
      story: result[0].DESCRIPCION.trim(),
      motivo: result[0].MOTIVO.trim(),
      detalles: resultDetail.map((row) => ({
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
        kmAdicional: row.KM_ADI,
        condicion: row.CONDICION.trim(),
      })),
    });
  } catch (error) {
    console.error("Error al obtener documento por id", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener documento por id" });
  } finally {
    if (cn) await cn.close();
  }
};

module.exports = {
  insertDocument,
  listDocumentByNroContract,
  detailVehByDocu,
  detailDocument,
  getDocumentById,
  updateDocument,
};
