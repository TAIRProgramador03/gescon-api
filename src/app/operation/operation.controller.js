const {
  decodeString,
  obtenerUltimoIdAsigna,
  convertirFecha,
  funcionNumerica,
  funcionParteVar,
  transformType,
  withConnection,
} = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const { moveFile, s3 } = require("../../shared/service/aws-s3.js");
const fs = require("fs/promises");
const path = require("path");
const mime = require("mime-types");
const ExcelJS = require("exceljs");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const listOperations = async (req, res) => {
  const { idCli } = req.query; // Obtiene el idCli de los parámetros de consulta

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const filterCli = idCli ? `AND IDCLI = ?` : "";

      // Consulta los contratos asociados al cliente
      const query = `
      SELECT ID, DESCRIPCION
      FROM ${SCHEMA_BD}.PO_OPERACIONES
      WHERE SITUACION='S' ${filterCli}
    `;
      const result = await cn.query(query, idCli ? [idCli] : []);

      return result.map((row) => {
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
    });

    // Devuelve los contratos como respuesta
    res.json(cleanedResult);
  } catch (error) {
    console.error("Error al obtener las operaciones:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener las operaciones" });
  }
};

const listAssingByContract = async (req, res) => {
  const { id: idUser, roleId } = req.user;

  const { idContrato, idCliente, idLeasing, tipoTerr, status } = req.query;

  if (!idCliente)
    return res.status(400).json({
      success: false,
      message: "El parametro idCliente es obligatorio",
    });

  try {
    const convertResult = await withConnection(async (cn) => {
      const statusArray = typeof status === "string" ? status.split(",") : [];

      let filtrosA = "";
      let filtrosB = "";
      let params = [];

      // filtro obligatorio
      filtrosA += " O.IDCLI = ? AND AD.CLASE_CONTRATO = 'P'";
      filtrosB += " O.IDCLI = ? AND AD.CLASE_CONTRATO = 'H'";
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

      if (status?.length) {
        const conditions = [];

        if (statusArray.includes("A")) {
          conditions.push("(O.ID = V.ID_OPE AND V.ID_OPE != 109)");
        }

        if (statusArray.includes("I")) {
          conditions.push(
            "(O.ID != V.ID_OPE AND V.ID_OPE != 109 AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) < CURRENT_DATE)",
          );
        }

        if (statusArray.includes("PR")) {
          conditions.push(
            "(O.ID != V.ID_OPE AND V.ID_OPE != 109 AND CAST(CC.ID_CLIENTE AS VARCHAR(20)) <> V.IDCLI AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) > CURRENT_DATE)",
          );
        }

        if (statusArray.includes("PA")) {
          conditions.push(
            "(O.ID != V.ID_OPE AND V.ID_OPE != 109 AND CAST(CC.ID_CLIENTE AS VARCHAR(20)) = V.IDCLI AND DATE(SUBSTR(AD.FECHA_FIN, 1, 4) || '-' || SUBSTR(AD.FECHA_FIN, 5, 2) || '-' || SUBSTR(AD.FECHA_FIN, 7, 2)) > CURRENT_DATE)",
          );
        }

        if (statusArray.includes("V")) {
          conditions.push("(V.ID_OPE = 109)");
        }

        if (conditions.length) {
          const filter = ` AND (${conditions.join(" OR ")})`;

          filtrosA += filter;
          filtrosB += filter;
        }
      }

      let sql = `
    SELECT *
    FROM (
      SELECT
        T.*,
        ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
      FROM (
        SELECT
          DISTINCT(AD.ID),
          C.CLINOM AS CLIENTE,
          CC.ID_CLIENTE AS ID_CLIENTE_CONT,
          V.IDCLI AS ID_CLIENTE_OPE,
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
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON AD.ID_CONTRATO = CC.ID AND TRIM(AD.CLASE_CONTRATO) = 'P'
        LEFT JOIN (
          SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM ${SCHEMA_BD}.PO_OPERACIONES A
          INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE
          WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***'
          ORDER BY CLINOM ASC
        ) C
        ON CC.ID_CLIENTE = C.IDCLI
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
        ON O.ID = AD.ID_OPE
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
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
          ON V.SECOPE = O.ID
        ) V
        ON V.ID = AD.ID_VEH
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
        ON MA.ID = V.IDMAR
        LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
        ON MO.ID = V.IDMOD
        WHERE ${filtrosA}

        UNION ALL

        SELECT
          DISTINCT(AD.ID),
          C.CLINOM AS CLIENTE,
          DC.ID_CLIENTE AS ID_CLIENTE_CONT,
          V.IDCLI AS ID_CLIENTE_OPE,
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
        LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
        ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
        LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
        ON DC.ID_PADRE = CC.ID
        LEFT JOIN (
          SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM ${SCHEMA_BD}.PO_OPERACIONES A
          INNER JOIN ${SCHEMA_BD}.TCLIE B ON A.IDCLI=B.CLICVE
          WHERE A.ID<>86 AND B.CLINOM <> '*** ANULADO ***'
          ORDER BY CLINOM ASC
        ) C
        ON DC.ID_CLIENTE = C.IDCLI
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
        ON O.ID = AD.ID_OPE
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
          LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
          ON V.SECOPE = O.ID
        ) V
        ON V.ID = AD.ID_VEH
        LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
        ON MA.ID = V.IDMAR
        LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
        ON MO.ID = V.IDMOD
        WHERE ${filtrosB}
        ) T
      ) X
      WHERE RN = 1
    `;

      if (roleId != 1 && roleId != 2) {
        filtrosA += ` AND C.ID_USU = ${idUser}`;
        filtrosB += ` AND C.ID_USU = ${idUser}`;

        sql = `
        SELECT *
        FROM (
          SELECT
            T.*,
            ROW_NUMBER() OVER(PARTITION BY T.ID ORDER BY T.ID) AS RN
          FROM (
            SELECT
              DISTINCT(AD.ID),
              C.CLINOM AS CLIENTE,
              CC.ID_CLIENTE AS ID_CLIENTE_CONT,
              V.IDCLI AS ID_CLIENTE_OPE,
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
            LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
            ON AD.ID_CONTRATO = CC.ID AND TRIM(AD.CLASE_CONTRATO) = 'P'
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
            ON CC.ID_CLIENTE = C.IDCLI AND C.ID_OPERACION = AD.ID_OPE
            LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
            ON O.ID = AD.ID_OPE
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
              LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
              ON V.SECOPE = O.ID
            ) V
            ON V.ID = AD.ID_VEH
            LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
            ON MA.ID = V.IDMAR
            LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
            ON MO.ID = V.IDMOD
            WHERE ${filtrosA}

            UNION ALL

            SELECT
              DISTINCT(AD.ID),
              C.CLINOM AS CLIENTE,
              DC.ID_CLIENTE AS ID_CLIENTE_CONT,
              V.IDCLI AS ID_CLIENTE_OPE,
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
            LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB DC
            ON AD.ID_CONTRATO = DC.ID AND TRIM(AD.CLASE_CONTRATO) = 'H'
            LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB CC
            ON DC.ID_PADRE = CC.ID
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
            ON DC.ID_CLIENTE = C.IDCLI AND C.ID_OPERACION = AD.ID_OPE
            LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
            ON O.ID = AD.ID_OPE
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
              LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES O
              ON V.SECOPE = O.ID
            ) V
            ON V.ID = AD.ID_VEH
            LEFT JOIN ${SCHEMA_BD}.PO_MARCA MA
            ON MA.ID = V.IDMAR
            LEFT JOIN ${SCHEMA_BD}.PO_MODELO MO
            ON MO.ID = V.IDMOD
            WHERE ${filtrosB}
            ) T
          ) X
          WHERE RN = 1
        `;
      }

      const result = await cn.query(sql, [...params, ...params]);

      return result.map((row) => ({
        cliente: row.CLIENTE ? row.CLIENTE.trim() : "Sin cliente",
        idCliCont: row.ID_CLIENTE_CONT,
        idCliOpe: row.ID_CLIENTE_OPE.trim(),
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
        plazo: row.PLAZO.trim(),
        fechaIni: convertirFecha(row.FECHA_ENTREGA.trim()),
        fechaFin: convertirFecha(row.FECHA_FIN.trim()),
        fechaIniCon: row.FECHA_INI_CONTRATO,
        fechaFinCon: row.FECHA_FIN_CONTRATO,
        tarifa: row.TARIFA,
        moneda: row.MONEDA,
        archivoPdf: row.ARCHIVO_PDF ? row.ARCHIVO_PDF : "",
        condicion: row.CONDICION ? row.CONDICION : "",
      }));
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

const getOperationsByRegion = async (req, res) => {
  const { clienteId } = req.query;

  try {
    await withConnection(async (cn) => {
      const sql = `
        SELECT TUO.DEPARTAMENTO, PO.DESCRIPCION AS OPERACION, COUNT(TAD.ID) AS TOTAL_VEHICULOS 
        FROM ${SCHEMA_BD}.TBL_UBICACION_OPE tuo 
        LEFT JOIN ${SCHEMA_BD}.PO_OPERACIONES po 
          ON TUO.ID_OPE = PO."ID" 
        LEFT JOIN (
          SELECT DISTINCT A.IDCLI, B.CLINOM
          FROM ${SCHEMA_BD}.PO_OPERACIONES A 
          INNER JOIN ${SCHEMA_BD}.TCLIE B 
            ON A.IDCLI = B.CLICVE 
          WHERE A.ID <> 86 
            AND B.CLINOM <> '*** ANULADO ***'
        ) C ON PO.IDCLI = C.IDCLI 
        LEFT JOIN ${SCHEMA_BD}.TBL_ASIGNACION_DET tad 
          ON TUO.ID_OPE = TAD.ID_OPE 
        WHERE TUO.DEPARTAMENTO IS NOT NULL 
          ${clienteId ? "AND C.IDCLI = ?" : ""}
        GROUP BY TUO.DEPARTAMENTO, PO.DESCRIPCION
        ORDER BY TUO.DEPARTAMENTO
      `;

      const rows = await cn.query(sql, clienteId ? [clienteId] : []);

      const grouped = rows.reduce((acc, row) => {
        const { DEPARTAMENTO, OPERACION, TOTAL_VEHICULOS } = row;

        let region = acc.find((r) => r.titulo === DEPARTAMENTO);

        if (!region) {
          region = { titulo: DEPARTAMENTO.trim(), operaciones: [] };
          acc.push(region);
        }

        region.operaciones.push({
          nombre: OPERACION.trim(),
          total_vehiculos: TOTAL_VEHICULOS,
        });

        return acc;
      }, []);

      return res.status(200).json(grouped);
    });
  } catch (error) {
    console.error("Error al obtener operaciones por region", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener operaciones por region",
    });
  }
};

const insertOperation = async (req, res) => {
  const { user } = req.user;

  const { idCliente, detalles } = req.body;

  let fechita = new Date().toISOString().split("T")[0];
  let converFecha = convertirFecha(fechita);

  try {
    await withConnection(async (cn) => {
      const queryCabecera = `
              INSERT INTO ${SCHEMA_BD}.TBL_ASIGNACION_CAB
              (ID_CLIENTE, FECHA, USUARIO, CREADO_POR, ACTUALIZADO_POR)
              VALUES (?, ?, ?, ?, ?)
          `;

      const result = await cn.query(queryCabecera, [
        idCliente,
        converFecha,
        user,
        user,
        user,
      ]);

      const idAsignaCab = result.insertId || (await obtenerUltimoIdAsigna(cn));

      const queryDetalle = `
              INSERT INTO ${SCHEMA_BD}.TBL_ASIGNACION_DET
              (ID_ASIGNACION, ID_VEH, SEC_CON, PLACA, TARIFA, ID_OPE, ID_CONTRATO, TP_TERRENO, FECHA_INI, FECHA_FIN, LEASING, CLASE_CONTRATO, ARCHIVO_PDF, CONDICION, CREADO_POR, ACTUALIZADO_POR)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

      if (detalles && detalles.length > 0) {
        for (let i = 0; i < detalles.length; i++) {
          const detalle = detalles[i];

          let newKey = null;

          if (detalle.archivoPdf) {
            const oldKey = detalle.archivoPdf;
            newKey = oldKey.replace(/^temp\//, "");

            await moveFile(oldKey, newKey);
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
            convertirFecha(detalle.fechaIni),
            convertirFecha(detalle.fechaFin),
            detalle.leasing,
            funcionParteVar(detalle.idContrato),
            newKey,
            detalle.condicion,
            user,
            user,
          ]);
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error al insertar la asignacion vehicular:", error);
    res.status(500).json({
      success: false,
      message: "Error al insertar la asignacion vehicular",
    });
  }
};

const valideAssign = async (req, res) => {
  const { detalles } = req.body;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res
      .status(400)
      .json({ success: false, mensaje: "Detalles faltantes o vacíos" });
  }

  const agrupados = {};
  for (let d of detalles) {
    let clase = funcionParteVar(d.idContrato);

    let idContrato = funcionNumerica(d.idContrato);

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
  }

  try {
    await withConnection(async (cn) => {
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
          // Return early by throwing a special object that we catch outside
          const err = new Error(
            `Contrato no encontrado: ${clase}_${idContrato}`,
          );
          err.statusCode = 404;
          err.responseBody = {
            success: false,
            mensaje: `Contrato no encontrado: ${clase}_${idContrato}`,
          };
          throw err;
        }

        let row = result[0];
        let contadorNuevo = { 0: 0, 1: 0, 2: 0, 3: 0 };

        // Contamos cuántos terrenos de cada tipo existen en el detalle
        terrenos.forEach((tipo) => {
          let t = tipo?.toString();
          if (t in contadorNuevo) contadorNuevo[t]++;
        });

        let validaciones = [
          {
            tipo: "SUPERFICIE",
            cod: "0",
            maximo: row.VEH_SUP,
            actual: row.SUPERFICIE,
          },
          {
            tipo: "SOCAVÓN",
            cod: "1",
            maximo: row.VEH_SOC,
            actual: row.SOCAVON,
          },
          { tipo: "CIUDAD", cod: "2", maximo: row.VEH_CIU, actual: row.CIUDAD },
          { tipo: "SEVERO", cod: "3", maximo: row.VEH_SEV, actual: row.SEVERO },
        ];

        for (let v of validaciones) {
          let nuevos = contadorNuevo[v.cod] || 0;

          if (v.actual + nuevos > v.maximo) {
            const err = new Error(
              `Límite excedido para terreno tipo ${v.tipo}`,
            );
            err.statusCode = 200;
            err.responseBody = {
              success: false,
              mensaje: `Límite excedido para terreno tipo ${v.tipo} en contrato ${clase}_${idContrato}. Permitido: ${v.maximo}, asignados: ${v.actual}, nuevos: ${nuevos}.`,
            };
            throw err;
          }
        }
        // Validación de límite de vehículos
        if (row.CANTIDAD + terrenos.length > row.CANT_VEHI) {
          const err = new Error(`Límite total de vehículos excedido`);
          err.statusCode = 200;
          err.responseBody = {
            success: false,
            mensaje: `Límite total de vehículos excedido para contrato ${clase}_${idContrato}. Máximo: ${row.CANT_VEHI}, asignados: ${row.CANTIDAD}, nuevos: ${terrenos.length}.`,
          };
          throw err;
        }
      }
    });

    return res.json({ success: true });
  } catch (error) {
    if (error.responseBody) {
      return res.status(error.statusCode || 500).json(error.responseBody);
    }
    console.error("Error en validación de contratos:", error);
    return res.status(500).json({
      success: false,
      mensaje: "Error interno del servidor durante la validación",
    });
  }
};

const updateAssign = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });
  }

  const { fechaInicio, fechaFin, condicion, terreno, archivoPdf } = req.body;

  try {
    await withConnection(async (cn) => {
      // await cn.beginTransaction();

      const sqlFind = `
      SELECT CONDICION, ARCHIVO_PDF, TP_TERRENO FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET
      WHERE ID = ?
    `;

      const findAssign = await cn.query(sqlFind, [id]);

      if (!findAssign[0]) {
        const err = new Error("No se encontro la asignación");
        err.statusCode = 404;
        err.responseBody = {
          success: false,
          message: "No se encontro la asignación",
        };
        throw err;
      }

      const sqlMovements = `
      SELECT ID FROM ${SCHEMA_BD}.TBL_REASIGNACION WHERE ID_ASIGNACION = ? ORDER BY ID DESC FETCH FIRST 1 ROW ONLY
    `;

      const findMovement = await cn.query(sqlMovements, [id]);

      const fields = [];
      const params = [];

      if (condicion !== undefined) {
        fields.push(`CONDICION = ?`);
        params.push(condicion);
      }

      if (terreno !== undefined) {
        fields.push(`TP_TERRENO = ?`);
        params.push(terreno);
      }

      if (archivoPdf) {
        fields.push(`ARCHIVO_PDF = ?`);

        let keyFile = archivoPdf;

        if (archivoPdf.startsWith("temp/")) {
          keyFile = archivoPdf.replace(/^temp\//, "");

          await moveFile(archivoPdf, keyFile);
        }

        params.push(keyFile);
      }

      fields.push(`FECHA_INI = ?`, `FECHA_FIN = ?`);
      params.push(convertirFecha(fechaInicio), convertirFecha(fechaFin));

      if (fields.length === 0) {
        const err = new Error("No se detectaron campos para modificar");
        err.statusCode = 400;
        err.responseBody = {
          success: false,
          message: "No se detectaron campos para modificar",
        };
        throw err;
      }

      const sqlUpd = `
      UPDATE ${SCHEMA_BD}.TBL_ASIGNACION_DET
      SET ${fields.join(", ")}
      WHERE ID = ?
    `;

      await cn.query(sqlUpd, [...params, id]);

      if (findMovement[0] && findMovement.length > 0) {
        const findIdMov = findMovement[0].ID;
        const fieldMov = [];
        const paramsMov = [];

        if (condicion !== undefined) {
          fieldMov.push(`SEC_CONDICION = ?`);
          paramsMov.push(condicion);
        }

        if (archivoPdf) {
          fieldMov.push(`SEC_ARCHIVO = ?`);

          let keyFile = archivoPdf;

          if (archivoPdf.startsWith("temp/")) {
            keyFile = archivoPdf.replace(/^temp\//, "");
          }

          paramsMov.push(keyFile);
        }

        const sqlUpdMovement = `
        UPDATE ${SCHEMA_BD}.TBL_REASIGNACION
        SET ${fieldMov.join(", ")}
        WHERE ID = ?
      `;

        await cn.query(sqlUpdMovement, [...paramsMov, findIdMov]);
      }

      // await cn.commit();
    });

    return res
      .status(200)
      .json({ success: true, message: "Actualización realizada" });
  } catch (error) {
    if (error.responseBody) {
      return res.status(error.statusCode || 500).json(error.responseBody);
    }
    // await cn.rollback();
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Error al actualizar las placas: ${error}`,
    });
  }
};

const listVehPending = async (req, res) => {
  const { idCli, idOpe } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      let filtros = "";
      const params = [];

      if (idCli) {
        filtros += "AND TAC.ID_CLIENTE = ?";
        params.push(idCli);
      }

      if (idOpe) {
        filtros += "AND TAD.ID_OPE = ?";
        params.push(idOpe);
      }

      const sql = `
      SELECT
        TAD.ID,
        TAD.ID_VEH,
        TAD.PLACA,
        TAD.ID_CONTRATO,
        COALESCE(TC.NRO_CONTRATO, TD.NRO_DOC) AS CONTRATO,
        COALESCE(TC.DURACION, TD.DURACION) AS PLAZO,
        TAD.CLASE_CONTRATO,
        TAD.TARIFA,
        TAD.CONDICION,
        TAD.TP_TERRENO,
        TAD.ID_OPE AS ID_OPE_ASIGN,
        PA.SECOPE AS ID_OPE_ACTUAL,
        PO.DESCRIPCION AS OPE_ASIGN,
        PO3.DESCRIPCION AS OPE_ACTUAL,
        PO3.IDCLI AS ID_CLIENTE_OPE,
        PA.DESDE AS FECHA_REF,
        TAD.FECHA_INI AS FECHA_INICIO,
        TAD.FECHA_FIN AS FECHA_FIN
      FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
      JOIN (
        SELECT
          IDVEH,
          SECOPE,
          IDOPE,
          DESDE,
          ROW_NUMBER() OVER (
            PARTITION BY IDVEH
            ORDER BY ID DESC
          ) AS RN
        FROM ${SCHEMA_BD}.PO_ASIGNACION
      ) PA
      ON TAD.ID_VEH = PA.IDVEH
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
      ON PO.ID = TAD.ID_OPE
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO3
      ON PO3.ID = PA.SECOPE
      JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB TAC
      ON TAD.ID_ASIGNACION = TAC.ID
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD
      ON TD.ID = TAD.ID_CONTRATO AND TAD.CLASE_CONTRATO = 'H'
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB TC
      ON TC.ID = TAD.ID_CONTRATO AND TAD.CLASE_CONTRATO = 'P'
      WHERE PA.RN = 1 AND TAD.ID_OPE <> PA.SECOPE ${filtros}
      ORDER BY TAD.ID ASC
    `;

      const result = await cn.query(sql, params);

      return result.map((row) => ({
        idAsign: row.ID,
        idVeh: row.ID_VEH,
        placa: row.PLACA.trim(),
        idOpeAsign: row.ID_OPE_ASIGN,
        opeAsign: row.OPE_ASIGN.trim(),
        idOpeActual: row.ID_OPE_ACTUAL,
        opeActual: row.OPE_ACTUAL.trim(),
        idClienteOpe: row.ID_CLIENTE_OPE.trim(),
        fechaRef: row.FECHA_REF,
        idContrato: `${row.CLASE_CONTRATO.trim()}_${row.ID_CONTRATO}`,
        nroContrato: row.CONTRATO.trim(),
        plazoContrato: row.PLAZO.trim(),
        tarifa: row.TARIFA,
        condicion: row.CONDICION.trim(),
        terreno: row.TP_TERRENO,
        fechaInicio: row.FECHA_INICIO.trim(),
        fechaFin: row.FECHA_FIN.trim(),
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Error al obtener las placas pendientes de reasignación: ${error}`,
    });
  }
};

const listVehNoPending = async (req, res) => {
  const { idCli, idOpe } = req.query;

  try {
    const cleanedResult = await withConnection(async (cn) => {
      let filtros = "";
      const params = [];

      if (idCli) {
        filtros += "AND TAC.ID_CLIENTE = ?";
        params.push(idCli);
      }

      if (idOpe) {
        filtros += "AND TAD.ID_OPE = ?";
        params.push(idOpe);
      }

      const sql = `
      SELECT
        TAD.ID,
        TAD.ID_VEH,
        TAD.PLACA,
        TAD.ID_CONTRATO,
        COALESCE(TC.NRO_CONTRATO, TD.NRO_DOC) AS CONTRATO,
        COALESCE(TC.DURACION, TD.DURACION) AS PLAZO,
        TAD.CLASE_CONTRATO,
        TAD.TARIFA,
        TAD.CONDICION,
        TAD.TP_TERRENO,
        TAD.ID_OPE AS ID_OPE_ASIGN,
        PA.SECOPE AS ID_OPE_ACTUAL,
        PO.DESCRIPCION AS OPE_ASIGN,
        PO3.DESCRIPCION AS OPE_ACTUAL,
        PO3.IDCLI AS ID_CLIENTE_OPE,
        PA.DESDE AS FECHA_REF,
        TAD.FECHA_INI AS FECHA_INICIO,
        TAD.FECHA_FIN AS FECHA_FIN,
        TAD.ARCHIVO_PDF AS ACTA
      FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
      JOIN (
        SELECT
          IDVEH,
          SECOPE,
          IDOPE,
          DESDE,
          ROW_NUMBER() OVER (
            PARTITION BY IDVEH
            ORDER BY ID DESC
          ) AS RN
        FROM ${SCHEMA_BD}.PO_ASIGNACION
      ) PA
      ON TAD.ID_VEH = PA.IDVEH
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
      ON PO.ID = TAD.ID_OPE
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO3
      ON PO3.ID = PA.SECOPE
      JOIN ${SCHEMA_BD}.TBL_ASIGNACION_CAB TAC
      ON TAD.ID_ASIGNACION = TAC.ID
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD
      ON TD.ID = TAD.ID_CONTRATO AND TAD.CLASE_CONTRATO = 'H'
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB TC
      ON TC.ID = TAD.ID_CONTRATO AND TAD.CLASE_CONTRATO = 'P'
      WHERE PA.RN = 1 AND TAD.ID_OPE = PA.SECOPE ${filtros}
      ORDER BY TAD.ID ASC
    `;

      const result = await cn.query(sql, params);

      return result.map((row) => ({
        idAsign: row.ID,
        idVeh: row.ID_VEH,
        placa: row.PLACA.trim(),
        idOpeAsign: row.ID_OPE_ASIGN,
        opeAsign: row.OPE_ASIGN.trim(),
        idOpeActual: row.ID_OPE_ACTUAL,
        opeActual: row.OPE_ACTUAL.trim(),
        idClienteOpe: row.ID_CLIENTE_OPE.trim(),
        fechaRef: row.FECHA_REF,
        idContrato: `${row.CLASE_CONTRATO.trim()}_${row.ID_CONTRATO}`,
        nroContrato: row.CONTRATO.trim(),
        plazoContrato: row.PLAZO.trim(),
        fechaInicio: row.FECHA_INICIO.trim(),
        fechaFin: row.FECHA_FIN.trim(),
        tarifa: row.TARIFA,
        condicion: row.CONDICION.trim(),
        terreno: row.TP_TERRENO,
        acta: row.ACTA ? row.ACTA.trim() : null,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Error al obtener las placas pendientes de reasignación: ${error}`,
    });
  }
};

const changeOperation = async (req, res) => {
  const { user } = req.user;

  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });
  }

  const {
    beforeOperation,
    condition,
    contract,
    date,
    dateInit,
    dateFinish,
    file,
    isChecked,
    operation,
    observation,
    tariff,
    terrain,
  } = req.body;

  const convertDate = convertirFecha(date);
  const validFile = file ? file.replace(/^temp\//, "") : null;

  console.log(req.body);

  try {
    await withConnection(async (cn) => {
      const sqlFind = `
      SELECT ID_CONTRATO, CONDICION, CLASE_CONTRATO, TARIFA, ARCHIVO_PDF, TP_TERRENO FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET TAD
      WHERE TAD.ID = ?
      FETCH FIRST 1 ROW ONLY
    `;

      const findAssign = await cn.query(sqlFind, [id]);

      if (!findAssign[0] || findAssign.length === 0) {
        const err = new Error("No se encontro la asignación en el sistema");
        err.statusCode = 404;
        err.responseBody = {
          success: false,
          message: "No se encontro la asignación en el sistema",
        };
        throw err;
      }

      // await cn.beginTransaction();

      if (isChecked) {
        const sqlChangeOpe = `
        UPDATE ${SCHEMA_BD}.TBL_ASIGNACION_DET
        SET ID_OPE = ?, ID_CONTRATO = ?, CONDICION = ?, CLASE_CONTRATO = ?, TARIFA = ?, TP_TERRENO = ?, FECHA_INI = ?, FECHA_FIN = ?, ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
        WHERE ID = ?
      `;

        const sqlInsertReassign = `
        INSERT INTO ${SCHEMA_BD}.TBL_REASIGNACION (ID_OPE, SEC_OPE, ID_CONTRATO, SEC_CONTRATO, TARIFA, SEC_TARIFA, CONDICION, SEC_CONDICION, ARCHIVO, SEC_ARCHIVO, TIPO_CONTRATO, SEC_TIPO_CONTRATO, TERRENO, SEC_TERRENO, FECHA_REASIGNACION, OBSERVACION, ID_ASIGNACION, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

        const oldAssign = {
          id,
          idContrato: findAssign[0].ID_CONTRATO,
          tipo: findAssign[0].CLASE_CONTRATO.trim(),
          condicion: findAssign[0].CONDICION.trim(),
          tarifa: findAssign[0].TARIFA,
          terreno: String(findAssign[0].TP_TERRENO),
          archivo: findAssign[0].ARCHIVO_PDF,
        };

        const newAssing = {
          id,
          idContrato: Number(contract.split("_")[1]),
          tipo: contract.split("_")[0],
          condicion: condition,
          tarifa: Number(tariff),
          terreno: terrain,
          archivo: findAssign[0].ARCHIVO_PDF,
        };

        await cn.query(sqlChangeOpe, [
          operation,
          newAssing.idContrato,
          newAssing.condicion,
          newAssing.tipo,
          newAssing.tarifa,
          newAssing.terreno,
          convertirFecha(dateInit),
          convertirFecha(dateFinish),
          user,
          id,
        ]);

        await cn.query(sqlInsertReassign, [
          beforeOperation,
          operation,
          oldAssign.idContrato,
          newAssing.idContrato,
          oldAssign.tarifa,
          newAssing.tarifa,
          oldAssign.condicion,
          newAssing.condicion,
          oldAssign.archivo,
          newAssing.archivo,
          oldAssign.tipo,
          newAssing.tipo,
          oldAssign.terreno,
          newAssing.terreno,
          convertDate,
          observation,
          id,
          user,
          user,
        ]);
      } else {
        const sqlChangeOpe = `
        UPDATE ${SCHEMA_BD}.TBL_ASIGNACION_DET
        SET ID_OPE = ?, ID_CONTRATO = ?, CONDICION = ?, CLASE_CONTRATO = ?, TARIFA = ?, ARCHIVO_PDF = ?, TP_TERRENO = ?, FECHA_INI = ?, FECHA_FIN = ?, ACTUALIZADO_POR = ?, ACTUALIZADO_EL = CURRENT TIMESTAMP
        WHERE ID = ?
      `;

        const sqlInsertReassign = `
        INSERT INTO ${SCHEMA_BD}.TBL_REASIGNACION (ID_OPE, SEC_OPE, ID_CONTRATO, SEC_CONTRATO, TARIFA, SEC_TARIFA, CONDICION, SEC_CONDICION, ARCHIVO, SEC_ARCHIVO, TIPO_CONTRATO, SEC_TIPO_CONTRATO, TERRENO, SEC_TERRENO, FECHA_REASIGNACION, OBSERVACION, ID_ASIGNACION, CREADO_POR, ACTUALIZADO_POR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

        const oldAssign = {
          id,
          idContrato: findAssign[0].ID_CONTRATO,
          tipo: findAssign[0].CLASE_CONTRATO.trim(),
          condicion: findAssign[0].CONDICION.trim(),
          tarifa: findAssign[0].TARIFA,
          terreno: String(findAssign[0].TP_TERRENO),
          archivo: findAssign[0].ARCHIVO_PDF,
        };

        const newAssing = {
          id,
          idContrato: Number(contract.split("_")[1]),
          tipo: contract.split("_")[0],
          condicion: condition,
          tarifa: Number(tariff),
          terreno: terrain,
          archivo: validFile,
        };

        await cn.query(sqlChangeOpe, [
          operation,
          newAssing.idContrato,
          newAssing.condicion,
          newAssing.tipo,
          newAssing.tarifa,
          newAssing.archivo,
          newAssing.terreno,
          convertirFecha(dateInit),
          convertirFecha(dateFinish),
          user,
          id,
        ]);

        await cn.query(sqlInsertReassign, [
          beforeOperation,
          operation,
          oldAssign.idContrato,
          newAssing.idContrato,
          oldAssign.tarifa,
          newAssing.tarifa,
          oldAssign.condicion,
          newAssing.condicion,
          oldAssign.archivo,
          newAssing.archivo,
          oldAssign.tipo,
          newAssing.tipo,
          oldAssign.terreno,
          newAssing.terreno,
          convertDate,
          observation,
          id,
          user,
          user,
        ]);

        if (file && validFile) {
          await moveFile(file, validFile);
        }
      }

      // await cn.commit();
    });

    return res
      .status(201)
      .json({ success: true, message: "Vehiculo traspasado correctamente" });
  } catch (error) {
    if (error.responseBody) {
      return res.status(error.statusCode || 500).json(error.responseBody);
    }
    // await cn.rollback();

    console.error(error);

    return res.status(500).json({
      success: false,
      message: `Error al cambiar la operación: ${error}`,
    });
  }
};

const listReassign = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });
  }

  try {
    const cleanedResult = await withConnection(async (cn) => {
      const sql = `
      SELECT TR.ID, PO.DESCRIPCION AS OPERACION_ANTERIOR, PO2.DESCRIPCION AS OPERACION_NUEVA, TR.FECHA_REASIGNACION, TR.ARCHIVO
      FROM ${SCHEMA_BD}.TBL_REASIGNACION TR
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
      ON PO.ID = TR.ID_OPE
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO2
      ON PO2.ID = TR.SEC_OPE
      WHERE TR.ID_ASIGNACION = ?
      ORDER BY TR.ID ASC
    `;

      const result = await cn.query(sql, [id]);

      return result.map((row) => ({
        id: row.ID,
        opeAnterior: row.OPERACION_ANTERIOR.trim(),
        opeNueva: row.OPERACION_NUEVA.trim(),
        fecha: row.FECHA_REASIGNACION,
        archivo: row.ARCHIVO,
      }));
    });

    return res.status(200).json(cleanedResult);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: `Error al listar las reasignaciones: ${error}`,
    });
  }
};

