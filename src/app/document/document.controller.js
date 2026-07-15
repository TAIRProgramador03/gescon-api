const {
  convertirFecha,
  obtenerUltimoIdDoc,
  transformType,
  withConnection,
  decodeString,
} = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const { moveFile, fileExists } = require("../../shared/service/aws-s3.js");

const listDocumentByNroContract = async (req, res) => {
  const { contratoId, clienteId } = req.query;

  if (!contratoId || !clienteId)
    return res.status(400).json({
      success: false,
      message: "Los parametros contratoId y clienteId son obligatorio",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
        SELECT A.ID, A.NRO_DOC, A.CANT_VEHI, A.FECHA_FIRMA, A.DURACION
        FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A
        INNER JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB B ON B.ID=A.ID_PADRE AND B.ID_CLIENTE=A.ID_CLIENTE
        WHERE B.ID = ? AND B.ID_CLIENTE = ?
      `;

      const result = await cn.query(sql, [contratoId, clienteId]);

      return result.map((row) => ({
        id: row.ID,
        nroDocumento: row.NRO_DOC ? row.NRO_DOC.trim() : "",
        fechaFirma: row.FECHA_FIRMA ? row.FECHA_FIRMA.trim() : "",
        cantVehi: row.CANT_VEHI,
        duracion: row.DURACION ? row.DURACION.trim() : "",
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar documentos por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar documentos por contrato",
    });
  }
};

const getDocumentByContract = async (req, res) => {
  const { contratoId } = req.query;

  if (!contratoId)
    return res.status(400).json({
      success: false,
      message: "El parametro contratoId es obligatorio",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
        SELECT A.ID, A.NRO_DOC
        FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB A
        INNER JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB B
        ON B.ID = A.ID_PADRE
        WHERE B.ID = ?
      `;

      const result = await cn.query(sql, [contratoId]);

      return result.map((row) => ({
        id: row.ID,
        nroDocumento: row.NRO_DOC ? row.NRO_DOC.trim() : "",
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error("Error al listar documentos por contrato: ", error);
    return res.status(500).json({
      success: false,
      message: "Error al listar documentos por contrato",
    });
  }
};

const documentPending = async (req, res) => {
  const { idCli } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `
        SELECT ID, NRO_DOC AS DESCRIPCION
        FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB
        WHERE NRO_DOC LIKE 'DPEN-%'
        ${idCli ? `AND ID_CLIENTE = ?` : ""}
      `;
      const result = await cn.query(query, idCli ? [idCli] : []);
      return result.map((row) => ({
        id:
          row.ID !== null && row.ID !== undefined
            ? row.ID
            : null,
        nroDocumento:
          row.DESCRIPCION !== null && row.DESCRIPCION !== undefined
            ? decodeString(row.DESCRIPCION.toString().trim())
            : null,
      }));
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los contratos:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener contratos" });
  }
};

const detailDocument = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  const { documentoId } = req.query;

  if (!documentoId)
    return res.status(400).json({
      success: false,
      message: "El parametro documentoId es obligatorio",
    });

  try {
    const data = await withConnection(async (cn) => {
      const sql = `
        SELECT D.ID, D.NRO_DOC, D.TIPO_DOC, D.CANT_VEHI, D.FECHA_FIRMA, D.DURACION, D.KM_ADI, D.KM_TOTAL, D.ARCHIVO_PDF, D.DESCRIPCION, D.MOTIVO, COUNT(L.ID) AS CANT_LEA
        FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB D
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB L
        ON D.ID = L.ID_CONTRATO AND L.TIPCON='H'
        WHERE D.ID = ?
        GROUP BY D.ID, D.NRO_DOC, D.TIPO_DOC, D.CANT_VEHI, D.FECHA_FIRMA, D.DURACION, D.KM_ADI, D.KM_TOTAL, D.ARCHIVO_PDF, D.DESCRIPCION, D.MOTIVO
      `;

      let sqlTotal = `
        SELECT
          COALESCE(TOTAL_VEH_SU, 0) AS TOTAL_VEH_SUP,
          COALESCE(TOTAL_VEH_SOC, 0) AS TOTAL_VEH_SOC,
          COALESCE(TOTAL_VEH_CIU, 0) AS TOTAL_VEH_CIU,
          COALESCE(TOTAL_VEH_SEV, 0) AS TOTAL_VEH_SEV
        FROM (
          SELECT
          SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SU,
            SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
            SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
            SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
          FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
          LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB tac
          ON tad.ID_ASIGNACION  = tac.ID
          LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tdc
          ON tad.ID_CONTRATO = tdc.ID
          WHERE tad.CLASE_CONTRATO = 'H' AND tad.ID_CONTRATO = ?
        )
      `;

      if (roleId == 3) {
        sqlTotal = `
          SELECT
            COALESCE(TOTAL_VEH_SU, 0) AS TOTAL_VEH_SUP,
            COALESCE(TOTAL_VEH_SOC, 0) AS TOTAL_VEH_SOC,
            COALESCE(TOTAL_VEH_CIU, 0) AS TOTAL_VEH_CIU,
            COALESCE(TOTAL_VEH_SEV, 0) AS TOTAL_VEH_SEV
          FROM (
            SELECT
          SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SU,
            SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
            SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
            SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
          FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
          LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB tac
          ON tad.ID_ASIGNACION  = tac.ID
          LEFT JOIN (
          	SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
                FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
                LEFT JOIN (
                  SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
                  FROM ${SCHEMA_BD}.PO_OPERACIONES A
                  INNER JOIN ${SCHEMA_BD}.TCLIE B
                  ON A.IDCLI = B.CLICVE
                  WHERE A.ID <> 86
                  AND B.CLINOM <> '*** ANULADO ***'
                )PO
                ON MOXU.IDOPERACION = PO.ID
                LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
                ON MOXU.CH_CODI_USUARIO = TUG.USU
                LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
                ON TUG.ID_RL = TRG.ID
                WHERE TUG.USU IS NOT NULL
          ) C
          ON TAC.ID_CLIENTE = C.IDCLI AND C.ID_OPERACION = TAD.ID_OPE
          LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tdc
          ON tad.ID_CONTRATO = tdc.ID
          WHERE tad.CLASE_CONTRATO = 'H' AND tad.ID_CONTRATO = ? AND C.ID_USU = ${idUser}
        )
        `;
      }

      const result = await cn.query(sql, [documentoId]);
      const resultTotal = await cn.query(sqlTotal, [documentoId]);

      if (result.length == 0 || !result[0]) return "not_found";

      return { findDocument: result[0], totalVeh: resultTotal[0] };
    });

    if (data === "not_found")
      return res
        .status(404)
        .json({ success: false, message: "No se encontro el documento" });

    const { findDocument, totalVeh } = data;

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
      vehSup: totalVeh.TOTAL_VEH_SUP,
      vehSev: totalVeh.TOTAL_VEH_SEV,
      vehSoc: totalVeh.TOTAL_VEH_SOC,
      vehCiu: totalVeh.TOTAL_VEH_CIU,
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
      nroDocumento: findDocument.NRO_DOC.trim(),
      isTemp: findDocument
        ? findDocument.NRO_DOC.trim().toUpperCase().startsWith("DPEN-")
          ? true
          : false
        : false,
    });
  } catch (error) {
    console.error("Error al obtener detalle de documento", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener detalle de documento",
    });
  }
};

