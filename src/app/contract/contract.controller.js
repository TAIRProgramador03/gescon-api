const { SCHEMA_BD } = require("../../shared/conf.js");
const {
  decodeString,
  convertirFecha,
  obtenerUltimoId,
  withConnection,
} = require("../../shared/utils.js");
const { moveFile, fileExists } = require("../../shared/service/aws-s3.js");

const contractNro = async (req, res) => {
  const { idCli } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `
        SELECT ID, NRO_CONTRATO AS DESCRIPCION, DURACION AS PLAZO
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB
        ${idCli ? `WHERE ID_CLIENTE = ?` : ""}
      `;
      const result = await cn.query(query, idCli ? [idCli] : []);
      return result.map((row) => ({
        ID:
          row.ID !== null && row.ID !== undefined
            ? row.ID.toString().trim()
            : null,
        PLAZO:
          row.PLAZO !== null && row.PLAZO !== undefined
            ? Number(row.PLAZO.trim())
            : null,
        DESCRIPCION:
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

// const contractNroAdi = async (req, res) => {
//   ...comentado en el original...
// };

const contractNroAdi = async (req, res) => {
  const { id: idUser, roleId } = req.user;
  const { idCli } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      let query = `
        SELECT ID, DESCRIPCION FROM ((SELECT CONCAT('P_', ID) AS ID, NRO_CONTRATO AS DESCRIPCION FROM ${SCHEMA_BD}.TBLCONTRATO_CAB ${idCli ? "WHERE ID_CLIENTE= ?" : ""} )
        UNION ALL (SELECT CONCAT('H_', ID) AS ID, NRO_DOC AS DESCRIPCION FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB ${idCli ? "WHERE ID_CLIENTE= ?" : ""} )) AS CONTRATOS
        ORDER BY DESCRIPCION ASC
      `;

      if (roleId == 3) {
        query = `
          SELECT ID, DESCRIPCION FROM (
            SELECT CONCAT('P_', ID) AS ID, NRO_CONTRATO AS DESCRIPCION
            FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TC
            LEFT JOIN (
              SELECT DISTINCT PO.IDCLI, PO.CLINOM, MOXU.CH_CODI_USUARIO, TUG.ID AS ID_USU, TUG.USU, TRG.DESCRIPCION AS ROL
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
            ) TU
            ON CAST(TC.ID_CLIENTE AS VARCHAR(11)) = TU.IDCLI
            WHERE TU.ID_USU = ${idUser} ${idCli ? "AND ID_CLIENTE= ?" : ""}

            UNION ALL

            SELECT CONCAT('H_', ID) AS ID, NRO_DOC AS DESCRIPCION
            FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TC
            LEFT JOIN (
              SELECT DISTINCT PO.IDCLI, PO.CLINOM, MOXU.CH_CODI_USUARIO, TUG.ID AS ID_USU, TUG.USU, TRG.DESCRIPCION AS ROL
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
            ) TU
            ON CAST(TC.ID_CLIENTE AS VARCHAR(11)) = TU.IDCLI
            WHERE TU.ID_USU = ${idUser} ${idCli ? "AND ID_CLIENTE= ?" : ""}
          ) AS CONTRATOS
          ORDER BY DESCRIPCION ASC
        `;
      }

      const result = await cn.query(query, idCli ? [idCli, idCli] : []);
      return result.map((row) => ({
        ID:
          row.ID !== null && row.ID !== undefined
            ? row.ID.toString().trim()
            : null,
        DESCRIPCION:
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

const contractPending = async (req, res) => {
  const { idCli } = req.query;

  try {
    const params = [];
    const conditions = ["NRO_CONTRATO LIKE 'CPEN-%'"];

    if (idCli) {
      conditions.push("TBC.ID_CLIENTE = ?");
      params.push(idCli);
    }

    const where =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const cleanedResult = await withConnection(async (cn) => {
      const query = `
        WITH
        CLIENTES AS (
          SELECT 
            DISTINCT PO.IDCLI, 
            TRIM(TC.CLINOM) AS CLINOM
          FROM ${SCHEMA_BD}.PO_OPERACIONES PO
          INNER JOIN ${SCHEMA_BD}.TCLIE TC
          ON PO.IDCLI = TC.CLICVE
          WHERE PO.ID <> 86
          AND TC.CLINOM <> '*** ANULADO ***'
        )
        SELECT TBC.ID, TRIM(TBC.NRO_CONTRATO) AS DESCRIPCION, C.CLINOM AS CLIENTE, COUNT(TLC.ID) AS LEASINGS
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TBC
        LEFT JOIN CLIENTES C
        ON C.IDCLI = TBC.ID_CLIENTE
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB tlc 
        ON TLC.ID_CONTRATO = TBC.ID AND TRIM(TLC.TIPCON) = 'P'
        ${where}
        GROUP BY TBC.ID, TBC.NRO_CONTRATO, C.CLINOM
      `;
      const result = await cn.query(query, params);
      return result.map((row) => ({
        ID: row.ID,
        DESCRIPCION: row.DESCRIPCION,
        CLIENTE: row.CLIENTE,
        LEASINGS: row.LEASINGS,
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

const tableContract = async (req, res) => {
  const { idCli, id } = req.query;

  if (!idCli) {
    return res
      .status(400)
      .json({ success: false, message: "El parámetro idCli es obligatorio." });
  }

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const query = `
        SELECT 
          TC.ID, 
          TC.NRO_CONTRATO AS DESCRIPCION, 
          TC.FECHA_FIRMA AS FECHACREA, 
          TC.CANT_VEHI + COALESCE(
            (SELECT SUM(TD2.CANT_VEHI) 
            FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD2 
            WHERE TD2.ID_PADRE = TC.ID), 
          0) AS TOTVEH, 
          TC.DURACION
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TC
        WHERE ID_CLIENTE = ? ${id ? "AND ID = ?" : ""}
      `;
      const result = await cn.query(query, id ? [idCli, id] : [idCli]);
      return result.map((row) => ({
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
      }));
    });

    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener los datos:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los datos. Por favor intente más tarde.",
    });
  }
};

// const detailContract = async (req, res) => {
//   const { id: idUser, roleId } = req.user;
//   const { contratoId, clienteId } = req.query;

//   if (!clienteId) {
//     return res.status(400).json({
//       success: false,
//       message: "El parametro clienteId es obligatorio",
//     });
//   }

//   try {
//     const data = await withConnection(async (cn) => {
//       let filtroContrato = "";
//       const params = [clienteId];

//       if (roleId == 3) {
//         if (contratoId) {
//           filtroContrato = `
//             AND (
//               (TRIM(tad.CLASE_CONTRATO) = 'P' AND tad.ID_CONTRATO = ?)
//               OR
//               (TRIM(tad.CLASE_CONTRATO) = 'H' AND tdc.ID_PADRE = ?)
//             )
//           `;
//           params.push(contratoId, contratoId);
//         }
//       } else {
//         if (contratoId) {
//           params.push(contratoId);
//         }
//       }

//       let sqlTotalVeh = `
//         SELECT
//             SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SUP,
//             SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
//             SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
//             SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
//         FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
//         LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//             ON PO.ID = TAD.ID_OPE
//         WHERE PO.IDCLI = ?
//         ${contratoId ? `AND tad.ID_CONTRATO = ? AND TAD.CLASE_CONTRATO = 'P'` : ""}
//       `;

//       let sqlTotalGesoper = `
//         SELECT 
//             TRIM(C.CLINOM) AS CLIENTE,
//             TRIM(PO.IDCLI) AS ID_CLIENTE,
//             COUNT(PV.ID) AS TOTVEHOP
//         FROM ${SCHEMA_BD}.PO_VEHICULO PV
//         LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//             ON PV.SECOPE = PO.ID
//         LEFT JOIN ${SCHEMA_BD}.TCLIE C
//             ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
//         WHERE PO.IDCLI = ?
//         GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
//         ORDER BY CLIENTE
//       `;

//       let sqlTotalAsign = `
//         SELECT
//             TRIM(C.CLINOM) AS CLIENTE,
//             TRIM(PO.IDCLI) AS ID_CLIENTE,
//             COUNT(PV.ID) AS TOTVEHOP
//         FROM ${SCHEMA_BD}.PO_VEHICULO PV
//         LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//             ON PV.SECOPE = PO.ID
//         LEFT JOIN ${SCHEMA_BD}.TCLIE C
//             ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
//         WHERE TRIM(PO.IDCLI) = ?
//         AND EXISTS (
//             SELECT 1
//             FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE
//                 ON TAD.ID_OPE = OPE.ID
//             WHERE TAD.ID_VEH = PV.ID
//             AND TRIM(OPE.IDCLI) = ?
//         )
//         GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
//       `;

//       const sqlLeasing = `
//         SELECT COUNT(*) AS TOTAL_LEASINGS FROM ${SCHEMA_BD}.TBL_LEASING_CAB LC
//         LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//         ON LC.ID_CONTRATO = CC.ID AND LC.TIPCON = 'P'
//         WHERE CC.ID_CLIENTE = ?
//         ${contratoId ? `AND CC.ID = ?` : "AND (DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS) > CURRENT DATE"}
//       `;

//       const sqlDocumentos = `
//         SELECT COUNT(*) AS TOTAL_DOCUMENTOS FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
//         LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
//         ON CC.ID = DC.ID_PADRE
//         WHERE CC.ID_CLIENTE = ?
//         ${contratoId ? `AND CC.ID = ?` : "AND (DATE(SUBSTR(CC.FECHA_FIRMA, 1, 4) || '-' || SUBSTR(CC.FECHA_FIRMA, 5, 2) || '-' || SUBSTR(CC.FECHA_FIRMA, 7, 2)) + CAST(CC.DURACION AS INTEGER) MONTHS) > CURRENT DATE "}
//       `;

//       const sqlContrato = `
//         SELECT 
//           TC.NRO_CONTRATO, 
//           TC.DESCRIPCION, 
//           TC.FECHA_FIRMA, 
//           TC.DURACION, 
//           TC.ARCHIVO_PDF 
//         FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TC
//         WHERE TC.ID_CLIENTE = ?
//         ${contratoId ? `AND TC.ID = ?` : ""}
//       `;

//       const sqlTotalContrato = `
//         SELECT
//           SUM(sub.TOTVEH) AS TOTVEH,
//           SUM(sub.TOTVEHDOC) AS TOTVEHDOC,
//           SUM(sub.TOTVEHGENERAL) AS TOTVEHGENERAL
//         FROM (
//           SELECT
//               TC.CANT_VEHI AS TOTVEH,
//               COALESCE(
//                   (SELECT SUM(TD2.CANT_VEHI)
//                   FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD2
//                   WHERE TD2.ID_PADRE = TC.ID),
//               0) AS TOTVEHDOC,
//               TC.CANT_VEHI + COALESCE(
//                   (SELECT SUM(TD2.CANT_VEHI)
//                   FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD2
//                   WHERE TD2.ID_PADRE = TC.ID),
//               0) AS TOTVEHGENERAL
//           FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TC
//           WHERE TC.ID_CLIENTE = ?
//           ${contratoId ? `AND TC.ID = ?` : ""}
//         ) sub
//       `;

//       const sqlPendientes = `
//         SELECT COUNT(*) AS TOTAL_PENDIENTES FROM (
//           SELECT DISTINCT A.CODINI, A.PLACA, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING
//           FROM (
//             SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO
//             FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
//             INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B
//             ON A.ID = B.ID_LEA_CAB) A
//             LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C
//             ON A.ID_VEH = C.ID
//             LEFT JOIN ${SCHEMA_BD}.PO_MARCA D
//             ON C.IDMAR = D.ID
//             LEFT JOIN (
//               SELECT * FROM (
//                 SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO
//                 FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
//                 INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A
//                 LEFT JOIN (
//                   SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH
//                   FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A
//                   INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B
//                   ON A.ID=B.ID_ASIGNACION
//                 ) B
//                 ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH
//               ) E
//               ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
//           WHERE (A.ID_CLIENTE = ?) AND E.VEHICULO IS NULL
//           GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING
//           ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA
//         )
//       `;

//       const sqlTrazabilidad = `
//         SELECT COUNT(DISTINCT VEHICULO) AS TOTAL_VEH_TRAZABILIDAD
//         FROM (
//             SELECT AD.ID_VEH AS VEHICULO
//             FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//                 ON AD.ID_OPE = PO.ID
//             WHERE TRIM(PO.IDCLI) = ?

//             UNION

//             SELECT AD.ID_VEH AS VEHICULO
//             FROM ${SCHEMA_BD}.T_GC_RE_CAB RC
//             LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
//                 ON RC.ID_ASG_DET = AD.ID
//             LEFT JOIN ${SCHEMA_BD}.T_GC_RE_DET_A DA
//                 ON DA.ID_CAB = RC.ID
//             LEFT JOIN ${SCHEMA_BD}.T_GC_RE_DET_B DB
//                 ON DB.ID_CAB = RC.ID
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE_A
//                 ON DA.ID_OPE = OPE_A.ID
//             LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE_B
//                 ON DB.ID_OPE = OPE_B.ID
//             WHERE TRIM(OPE_A.IDCLI) = ? 
//             OR TRIM(OPE_B.IDCLI) = ?
//         ) T
//       `;

//       if (roleId == 3) {
//         sqlTotalGesoper = `
//           SELECT 
//               TRIM(C.CLINOM) AS CLIENTE,
//               TRIM(PO.IDCLI) AS ID_CLIENTE,
//               COUNT(PV.ID) AS TOTVEHOP
//           FROM ${SCHEMA_BD}.PO_VEHICULO PV
//           LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//               ON PV.SECOPE = PO.ID
//           LEFT JOIN ${SCHEMA_BD}.TCLIE C
//               ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
//           LEFT JOIN (
//               SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
//               FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
//               LEFT JOIN (
//                   SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
//                   FROM ${SCHEMA_BD}.PO_OPERACIONES A
//                   INNER JOIN ${SCHEMA_BD}.TCLIE B
//                   ON A.IDCLI = B.CLICVE
//                   WHERE A.ID <> 86
//                   AND B.CLINOM <> '*** ANULADO ***'
//               ) PO
//               ON MOXU.IDOPERACION = PO.ID
//               LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
//               ON MOXU.CH_CODI_USUARIO = TUG.USU
//               LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
//               ON TUG.ID_RL = TRG.ID
//               WHERE TUG.USU IS NOT NULL
//           ) U
//               ON TRIM(PO.IDCLI) = TRIM(U.IDCLI) AND U.ID_OPERACION = PO.ID
//           WHERE PO.IDCLI = ?
//           AND U.ID_USU = ${idUser}
//           GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
//           ORDER BY CLIENTE
//         `;

//         sqlTotalVeh = `
//           SELECT
//               SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SUP,
//               SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
//               SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
//               SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
//           FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
//           LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//               ON PO.ID = TAD.ID_OPE
//           LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tdc
//               ON tad.ID_CONTRATO = tdc.ID AND TRIM(tad.CLASE_CONTRATO) = 'H'
//           LEFT JOIN (
//               SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
//               FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
//               LEFT JOIN (
//                   SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
//                   FROM ${SCHEMA_BD}.PO_OPERACIONES A
//                   INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI = B.CLICVE
//                   WHERE A.ID <> 86 AND B.CLINOM <> '*** ANULADO ***'
//               ) PO ON MOXU.IDOPERACION = PO.ID
//               LEFT JOIN ${SCHEMA_BD}.T_US_GC tug ON MOXU.CH_CODI_USUARIO = TUG.USU
//               LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg ON TUG.ID_RL = TRG.ID
//               WHERE TUG.USU IS NOT NULL
//           ) C
//               ON PO.IDCLI = C.IDCLI AND C.ID_OPERACION = PO.ID
//           WHERE PO.IDCLI = ?
//           AND C.ID_USU = ${idUser}
//           ${filtroContrato}
//         `;

//         sqlTotalAsign = `
//           SELECT
//               TRIM(C.CLINOM) AS CLIENTE,
//               TRIM(PO.IDCLI) AS ID_CLIENTE,
//               COUNT(PV.ID) AS TOTVEHOP
//           FROM ${SCHEMA_BD}.PO_VEHICULO PV
//           LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
//               ON PV.SECOPE = PO.ID
//           LEFT JOIN ${SCHEMA_BD}.TCLIE C
//               ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
//           LEFT JOIN (
//               SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU, PO.ID AS ID_OPERACION
//               FROM ${SCHEMA_BD}.MAE_OPERACION_X_USUARIO moxu
//               LEFT JOIN (
//                   SELECT DISTINCT A.IDCLI, B.CLINOM, A.ID
//                   FROM ${SCHEMA_BD}.PO_OPERACIONES A
//                   INNER JOIN ${SCHEMA_BD}.TCLIE B
//                   ON A.IDCLI = B.CLICVE
//                   WHERE A.ID <> 86
//                   AND B.CLINOM <> '*** ANULADO ***'
//               ) PO
//               ON MOXU.IDOPERACION = PO.ID
//               LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
//               ON MOXU.CH_CODI_USUARIO = TUG.USU
//               LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
//               ON TUG.ID_RL = TRG.ID
//               WHERE TUG.USU IS NOT NULL
//           ) U
//               ON TRIM(PO.IDCLI) = TRIM(U.IDCLI) AND U.ID_OPERACION = PO.ID
//           WHERE TRIM(PO.IDCLI) = ?
//           AND EXISTS (
//               SELECT 1
//               FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
//               LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE
//                   ON TAD.ID_OPE = OPE.ID
//               WHERE TAD.ID_VEH = PV.ID
//               AND TRIM(OPE.IDCLI) = ?
//           )
//           AND U.ID_USU = ${idUser}
//           GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
//         `;
//       }

//       const resultCont = await cn.query(
//         sqlContrato,
//         contratoId ? [clienteId, contratoId] : [clienteId],
//       );
//       const resultTotalCont = await cn.query(
//         sqlTotalContrato,
//         contratoId ? [clienteId, contratoId] : [clienteId],
//       );
//       const resultDoc = await cn.query(
//         sqlDocumentos,
//         contratoId ? [clienteId, contratoId] : [clienteId],
//       );
//       const resultLea = await cn.query(
//         sqlLeasing,
//         contratoId ? [clienteId, contratoId] : [clienteId],
//       );
//       const resultTotalGesoper = await cn.query(sqlTotalGesoper, [clienteId]);
//       const resultTotalVeh = await cn.query(sqlTotalVeh, params);
//       const resultTotalAssign = await cn.query(sqlTotalAsign, [
//         clienteId,
//         clienteId,
//       ]);
//       const resultTotalPending = await cn.query(sqlPendientes, [clienteId]);
//       const resultTrazabilidad = await cn.query(sqlTrazabilidad, [clienteId, clienteId, clienteId]);

//       return {
//         contrato: contratoId ? resultCont[0] : null,
//         totalCont: resultTotalCont[0],
//         documento: resultDoc[0],
//         leasing: resultLea[0],
//         totalGesoper: resultTotalGesoper[0],
//         totalVeh: resultTotalVeh[0],
//         totalVehAssign: resultTotalAssign[0],
//         totalPending: resultTotalPending[0],
//         totalTrazabilidad: resultTrazabilidad[0],
//       };
//     });

//     const {
//       contrato,
//       totalCont,
//       documento,
//       leasing,
//       totalGesoper,
//       totalVeh,
//       totalVehAssign,
//       totalPending,
//       totalTrazabilidad
//     } = data;

//     res.json({
//       success: true,
//       data: {
//         isTemp: contrato
//           ? contrato.NRO_CONTRATO.trim().toUpperCase().startsWith("CPEN-")
//           : false,
//         descripcion: contrato ? contrato.DESCRIPCION.trim() : "",
//         fechaFirma: contrato ? contrato.FECHA_FIRMA : "",
//         duracion: contrato ? contrato.DURACION.trim() : "",
//         totalVeh: totalCont.TOTVEH,
//         totalVehDoc: totalCont.TOTVEHDOC,
//         totalVehGeneral: totalCont.TOTVEHGENERAL,
//         vehiculoSup: totalVeh.TOTAL_VEH_SUP,
//         vehiculoSev: totalVeh.TOTAL_VEH_SEV,
//         vehiculoSoc: totalVeh.TOTAL_VEH_SOC,
//         vehiculoCiu: totalVeh.TOTAL_VEH_CIU,
//         cantidadDocumentos: documento.TOTAL_DOCUMENTOS,
//         cantidadLeasing: leasing.TOTAL_LEASINGS,
//         cantidadAsignados: totalVehAssign ? totalVehAssign.TOTVEHOP : 0,
//         cantidadGesoper: totalGesoper ? totalGesoper.TOTVEHOP : 0,
//         cantidadTrazabilidad: totalTrazabilidad ? totalTrazabilidad.TOTAL_VEH_TRAZABILIDAD : 0,
//         pendientes: totalPending.TOTAL_PENDIENTES,
//         archivoPdf: contrato ? contrato.ARCHIVO_PDF.trim() : "",
//       },
//     });
//   } catch (error) {
//     console.error("Error al obtener los detalles del contrato:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error al obtener los detalles del contrato",
//     });
//   }
// };

const detailContract = async (req, res) => {
  const { id: idUser, roleId } = req.user;
  const { contratoId, clienteId } = req.query;

  if (!clienteId) {
    return res.status(400).json({
      success: false,
      message: "El parametro clienteId es obligatorio",
    });
  }

  try {
    const data = await withConnection(async (cn) => {
      let filtroContrato = "";
      const params = [clienteId];

      if (roleId == 3) {
        if (contratoId) {
          filtroContrato = `
            AND (
              (TRIM(tad.CLASE_CONTRATO) = 'P' AND tad.ID_CONTRATO = ?)
              OR
              (TRIM(tad.CLASE_CONTRATO) = 'H' AND tdc.ID_PADRE = ?)
            )
          `;
          params.push(contratoId, contratoId);
        }
      } else {
        if (contratoId) {
          params.push(contratoId);
        }
      }

      // Filtro reutilizable: vehículo asociado a ese contrato específico según TBL_ASIGNACION_DET
      const filtroContratoGesoper = contratoId
        ? `
          AND EXISTS (
              SELECT 1
              FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
              LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TDC
                  ON TAD.ID_CONTRATO = TDC.ID AND TRIM(TAD.CLASE_CONTRATO) = 'H'
              WHERE TAD.ID_VEH = PV.ID
              AND (
                  (TRIM(TAD.CLASE_CONTRATO) = 'P' AND TAD.ID_CONTRATO = ?)
                  OR
                  (TRIM(TAD.CLASE_CONTRATO) = 'H' AND TDC.ID_PADRE = ?)
              )
          )
        `
        : "";

      const filtroContratoAsign = contratoId
        ? `
          AND (
              (TRIM(TAD.CLASE_CONTRATO) = 'P' AND TAD.ID_CONTRATO = ?)
              OR
              (TRIM(TAD.CLASE_CONTRATO) = 'H' AND TDC.ID_PADRE = ?)
          )
        `
        : "";

      let sqlTotalVeh = `
        SELECT
            SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SUP,
            SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
            SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
            SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
        FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
            ON PO.ID = TAD.ID_OPE
        WHERE PO.IDCLI = ?
        ${contratoId ? `AND tad.ID_CONTRATO = ? AND TAD.CLASE_CONTRATO = 'P'` : ""}
      `;

      let sqlTotalGesoper = `
        SELECT 
            TRIM(C.CLINOM) AS CLIENTE,
            TRIM(PO.IDCLI) AS ID_CLIENTE,
            COUNT(PV.ID) AS TOTVEHOP
        FROM ${SCHEMA_BD}.PO_VEHICULO PV
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
            ON PV.SECOPE = PO.ID
        LEFT JOIN ${SCHEMA_BD}.TCLIE C
            ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
        WHERE PO.IDCLI = ?
        ${filtroContratoGesoper}
        GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
        ORDER BY CLIENTE
      `;

      let sqlTotalAsign = `
        SELECT
            TRIM(C.CLINOM) AS CLIENTE,
            TRIM(PO.IDCLI) AS ID_CLIENTE,
            COUNT(PV.ID) AS TOTVEHOP
        FROM ${SCHEMA_BD}.PO_VEHICULO PV
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
            ON PV.SECOPE = PO.ID
        LEFT JOIN ${SCHEMA_BD}.TCLIE C
            ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
        WHERE TRIM(PO.IDCLI) = ?
        AND EXISTS (
            SELECT 1
            FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
            LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE
                ON TAD.ID_OPE = OPE.ID
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TDC
                ON TAD.ID_CONTRATO = TDC.ID AND TRIM(TAD.CLASE_CONTRATO) = 'H'
            WHERE TAD.ID_VEH = PV.ID
            AND TRIM(OPE.IDCLI) = ?
            ${filtroContratoAsign}
        )
        GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
      `;

      const sqlLeasing = `
        SELECT COUNT(*) AS TOTAL_LEASINGS FROM ${SCHEMA_BD}.TBL_LEASING_CAB LC
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON LC.ID_CONTRATO = CC.ID AND LC.TIPCON = 'P'
        WHERE CAST(LC.ID_CLIENTE AS VARCHAR(10)) = ?
        ${contratoId ? `AND CC.ID = ?` : ""}
      `;

      const sqlDocumentos = `
        SELECT COUNT(*) AS TOTAL_DOCUMENTOS FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON CC.ID = DC.ID_PADRE
        WHERE CAST(DC.ID_CLIENTE AS VARCHAR(10)) = ?
        ${contratoId ? `AND CC.ID = ?` : ""}
      `;

      const sqlContrato = `
        SELECT 
          TC.NRO_CONTRATO, 
          TC.DESCRIPCION, 
          TC.FECHA_FIRMA, 
          TC.DURACION, 
          TC.ARCHIVO_PDF 
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TC
        WHERE TC.ID_CLIENTE = ?
        ${contratoId ? `AND TC.ID = ?` : ""}
      `;

      const sqlTotalContrato = `
        SELECT
          SUM(sub.TOTVEH) AS TOTVEH,
          SUM(sub.TOTVEHDOC) AS TOTVEHDOC,
          SUM(sub.TOTVEHGENERAL) AS TOTVEHGENERAL
        FROM (
          SELECT
              TC.CANT_VEHI AS TOTVEH,
              COALESCE(
                  (SELECT SUM(TD2.CANT_VEHI)
                  FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD2
                  WHERE TD2.ID_PADRE = TC.ID),
              0) AS TOTVEHDOC,
              TC.CANT_VEHI + COALESCE(
                  (SELECT SUM(TD2.CANT_VEHI)
                  FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD2
                  WHERE TD2.ID_PADRE = TC.ID),
              0) AS TOTVEHGENERAL
          FROM ${SCHEMA_BD}.TBLCONTRATO_CAB TC
          WHERE TC.ID_CLIENTE = ?
          ${contratoId ? `AND TC.ID = ?` : ""}
        ) sub
      `;

      const sqlPendientes = `
        SELECT COUNT(*) AS TOTAL_PENDIENTES FROM (
          SELECT DISTINCT A.CODINI, A.PLACA, TRIM(D.DESCRIPCION) AS MARCA, TRIM(A.MODELO) AS MODELO, A.NRO_LEASING
          FROM (
            SELECT A.ID, A.ID_CLIENTE, TRIM(B.ID_VEH) AS CODINI, TRIM(B.PLACA) AS PLACA, A.NRO_LEASING, B.ID_VEH, B.MODELO
            FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
            INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B
            ON A.ID = B.ID_LEA_CAB) A
            LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO C
            ON A.ID_VEH = C.ID
            LEFT JOIN ${SCHEMA_BD}.PO_MARCA D
            ON C.IDMAR = D.ID
            LEFT JOIN (
              SELECT * FROM (
                SELECT A.ID, A.ID_CLIENTE, A.NRO_LEASING, A.CANT_VEH, B.PLACA, B.ID_VEH AS VEHICULO
                FROM ${SCHEMA_BD}.TBL_LEASING_CAB A
                INNER JOIN ${SCHEMA_BD}.TBL_LEASING_DET B ON A.ID=B.ID_LEA_CAB) A
                LEFT JOIN (
                  SELECT ID_CLIENTE, ID_ASIGNACION, LEASING, ID_VEH
                  FROM ${SCHEMA_BD}.TBL_ASIGNACION_CAB A
                  INNER JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET B
                  ON A.ID=B.ID_ASIGNACION
                ) B
                ON TRIM(A.NRO_LEASING)=TRIM(B.LEASING) AND A.VEHICULO=B.ID_VEH
              ) E
              ON A.NRO_LEASING=E.LEASING AND A.ID_VEH=E.VEHICULO
          WHERE (A.ID_CLIENTE = ?) AND E.VEHICULO IS NULL
          GROUP BY A.CODINI, A.PLACA, TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.NRO_LEASING
          ORDER BY TRIM(D.DESCRIPCION), TRIM(A.MODELO), A.PLACA
        )
      `;

      const sqlTrazabilidad = `
        SELECT COUNT(DISTINCT VEHICULO) AS TOTAL_VEH_TRAZABILIDAD
        FROM (
            SELECT AD.ID_VEH AS VEHICULO
            FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET AD
            LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
                ON AD.ID_OPE = PO.ID
            WHERE TRIM(PO.IDCLI) = ?

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

      if (roleId == 3) {
        sqlTotalGesoper = `
          SELECT 
              TRIM(C.CLINOM) AS CLIENTE,
              TRIM(PO.IDCLI) AS ID_CLIENTE,
              COUNT(PV.ID) AS TOTVEHOP
          FROM ${SCHEMA_BD}.PO_VEHICULO PV
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
              ON PV.SECOPE = PO.ID
          LEFT JOIN ${SCHEMA_BD}.TCLIE C
              ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
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
              ) PO
              ON MOXU.IDOPERACION = PO.ID
              LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
              ON MOXU.CH_CODI_USUARIO = TUG.USU
              LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
              ON TUG.ID_RL = TRG.ID
              WHERE TUG.USU IS NOT NULL
          ) U
              ON TRIM(PO.IDCLI) = TRIM(U.IDCLI) AND U.ID_OPERACION = PO.ID
          WHERE PO.IDCLI = ?
          AND U.ID_USU = ${idUser}
          ${filtroContratoGesoper}
          GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
          ORDER BY CLIENTE
        `;

        sqlTotalVeh = `
          SELECT
              SUM(CASE WHEN tad.TP_TERRENO = 0 THEN 1 ELSE 0 END) AS TOTAL_VEH_SUP,
              SUM(CASE WHEN tad.TP_TERRENO = 1 THEN 1 ELSE 0 END) AS TOTAL_VEH_SOC,
              SUM(CASE WHEN tad.TP_TERRENO = 2 THEN 1 ELSE 0 END) AS TOTAL_VEH_CIU,
              SUM(CASE WHEN tad.TP_TERRENO = 3 THEN 1 ELSE 0 END) AS TOTAL_VEH_SEV
          FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET tad
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
              ON PO.ID = TAD.ID_OPE
          LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB tdc
              ON tad.ID_CONTRATO = tdc.ID AND TRIM(tad.CLASE_CONTRATO) = 'H'
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
              ON PO.IDCLI = C.IDCLI AND C.ID_OPERACION = PO.ID
          WHERE PO.IDCLI = ?
          AND C.ID_USU = ${idUser}
          ${filtroContrato}
        `;

        sqlTotalAsign = `
          SELECT
              TRIM(C.CLINOM) AS CLIENTE,
              TRIM(PO.IDCLI) AS ID_CLIENTE,
              COUNT(PV.ID) AS TOTVEHOP
          FROM ${SCHEMA_BD}.PO_VEHICULO PV
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
              ON PV.SECOPE = PO.ID
          LEFT JOIN ${SCHEMA_BD}.TCLIE C
              ON TRIM(PO.IDCLI) = TRIM(C.CLICVE)
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
              ) PO
              ON MOXU.IDOPERACION = PO.ID
              LEFT JOIN ${SCHEMA_BD}.T_US_GC tug
              ON MOXU.CH_CODI_USUARIO = TUG.USU
              LEFT JOIN ${SCHEMA_BD}.T_RL_GC trg
              ON TUG.ID_RL = TRG.ID
              WHERE TUG.USU IS NOT NULL
          ) U
              ON TRIM(PO.IDCLI) = TRIM(U.IDCLI) AND U.ID_OPERACION = PO.ID
          WHERE TRIM(PO.IDCLI) = ?
          AND EXISTS (
              SELECT 1
              FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
              LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES OPE
                  ON TAD.ID_OPE = OPE.ID
              LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TDC
                  ON TAD.ID_CONTRATO = TDC.ID AND TRIM(TAD.CLASE_CONTRATO) = 'H'
              WHERE TAD.ID_VEH = PV.ID
              AND TRIM(OPE.IDCLI) = ?
              ${filtroContratoAsign}
          )
          AND U.ID_USU = ${idUser}
          GROUP BY TRIM(C.CLINOM), TRIM(PO.IDCLI)
        `;
      }

      // Construcción de params por query, en el mismo orden que aparecen los "?"
      const paramsGesoper = [clienteId];
      if (contratoId) paramsGesoper.push(contratoId, contratoId);

      const paramsAsign = [clienteId, clienteId];
      if (contratoId) paramsAsign.push(contratoId, contratoId);

      const paramsTraza = [clienteId];
      if (contratoId) paramsTraza.push(contratoId, contratoId);
      paramsTraza.push(clienteId, clienteId);
      if (contratoId) paramsTraza.push(contratoId, contratoId);

      const resultCont = await cn.query(
        sqlContrato,
        contratoId ? [clienteId, contratoId] : [clienteId],
      );
      const resultTotalCont = await cn.query(
        sqlTotalContrato,
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
      const resultTotalGesoper = await cn.query(sqlTotalGesoper, paramsGesoper);
      const resultTotalVeh = await cn.query(sqlTotalVeh, params);
      const resultTotalAssign = await cn.query(sqlTotalAsign, paramsAsign);
      const resultTotalPending = await cn.query(sqlPendientes, [clienteId]);
      const resultTrazabilidad = await cn.query(sqlTrazabilidad, [clienteId, clienteId, clienteId]);

      return {
        contrato: contratoId ? resultCont[0] : null,
        totalCont: resultTotalCont[0],
        documento: resultDoc[0],
        leasing: resultLea[0],
        totalGesoper: resultTotalGesoper[0],
        totalVeh: resultTotalVeh[0],
        totalVehAssign: resultTotalAssign[0],
        totalPending: resultTotalPending[0],
        totalTrazabilidad: resultTrazabilidad[0],
      };
    });

    const {
      contrato,
      totalCont,
      documento,
      leasing,
      totalGesoper,
      totalVeh,
      totalVehAssign,
      totalPending,
      totalTrazabilidad,
    } = data;

    res.json({
      success: true,
      data: {
        isTemp: contrato
          ? contrato.NRO_CONTRATO.trim().toUpperCase().startsWith("CPEN-")
          : false,
        descripcion: contrato ? contrato.DESCRIPCION.trim() : "",
        fechaFirma: contrato ? contrato.FECHA_FIRMA : "",
        duracion: contrato ? contrato.DURACION.trim() : "",
        totalVeh: totalCont.TOTVEH,
        totalVehDoc: totalCont.TOTVEHDOC,
        totalVehGeneral: totalCont.TOTVEHGENERAL,
        vehiculoSup: totalVeh.TOTAL_VEH_SUP,
        vehiculoSev: totalVeh.TOTAL_VEH_SEV,
        vehiculoSoc: totalVeh.TOTAL_VEH_SOC,
        vehiculoCiu: totalVeh.TOTAL_VEH_CIU,
        cantidadDocumentos: documento.TOTAL_DOCUMENTOS,
        cantidadLeasing: leasing.TOTAL_LEASINGS,
        cantidadAsignados: totalVehAssign ? totalVehAssign.TOTVEHOP : 0,
        cantidadGesoper: totalGesoper ? totalGesoper.TOTVEHOP : 0,
        cantidadTrazabilidad: totalTrazabilidad ? totalTrazabilidad.TOTAL_VEH_TRAZABILIDAD : 0,
        pendientes: totalPending.TOTAL_PENDIENTES,
        archivoPdf: contrato ? contrato.ARCHIVO_PDF.trim() : "",
      },
    });
  } catch (error) {
    console.error("Error al obtener los detalles del contrato:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los detalles del contrato",
    });
  }
};

const detailVehByCont = async (req, res) => {
  const { contratoId, tipoTerr } = req.query;

  if (!contratoId)
    return res.status(400).json({
      success: false,
      message: "El parametro contratoId es obligatorio",
    });

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sqlLeasing = `SELECT ID FROM ${SCHEMA_BD}.TBL_LEASING_CAB WHERE ID_CONTRATO = ? AND TIPCON = 'P'`;
      const resultLea = await cn.query(sqlLeasing, [contratoId]);

      if (resultLea.length == 0) return null;

      const cleanLea = resultLea.map((row) => row.ID);
      const placeHolders = resultLea.map(() => "?").join(",");

      let sqlDetLea = `
        SELECT L.MODELO, L.PLACA, L.CANTIDAD, V.ANO, V.COLOR, M.DESCRIPCION AS MARCA, O.DESCRIPCION AS OPERACION, A.FECHA_FIN, LC.NRO_LEASING
        FROM ${SCHEMA_BD}.TBL_LEASING_DET L
        LEFT JOIN ${SCHEMA_BD}.PO_VEHICULO V ON L.ID_VEH = V.ID
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA M ON V.IDMAR = M.ID
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O ON V.IDOPE = O.ID
        LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET A ON L.PLACA = A.PLACA
        LEFT JOIN ${SCHEMA_BD}.TBL_LEASING_CAB LC ON LC.ID = L.ID_LEA_CAB
        WHERE ID_LEA_CAB IN (${placeHolders})
      `;

      const params = [...cleanLea];
      if (tipoTerr) {
        sqlDetLea += ` AND TIPO_TERRENO = ?`;
        params.push(tipoTerr.toUpperCase());
      }

      const resultDet = await cn.query(sqlDetLea, params);
      if (resultDet.length == 0) return [];

      return resultDet.map((row) => ({
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
    });

    if (cleanedResult === null)
      return res
        .status(404)
        .json({ success: false, message: "Sin placas contratadas" });
    if (cleanedResult.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Sin placas encontradas" });
    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener placas por documento",
    });
  }
};

const contContract = async (req, res) => {
  const { clienteId } = req.query;

  try {
    const data = await withConnection(async (cn) => {
      const filter = clienteId ? `WHERE ID_CLIENTE = ?` : ``;
      const sql = `
        SELECT
          (SELECT COUNT(*) FROM ${SCHEMA_BD}.TBLCONTRATO_CAB ${filter}) AS CONTRATOS,
          (SELECT COUNT(*) FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB ${filter}) AS DOCUMENTOS,
          (SELECT COUNT(*) FROM ${SCHEMA_BD}.TBL_LEASING_CAB ${filter}) AS LEASINGS,
          (SELECT COUNT(*) FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB tac ON TAD.ID_ASIGNACION = TAC.ID ${filter}) AS VEHICULOS
        FROM sysibm.sysdummy1
      `;
      const params = clienteId
        ? [clienteId, clienteId, clienteId, clienteId]
        : [];
      const result = await cn.query(sql, params);
      return result[0];
    });

    res.json({
      success: true,
      data: {
        PADRE: data.CONTRATOS,
        TIPO_1: data.DOCUMENTOS,
        TIPO_2: data.LEASINGS,
        TIPO_3: data.VEHICULOS,
      },
    });
  } catch (error) {
    console.error("Error al obtener los contadores:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los contadores" });
  }
};

const contClient = async (req, res) => {
  try {
    const result = await withConnection(async (cn) => {
      return cn.query(`
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
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error al obtener los contadores:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los contadores" });
  }
};

const insertContract = async (req, res) => {
  const { user } = req.user;
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
  const oldKey = archivoPdf;
  const newKey = oldKey.replace(/^temp\//, "");

  try {
    await withConnection(async (cn) => {
      const findContract = await cn.query(
        `SELECT * FROM ${SCHEMA_BD}.TBLCONTRATO_CAB WHERE UPPER(NRO_CONTRATO) = ?`,
        [nroContrato.toUpperCase()],
      );
      if (findContract.length > 0) {
        const err = new Error("El N° contrato ya se encuentra registrado");
        err.statusCode = 409;
        throw err;
      }

      const queryCabecera = `
        INSERT INTO ${SCHEMA_BD}.TBLCONTRATO_CAB
        (ID_CLIENTE, NRO_CONTRATO, CANT_VEHI, FECHA_FIRMA, DURACION, KM_ADI, KM_TOTAL, VEH_SUP, VEH_SEV, VEH_SOC, VEH_CIU, TIPO_CONT, TIPO_CLI, MONEDA, DESCRIPCION, ARCHIVO_PDF, CLASE, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        newKey,
        claseContra,
        user,
        user,
      ]);

      await moveFile(oldKey, newKey);

      const idContratoCab = result.insertId || (await obtenerUltimoId(cn));

      const queryDetalle = `
        INSERT INTO ${SCHEMA_BD}.TBLCONTRATO_DET
        (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, KM_ADI, PRECIO_VEH, PRECIO_VENTA, CONDICION, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            detalle.kmAdicional,
            detalle.compraVeh,
            detalle.precioVeh,
            detalle.condicion,
            user,
            user,
          ]);
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    if (error.statusCode === 409)
      return res.status(409).json({ success: false, message: error.message });
    console.error("Error al insertar contrato:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar contrato" });
  }
};

const updateContract = async (req, res) => {
  const { user } = req.user;
  const { id } = req.params;
  const contractId = Number(id);

  if (isNaN(contractId))
    return res.status(400).json({
      success: false,
      message: "El parametro id no es un dato numérico",
    });

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
  const oldKey = archivoPdf;
  let newKey = oldKey;

  try {
    await withConnection(async (cn) => {
      const sql = `
        SELECT C.*, C.DURACION AS PLAZO, D.*, D.ID AS ID_DET FROM ${SCHEMA_BD}.TBLCONTRATO_CAB C
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_DET D ON C.ID = D.ID_CON_CAB
        WHERE C.ID = ?
      `;
      const findContract = await cn.query(sql, [contractId]);

      if (findContract.length == 0) {
        const err = new Error("No se encontró el contrato solicitado");
        err.statusCode = 404;
        throw err;
      }

      if (
        findContract[0].NRO_CONTRATO.trim().toUpperCase() !=
        nroContrato.toUpperCase()
      ) {
        const findNroContract = await cn.query(
          `SELECT * FROM ${SCHEMA_BD}.TBLCONTRATO_CAB WHERE UPPER(NRO_CONTRATO) = ?`,
          [nroContrato.toUpperCase()],
        );
        if (findNroContract.length > 0) {
          const err = new Error("El N° contrato ya se encuentra registrado");
          err.statusCode = 409;
          throw err;
        }
      }

      if (oldKey.startsWith("temp/")) {
        newKey = oldKey.replace(/^temp\//, "");
        const isExistInTemp = await fileExists(oldKey);
        if (isExistInTemp) await moveFile(oldKey, newKey);
      }

      const queryCabecera = `
        UPDATE ${SCHEMA_BD}.TBLCONTRATO_CAB
        SET ID_CLIENTE = ?, NRO_CONTRATO = ?, CANT_VEHI = ?, FECHA_FIRMA = ?, DURACION = ?, KM_ADI = ?, KM_TOTAL = ?, VEH_SUP = ?, VEH_SEV = ?, VEH_SOC = ?, VEH_CIU = ?, TIPO_CONT = ?, TIPO_CLI = ?, MONEDA = ?, DESCRIPCION = ?, ARCHIVO_PDF = ?, CLASE = ?, ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
        WHERE ID = ?
      `;

      await cn.query(queryCabecera, [
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
        newKey,
        claseContra,
        user,
        contractId,
      ]);

      const detailDelete = [];
      const detailUpdate = [];
      const detailNew = [];

      if (detalles && detalles.length > 0) {
        for (const detalle of detalles) {
          if (!detalle.idDet) detailNew.push(detalle);
          else detailUpdate.push(detalle);
        }
      }

      const paramsDet = detailUpdate.map(() => "?");
      const resultValidDelete = await cn.query(
        `SELECT D.ID FROM ${SCHEMA_BD}.TBLCONTRATO_DET D LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB C ON D.ID_CON_CAB = C.ID WHERE C.ID = ? AND D.ID NOT IN (${paramsDet.join(",")})`,
        [contractId, ...detailUpdate.map((det) => det.idDet)],
      );

      if (resultValidDelete.length > 0)
        resultValidDelete.forEach((row) => detailDelete.push(row.ID));

      const queryUpdDetalle = `
        UPDATE ${SCHEMA_BD}.TBLCONTRATO_DET
        SET SEC_CON = ?, MODELO = ?, TIPO_TERRENO = ?, TARIFA = ?, CPK = ?, RM = ?, CANTIDAD = ?, DURACION = ?, KM_ADI = ?, PRECIO_VEH = ?, PRECIO_VENTA = ?, CONDICION = ?, ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
        WHERE ID = ?
      `;
      for (const detalle of detailUpdate) {
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

      const queryNewDetalle = `
        INSERT INTO ${SCHEMA_BD}.TBLCONTRATO_DET
        (ID_CON_CAB, SEC_CON, MODELO, TIPO_TERRENO, TARIFA, CPK, RM, CANTIDAD, DURACION, KM_ADI, PRECIO_VEH, PRECIO_VENTA, CONDICION, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      for (const detalle of detailNew) {
        await cn.query(queryNewDetalle, [
          contractId,
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
          user,
        ]);
      }

      if (detailDelete.length > 0) {
        const paramsDel = detailDelete.map(() => "?");
        await cn.query(
          `DELETE FROM ${SCHEMA_BD}.TBLCONTRATO_DET WHERE ID IN (${paramsDel.join(",")})`,
          detailDelete,
        );
      }
    });

    res.json({ success: true });
  } catch (error) {
    if (error.statusCode === 404)
      return res.status(404).json({ success: false, message: error.message });
    if (error.statusCode === 409)
      return res.status(409).json({ success: false, message: error.message });
    console.error("Error al insertar contrato:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al insertar contrato" });
  }
};

const getContractById = async (req, res) => {
  const { id } = req.params;
  const contractId = Number(id);

  if (isNaN(contractId))
    return res.status(400).json({
      success: false,
      message: "El parametro id no es un dato numérico",
    });

  try {
    const data = await withConnection(async (cn) => {
      const result = await cn.query(
        `SELECT * FROM ${SCHEMA_BD}.TBLCONTRATO_CAB C WHERE C.ID = ?`,
        [contractId],
      );
      if (result.length == 0) return null;
      const resultDet = await cn.query(
        `SELECT * FROM ${SCHEMA_BD}.TBLCONTRATO_DET D WHERE D.ID_CON_CAB = ?`,
        [contractId],
      );
      return { result, resultDet };
    });

    if (!data)
      return res.status(404).json({
        success: false,
        message: "No se encontró el contrato solicitado",
      });

    const { result, resultDet } = data;
    return res.status(200).json({
      idCliente: result[0].ID_CLIENTE,
      nroContrato: result[0].NRO_CONTRATO.trim(),
      cantVehiculos: result[0].CANT_VEHI || 0,
      fechaFirma: convertirFecha(result[0].FECHA_FIRMA.trim()),
      duracion: result[0].DURACION.trim(),
      kmAdicional: result[0].KM_ADI,
      kmTotal: result[0].KM_TOTAL,
      vehSup: result[0].VEH_SUP,
      vehSev: result[0].VEH_SEV,
      vehSoc: result[0].VEH_SOC,
      vehCiu: result[0].VEH_CIU,
      tipoMoneda: result[0].MONEDA.trim(),
      tipoCliente: result[0].TIPO_CLI.trim(),
      contratoEspecial: result[0].TIPO_CONT,
      story: result[0].DESCRIPCION.trim(),
      archivoPdf: result[0].ARCHIVO_PDF.trim(),
      detalles: resultDet.map((row) => ({
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
        kmAdicional: row.KM_ADI,
        compraVeh: row.PRECIO_VEH,
        precioVeh: row.PRECIO_VENTA,
        condicion: row.CONDICION,
      })),
    });
  } catch (error) {
    console.error("Error al obtener contrato por id", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener contrato por id" });
  }
};

const getContractAdiById = async (req, res) => {
  const { id } = req.params;
  const type = id.split("_")[0];
  const contractId = id.split("_")[1];

  try {
    const data = await withConnection(async (cn) => {
      let sql = "";
      if (type == "P") {
        sql = `SELECT ID, tc.NRO_CONTRATO, DURACION FROM ${SCHEMA_BD}.TBLCONTRATO_CAB tc WHERE ID = ?`;
      } else if (type == "H") {
        sql = `SELECT ID, tc.NRO_DOC AS NRO_CONTRATO, DURACION FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB tc WHERE ID = ?`;
      }
      const result = await cn.query(sql, [contractId]);
      return result[0] || null;
    });

    if (!data)
      return res.status(404).json({
        success: false,
        message: "No se encontró el contrato solicitado",
      });

    return res.status(200).json({
      idCliente: data.ID_CLIENTE,
      nroContrato: data.NRO_CONTRATO.trim(),
      duracion: data.DURACION.trim(),
    });
  } catch (error) {
    console.error("Error al obtener contrato por id", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener contrato por id" });
  }
};

const verifyContractsTemp = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  try {
    const result = await withConnection(async (cn) => {
      let sql = `
        SELECT
          SUM(COUNT(*)) OVER() AS TOTAL_TEMPORALES,
          cl.IDCLI,
          cl.CLINOM AS CLIENTE
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB tc
        LEFT JOIN (
            SELECT DISTINCT A.IDCLI, B.CLINOM
            FROM ${SCHEMA_BD}.PO_OPERACIONES A
            INNER JOIN ${SCHEMA_BD}.TCLIE B
                ON A.IDCLI = B.CLICVE
            WHERE A.ID <> 86
              AND B.CLINOM <> '*** ANULADO ***'
        ) cl
        ON tc.ID_CLIENTE = cl.IDCLI
        WHERE NRO_CONTRATO LIKE '%CPEN-%'
        GROUP BY cl.IDCLI, cl.CLINOM
        ORDER BY cl.CLINOM
      `;

      if (roleId == 3) {
        sql = `
          SELECT
            SUM(COUNT(*)) OVER() AS TOTAL_TEMPORALES,
            cl.IDCLI,
            cl.CLINOM AS CLIENTE
          FROM ${SCHEMA_BD}.TBLCONTRATO_CAB tc
          LEFT JOIN (
            SELECT DISTINCT PO.IDCLI, PO.CLINOM, TUG.ID AS ID_USU
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
          ) cl
          ON tc.ID_CLIENTE = cl.IDCLI
          WHERE tc.NRO_CONTRATO LIKE '%CPEN-%' AND cl.ID_USU = ${idUser}
          GROUP BY cl.IDCLI, cl.CLINOM
          ORDER BY cl.CLINOM
        `;
      }

      return cn.query(sql);
    });

    return res.status(200).json({
      success: true,
      data: {
        total: result[0] ? result[0].TOTAL_TEMPORALES : 0,
        clientes:
          result.length > 0 ? result.map((row) => row.CLIENTE.trim()) : [],
      },
    });
  } catch (error) {
    console.error("Error al verificar contratos temporales", error);
    return res.status(500).json({
      success: false,
      message: "Error al verificar contratos temporales",
    });
  }
};

module.exports = {
  contractNro,
  contractPending,
  contractNroAdi,
  tableContract,
  detailContract,
  detailVehByCont,
  contContract,
  contClient,
  insertContract,
  updateContract,
  getContractById,
  getContractAdiById,
  verifyContractsTemp,
};