const getReassignById = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res
      .status(400)
      .json({ success: false, message: "El parametro id debe ser numerico" });
  }

  try {
    const data = await withConnection(async (cn) => {
      const sql = `
      SELECT
        PO.DESCRIPCION AS OPERACION_ANTERIOR,
        PO2.DESCRIPCION AS OPERACION_NUEVA,
        COALESCE(TC.NRO_CONTRATO, TD.NRO_DOC) AS CONTRATO_ANTERIOR,
        COALESCE(TC2.NRO_CONTRATO, TD2.NRO_DOC) AS CONTRATO_NUEVO,
        TR.TARIFA AS TARIFA_ANTIGUA,
        TR.SEC_TARIFA AS TARIFA_NUEVA,
        TR.CONDICION AS CONDICION_ANTIGUA,
        TR.SEC_CONDICION AS CONDICION_NUEVA,
        TR.TERRENO AS TERRENO_ANTIGUO,
        TR.SEC_TERRENO TERRENO_NUEVO,
        TR.TIPO_CONTRATO AS TIPO_ANTERIOR,
        TR.SEC_TIPO_CONTRATO AS TIPO_NUEVO,
        TR.FECHA_REASIGNACION,
        TR.ARCHIVO AS ARCHIVO_ANTERIOR,
        TR.SEC_ARCHIVO AS ARCHIVO_NUEVO,
        TR.OBSERVACION
      FROM ${SCHEMA_BD}.TBL_REASIGNACION TR
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO
        ON PO.ID = TR.ID_OPE
      JOIN ${SCHEMA_BD}.PO_OPERACIONES PO2
        ON PO2.ID = TR.SEC_OPE
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB TC
        ON TR.ID_CONTRATO = TC.ID
        AND TR.TIPO_CONTRATO = 'P'
      LEFT JOIN ${SCHEMA_BD}.TBLCONTRATO_CAB TC2
        ON TR.SEC_CONTRATO = TC2.ID
        AND TR.SEC_TIPO_CONTRATO = 'P'
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD
        ON TR.ID_CONTRATO = TD.ID
        AND TR.TIPO_CONTRATO = 'H'
      LEFT JOIN ${SCHEMA_BD}.TBLDOCUMENTO_CAB TD2
        ON TR.SEC_CONTRATO = TD2.ID
        AND TR.SEC_TIPO_CONTRATO = 'H'
      WHERE TR.ID = ?
    `;

      return await cn.query(sql, [id]);
    });

    if (!data[0] || data.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "No se encontro la reasignación" });

    return res.status(200).json({
      fecha: data[0].FECHA_REASIGNACION.trim(),
      observacion: data[0].OBSERVACION ? data[0].OBSERVACION.trim() : "",
      anterior: {
        operacion: data[0].OPERACION_ANTERIOR.trim(),
        contrato: data[0].CONTRATO_ANTERIOR.trim(),
        tarifa: data[0].TARIFA_ANTIGUA,
        condicion: transformType(data[0].CONDICION_ANTIGUA.trim(), {
          0: "Titular",
          1: "Retén",
          2: "Logística",
          3: "Pendiente",
        }),
        terreno: transformType(data[0].TERRENO_ANTIGUO.trim(), {
          0: "Superficie",
          1: "Socavón",
          2: "Ciudad",
          3: "Severo",
          4: "Pendiente",
        }),
        tipo: data[0].TIPO_ANTERIOR.trim(),
        archivo: data[0].ARCHIVO_ANTERIOR,
      },
      nuevo: {
        operacion: data[0].OPERACION_NUEVA.trim(),
        contrato: data[0].CONTRATO_NUEVO.trim(),
        tarifa: data[0].TARIFA_NUEVA,
        condicion: transformType(data[0].CONDICION_NUEVA.trim(), {
          0: "Titular",
          1: "Retén",
          2: "Logística",
          3: "Pendiente",
        }),
        terreno: transformType(data[0].TERRENO_NUEVO.trim(), {
          0: "Superficie",
          1: "Socavón",
          2: "Ciudad",
          3: "Severo",
          4: "Pendiente",
        }),
        tipo: data[0].TIPO_NUEVO.trim(),
        archivo: data[0].ARCHIVO_NUEVO,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: `Error al obtener la reasignación por id: ${error}`,
    });
  }
};

