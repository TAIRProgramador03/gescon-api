const {
  convertirFecha,
  obtenerUltimoIdDoc,
  transformType,
} = require("../../shared/utils.js");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD, IP_LOCAL } = require("../../shared/conf.js");

const listDocumentByNroContract = async (req, res) => {
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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
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

  const cn = await connection(globalDbUser, globalPassword);

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
      duracion: findDocument.DURACION,
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
      cantLea: findDocument.CANT_LEA
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
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
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

  const cn = await connection(globalDbUser, globalPassword);

  try {
    const sqlLeasing = `
      SELECT ID 
      FROM ${SCHEMA_BD}.TBL_LEASING_CAB 
      WHERE ID_CONTRATO = ? AND TIPCON = 'H'
    `;

    const resultLea = await cn.query(sqlLeasing, [documentoId])

    if(resultLea.length == 0) return res.status(404).json({success: false, message: "Sin placas contratadas"});

    const cleanLea = resultLea.map((row) => row.ID)

    const placeHolders = resultLea.map(() => '?').join(",")

    const sqlDetLea = `
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
      WHERE ID_LEA_CAB IN (${placeHolders}) AND TIPO_TERRENO = ?
    `;

    const resultDet = await cn.query(sqlDetLea, [...cleanLea, tipoTerr.toUpperCase()])

    if(resultDet.length == 0) return res.status(404).json({success: false, message: "Sin placas encontradas"});
    
    const cleanedResult = resultDet.map((row) => ({
      modelo: row.MODELO.trim() ?? "",
      placa: row.PLACA.trim() ?? "",
      cantidad: row.CANTIDAD,
      año: row.ANO,
      color: row.COLOR.trim() ?? "",
      marca: row.MARCA.trim() ?? "",
      operacion: row.OPERACION.trim() ?? "",
      fechaFin: row.FECHA_FIN ? row.FECHA_FIN.trim() : "",
      nroLeasing: row.NRO_LEASING.trim() ?? ""
    }))

    return res.status(200).json(cleanedResult)
  } catch (error) {
    console.error(error)
    return res.status(500).json({success: false, message: "Error al obtener placas por documento"})
  } finally {
    if(cn) await cn.close();
  }
};

const insertDocument = async (req, res) => {
  const { globalDbUser, globalPassword } = req.user;

  // Validación de token y sus datos
  if (!globalDbUser || !globalPassword) {
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

  let nombreArchivo = `http://${IP_LOCAL}/tair-web/public/pdf/documents/${archivoPdf}`;

  const claseDocu = "H";
  const fechaFormatoDB = convertirFecha(fechaFirma);

  const cn = await connection(globalDbUser, globalPassword);

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
      nombreArchivo,
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
      nombreArchivo,
      claseDocu,
      motivo,
    ]);

    const idDocumentoCab = result.insertId || (await obtenerUltimoIdDoc(cn));

    const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_DET
              (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

module.exports = {
  insertDocument,
  listDocumentByNroContract,
  detailVehByDocu,
  detailDocument,
};