const detailVehByDocu = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  const { documentoId, tipoTerr } = req.query;

  if (!documentoId || !tipoTerr)
    return res.status(400).json({
      success: false,
      message: "Los parametros documentoId y tipoTerr son obligatorios",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      // const sqlLeasing = `
      //   SELECT ID
      //   FROM ${SCHEMA_BD}.TBL_LEASING_CAB
      //   WHERE ID_CONTRATO = ? AND TIPCON = 'H'
      // `;

      // const resultLea = await cn.query(sqlLeasing, [documentoId]);

      // if (resultLea.length == 0)
      //   return res
      //     .status(404)
      //     .json({ success: false, message: "Sin placas contratadas" });

      // const cleanLea = resultLea.map((row) => row.ID);

      // const placeHolders = resultLea.map(() => "?").join(",");

      // const sqlDetLea = `
      //   SELECT L.MODELO, L.PLACA, L.CANTIDAD, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, A.FECHA_FIN, LC.NRO_LEASING
      //   FROM ${SCHEMA_BD}.TBL_LEASING_DET L
      //   LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V
      //   ON L.ID_VEH = V.ID
      //   LEFT JOIN ${SCHEMA_BD}.PO_MARCA M
      //   ON V.IDMAR = M.ID
      //   LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
      //   ON V.SECOPE = O.ID
      //   LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET A
      //   ON L.PLACA = A.PLACA
      //   LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC
      //   ON LC.ID = L.ID_LEA_CAB
      //   WHERE L.ID_LEA_CAB IN (${placeHolders}) AND L.TIPO_TERRENO LIKE ?
      // `;

      let sqlDet = `
        SELECT MO.DESCRIPCION AS MODELO, L.PLACA, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, L.FECHA_FIN, L.LEASING
        FROM SPEED400AT.TBL_ASIGNACION_DET L
        LEFT JOIN SPEED400AT.PO_VEHICULO V
        ON L.ID_VEH = V.ID
        LEFT JOIN SPEED400AT.PO_MARCA M
        ON V.IDMAR = M.ID
        LEFT JOIN SPEED400AT.PO_MODELO MO
        ON V.IDMOD = MO.ID
        LEFT JOIN SPEED400AT.PO_OPERACIONES O
        ON V.SECOPE = O.ID
        WHERE L.TP_TERRENO = ? AND L.ID_CONTRATO = ? AND L.CLASE_CONTRATO = 'H'
      `;

      if (roleId == 3) {
        sqlDet = `
          SELECT MO.DESCRIPCION AS MODELO, L.PLACA, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, L.FECHA_FIN, L.LEASING
          FROM SPEED400AT.TBL_ASIGNACION_DET L
          LEFT JOIN SPEED400AT.TBL_ASIGNACION_CAB tac
          ON L.ID_ASIGNACION = TAC.ID
          LEFT JOIN (
              SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
                  FROM SPEED400AT.MAE_OPERACION_X_USUARIO moxu
                  LEFT JOIN (
                    SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
                    FROM SPEED400AT.PO_OPERACIONES A
                    INNER JOIN SPEED400AT.TCLIE B
                    ON A.IDCLI = B.CLICVE
                    WHERE A.ID <> 86
                    AND B.CLINOM <> '*** ANULADO ***'
                  )PO
                  ON MOXU.IDOPERACION = PO.ID
                  LEFT JOIN SPEED400AT.T_US_GC tug
                  ON MOXU.CH_CODI_USUARIO = TUG.USU
                  LEFT JOIN SPEED400AT.T_RL_GC trg
                  ON TUG.ID_RL = TRG.ID
                  WHERE TUG.USU IS NOT NULL
            ) C
            ON TAC.ID_CLIENTE = C.IDCLI AND C.ID_OPERACION = L.ID_OPE
          LEFT JOIN SPEED400AT.PO_VEHICULO V
          ON L.ID_VEH = V.ID
          LEFT JOIN SPEED400AT.PO_MARCA M
          ON V.IDMAR = M.ID
          LEFT JOIN SPEED400AT.PO_MODELO MO
          ON V.IDMOD = MO.ID
          LEFT JOIN SPEED400AT.PO_OPERACIONES O
          ON V.SECOPE = O.ID
          WHERE L.TP_TERRENO = ? AND L.ID_CONTRATO = ? AND L.CLASE_CONTRATO = 'H' AND C.ID_USU = ${idUser}
        `;
      }

      const resultDet = await cn.query(sqlDet, [tipoTerr, documentoId]);

      // if (resultDet.length == 0)
      //   return res
      //     .status(404)
      //     .json({ success: false, message: "Sin placas encontradas" });

      return resultDet.map((row) => ({
        modelo: row.MODELO.trim() ?? "",
        placa: row.PLACA.trim() ?? "",
        año: row.ANO,
        color: row.COLOR.trim() ?? "",
        marca: row.MARCA.trim() ?? "",
        operacion: row.OPERACION.trim() ?? "",
        fechaFin: row.FECHA_FIN ? row.FECHA_FIN.trim() : "",
        nroLeasing: row.LEASING.trim() ?? "",
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener placas por documento",
    });
  }
};

const insertDocument = async (req, res) => {
  const { user } = req.user;

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

  try {
    await withConnection(async (cn) => {
      const queryCabecera = `
                INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_CAB
                (ID_CLIENTE, ID_PADRE, TIPO_DOC, NRO_DOC, CANT_VEHI, FECHA_FIRMA, DURACION, KM_ADI, KM_TOTAL, VEH_SUP, VEH_SEV, VEH_SOC, VEH_CIU, TIPO_ESPE, DESCRIPCION, ARCHIVO_PDF, CLASE, MOTIVO, CREADO_POR, ACTUALIZADO_POR)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

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
        user,
        user,
      ]);

      await moveFile(oldKey, newKey);

      const idDocumentoCab = result.insertId || (await obtenerUltimoIdDoc(cn));

      const queryDetalle = `
                INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_DET
                (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA, KM_ADI, CONDICION, CREADO_POR, ACTUALIZADO_POR)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

      if (detalles && detalles.length > 0) {
        for (const detalle of detalles) {
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
            user,
            user,
          ]);
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar documento:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar documento" });
  }
};

const updateDocument = async (req, res) => {
  const { user } = req.user;

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

  try {
    const outcome = await withConnection(async (cn) => {
      try {
        // VALIDAR QUE EL ID EXISTA Y TRAIGA UN DOCUMENTO
        const sql = `
          SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC
          WHERE TC.ID = ?
        `;

        const findDocument = await cn.query(sql, [id]);

        if (findDocument.length == 0) return "not_found";

        // VALIDAR QUE NO SE DUPLIQUE UN NUMERO DE CONTRATO EN CASO SE PASE UNO NUEVO
        if (
          findDocument[0].NRO_DOC.trim().toUpperCase() !=
          nroContrato.toUpperCase()
        ) {
          const sqlSearchContract = `SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB WHERE UPPER(NRO_DOC) = ?`;

          const findNroContract = await cn.query(sqlSearchContract, [
            nroContrato.toUpperCase(),
          ]);

          if (findNroContract.length > 0) return "conflict";
        }

        const queryCabecera = `
                  UPDATE ${SCHEMA_BD}.TBLDOCUMENTO_CAB
                  SET TIPO_DOC = ?, NRO_DOC = ?, CANT_VEHI = ?, FECHA_FIRMA = ?, DURACION = ?, KM_ADI = ?, KM_TOTAL = ?, VEH_SUP = ?, VEH_SEV = ?, VEH_SOC = ?, VEH_CIU = ?, TIPO_ESPE = ?, DESCRIPCION = ?, ARCHIVO_PDF = ?, MOTIVO = ?, ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
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
          user,
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

        if (detailUpdate.length > 0) {
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
        }

        const queryUpdDetalle = `
          UPDATE ${SCHEMA_BD}.TBLDOCUMENTO_DET
          SET SEC_CON = ?, MODELO = ?, TIPO_TERRENO = ?, TARIFA = ?, CPK = ?, RM = ?, CANTIDAD = ?, DURACION = ?, KM_ADI = ?, PRECIO_VEH = ?, PRECIO_VENTA = ?, CONDICION = ?, ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
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
              user,
              detalle.idDet,
            ]);
          }
        }

        const queryNewDetalle = `
                  INSERT INTO ${SCHEMA_BD}.TBLDOCUMENTO_DET
                  (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, PRECIO_VEH, PRECIO_VENTA, KM_ADI, CONDICION, CREADO_POR, ACTUALIZADO_POR)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            user,
            user,
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

        return "ok";
      } catch (err) {
        await cn.rollback().catch(() => {});
        throw err;
      }
    });

    if (outcome === "not_found")
      return res.status(404).json({
        success: false,
        message: "No se encontró el documento solicitado",
      });

    if (outcome === "conflict")
      return res.status(409).json({
        success: false,
        message: "El N° documento ya se encuentra registrado",
      });

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar documento:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar documento" });
  }
};

const getDocumentById = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id))
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });

  try {
    const data = await withConnection(async (cn) => {
      const sql = `
        SELECT * FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC
        WHERE TC.ID = ?
      `;

      const result = await cn.query(sql, [id]);

      if (!result[0]) return "not_found";

      const sqlDetail = `
        SELECT TD.* FROM ${SCHEMA_BD}.TBLDOCUMENTO_DET TD
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC
        ON TD.ID_CON_CAB = TC.ID
        WHERE TC.ID = ?
      `;

      const resultDetail = await cn.query(sqlDetail, [id]);

      return { row: result[0], resultDetail };
    });

    if (data === "not_found")
      return res
        .status(404)
        .json({ success: false, message: "No se encontró el documento" });

    const { row, resultDetail } = data;

    return res.status(200).json({
      id: row.ID,
      idCliente: row.ID_CLIENTE,
      idPadre: row.ID_PADRE,
      tipoDoc: row.TIPO_DOC,
      nroDoc: row.NRO_DOC.trim(),
      cantidad: row.CANT_VEHI,
      fechaFirma: convertirFecha(row.FECHA_FIRMA.trim()),
      duracion: row.DURACION.trim(),
      kmAdicional: row.KM_ADI,
      kmTotal: row.KM_TOTAL,
      vehSup: row.VEH_SUP,
      vehSev: row.VEH_SEV,
      vehSoc: row.VEH_SOC,
      vehCiu: row.VEH_CIU,
      tipoEsp: row.TIPO_ESPE,
      archivoPdf: row.ARCHIVO_PDF.trim(),
      story: row.DESCRIPCION.trim(),
      motivo: row.MOTIVO.trim(),
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
  }
};

module.exports = {
  insertDocument,
  listDocumentByNroContract,
  getDocumentByContract,
  documentPending,
  detailVehByDocu,
  detailDocument,
  getDocumentById,
  updateDocument,
};