const uploalMasiveRecords = async (req, res) => {
  try {
    await withConnection(async (cn) => {
      const carpeta = path.join(
        "G:",
        "SOUTHERN-ACTAS-LEASING",
        "ACTAS DE ENTREGA - SOUTHERN",
        "SPCC",
      );

      const archivos = await fs.readdir(carpeta, { withFileTypes: true });

      const files = [];

      const sql = `
      SELECT ID, PLACA
      FROM ${SCHEMA_BD}.TBL_ASIGNACION_DET
      WHERE PLACA = ? AND ARCHIVO_PDF IS NULL
      FETCH FIRST 1 ROW ONLY
    `;

      for (const item of archivos) {
        if (item.isFile()) {
          let fileRoute = path.join(carpeta, item.name);

          const plate = fileRoute.trim().split(" ")[4];

          const findPlate = await cn.query(sql, [plate.trim()]);

          if (!findPlate[0] || findPlate.length === 0) continue;

          fileRoute = fileRoute.replace(/\\\\/g, "\\"); // doble → simple
          fileRoute = fileRoute.replace(/\//g, "\\"); // por si viene con /

          files.push({
            id: findPlate[0].ID,
            plate,
            file: fileRoute,
          });
        }
      }

      const notUpload = [];

      const sqlUpd = `
      UPDATE ${SCHEMA_BD}.TBL_ASIGNACION_DET
      SET ARCHIVO_PDF = ?
      WHERE ID = ?
    `;

      for (const row of files) {
        const findFile = fs.existsSync(row.file);

        if (!findFile) {
          notUpload.push(row);
          continue;
        }

        const fileBuffer = fs.readFileSync(row.file);
        const fileName = path.basename(row.file);
        const contentType = mime.lookup(row.file) || "application/octet-stream";

        const key = `acta/${row.id}-${fileName}`;

        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        };

        await s3.send(new PutObjectCommand(params));

        await cn.query(sqlUpd, [key, row.id]);
      }

      if (files.length === notUpload.length) {
        const err = new Error("No se importo ningun archivo");
        err.statusCode = 200;
        err.responseBody = {
          success: true,
          message: "No se importo ningun archivo",
          notUpload,
        };
        throw err;
      }

      return { notUpload };
    });

    return res.status(200).json({
      success: true,
      message: "Importación realizada con exito",
    });
  } catch (error) {
    if (error.responseBody) {
      return res.status(error.statusCode || 200).json(error.responseBody);
    }
    console.error(error);
    return res.status(500).json({ message: "Error al importar datos" });
  }
};

module.exports = {
  listOperations,
  listAssingByContract,
  insertOperation,
  valideAssign,
  updateAssign,
  listVehPending,
  listVehNoPending,
  changeOperation,
  listReassign,
  getReassignById,
  uploalMasiveRecords,
  getOperationsByRegion
};
