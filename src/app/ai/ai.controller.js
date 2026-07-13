const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const s3 = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function getPdfFromS3(s3Key) {
  const { Body } = await s3.send(
    new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: s3Key }),
  );
  const chunks = [];
  for await (const chunk of Body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("base64");
}

function getS3Key(contratoId, clase) {
  return new Promise((resolve, reject) => {
    const table = clase === "H" ? "TBLDOCUMENTO_CAB" : "TBLCONTRATO_CAB";
    withConnection((db) => {
      db.query(
        `SELECT ARCHIVO_PDF FROM ${SCHEMA_BD}.${table} WHERE ID = ?`,
        [contratoId],
        (err, rows) => {
          if (err) return reject(err);
          const key = rows?.[0]?.ARCHIVO_PDF?.trim();
          if (!key)
            return reject(new Error("Este contrato no tiene PDF adjunto"));
          resolve(key);
        },
      );
    });
  });
}

const getFileContract = async (req, res) => {
  try {
    const { contratoId, clase = "P" } = req.query;
    if (!contratoId) return res.status(400).json({ error: "Falta contratoId" });

    const key = await getS3Key(contratoId, clase);
    const pdfBase64 = await getPdfFromS3(key);
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    const result = await withConnection(async (cn) => {
      const sql = `
        SELECT * FROM (
          SELECT TC.ID AS ID_DOC, TC.NRO_CONTRATO AS NUMERO, C.CLINOM AS CLIENTE, 'P' AS CLASE FROM SPEED400AT.TBLCONTRATO_CAB tc
        LEFT JOIN (
          SELECT DISTINCT PO.IDCLI, TC.CLINOM
          FROM SPEED400AT.PO_OPERACIONES PO
          INNER JOIN SPEED400AT.TCLIE TC
          ON PO.IDCLI = TC.CLICVE
          WHERE PO.ID <> 86
          AND TC.CLINOM <> '*** ANULADO ***'
        ) C
        ON C.IDCLI = CAST(TC.ID_CLIENTE AS CHAR(10))

        UNION ALL

        SELECT TC.ID AS ID_DOC, TC.NRO_DOC AS NUMERO, C.CLINOM AS CLIENTE, 'H' AS CLASE FROM SPEED400AT.TBLDOCUMENTO_CAB tc
        LEFT JOIN (
          SELECT DISTINCT PO.IDCLI, TC.CLINOM
          FROM SPEED400AT.PO_OPERACIONES PO
          INNER JOIN SPEED400AT.TCLIE TC
          ON PO.IDCLI = TC.CLICVE
          WHERE PO.ID <> 86
          AND TC.CLINOM <> '*** ANULADO ***'
        ) C
        ON C.IDCLI = CAST(TC.ID_CLIENTE AS CHAR(10))
        ) WHERE ID_DOC = ? AND CLASE = ?
      `;

      const result = await cn.query(sql, [contratoId, clase]);

      if (result.length == 0 || !result[0]) return null;

      return result.map((res) => ({
        numero: result[0].NUMERO,
        cliente: result[0].CLIENTE,
      }));
    });

    res.set("Content-Type", "application/pdf");
    res.set("X-Nro-Documento", encodeURIComponent(result.numero || ""));
    res.set("X-Cliente", encodeURIComponent(result.cliente || ""));
    res.set(
      "Content-Disposition",
      `inline; filename="contrato-${contratoId}.pdf"`,
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[AI] /consultar:", error.message);
    res.status(500).json({ error: error.message });
  }
};

const TIPO_DOC_LABELS = {
  1: "Adenda",
  2: "Carta",
  3: "Orden de Compra",
  4: "Orden de Servicio",
  5: "Orden de Cambio",
};

const MOTIVO_LABELS = {
  1: "Ampliación",
  2: "Renovación",
  3: "Cambio de datos del cliente",
  4: "Actualización de condiciones",
  5: "Devolución",
};

const getContratosPorVencer = async (req, res) => {
  try {
    const result = await withConnection(async (cn) => {
      const query = `
      SELECT * FROM (
        SELECT
          tc.ID AS contratoId,
          tc.NRO_CONTRATO AS numero,
          cl.CLINOM AS cliente,
          tc.FECHA_FIRMA,
          CAST(tc.DURACION AS INT) AS duracion_meses,
          (DATE(SUBSTR(tc.FECHA_FIRMA,1,4) || '-' || SUBSTR(tc.FECHA_FIRMA,5,2) || '-' || SUBSTR(tc.FECHA_FIRMA,7,2))
            + CAST(tc.DURACION AS INT) MONTHS) AS fecha_vencimiento,
          'CONTRATO' AS tipo,
          CAST(NULL AS INTEGER) AS tipo_doc,
          CAST(NULL AS INTEGER) AS motivo,
          CAST(NULL AS INTEGER) AS id_padre
        FROM ${SCHEMA_BD}.TBLCONTRATO_CAB tc
        JOIN ${SCHEMA_BD}.TCLIE cl ON cl.CLICVE = CAST(tc.ID_CLIENTE AS CHAR(10))

        UNION ALL

        SELECT
          td.ID AS contratoId,
          td.NRO_DOC AS numero,
          cl.CLINOM AS cliente,
          td.FECHA_FIRMA,
          CAST(td.DURACION AS INT) AS duracion_meses,
          (DATE(SUBSTR(td.FECHA_FIRMA,1,4) || '-' || SUBSTR(td.FECHA_FIRMA,5,2) || '-' || SUBSTR(td.FECHA_FIRMA,7,2))
            + CAST(td.DURACION AS INT) MONTHS) AS fecha_vencimiento,
          'DOCUMENTO' AS tipo,
          td.TIPO_DOC AS tipo_doc,
          CAST(td.MOTIVO AS INT) AS motivo,
          td.ID_PADRE AS id_padre
        FROM ${SCHEMA_BD}.TBLDOCUMENTO_CAB td
        JOIN ${SCHEMA_BD}.TCLIE cl ON cl.CLICVE = CAST(td.ID_CLIENTE AS CHAR(10))
      ) resultado
      WHERE fecha_vencimiento IN (
        CURRENT DATE + 7 DAYS,
        CURRENT DATE + 15 DAYS,
        CURRENT DATE + 30 DAYS
      )
      ORDER BY fecha_vencimiento ASC
      `;

      const rows = await cn.query(query); // ajusta al wrapper ODBC que ya usas

      const contratos = rows.map((r) => ({
        ...r,
        dias_restantes: Math.ceil(
          (new Date(r.FECHA_VENCIMIENTO) - new Date()) / (1000 * 60 * 60 * 24),
        ),
        tipo_doc_label: r.TIPO_DOC ? TIPO_DOC_LABELS[r.TIPO_DOC] : null,
        motivo_label: r.MOTIVO ? MOTIVO_LABELS[r.MOTIVO] : null,
      }));

      return contratos;
    });

    return res
      .status(200)
      .json({ success: true, total: result.length, contratos: result });
  } catch (error) {
    console.error("[Alertas] /proximos-vencer:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getFileContract,
  getContratosPorVencer,
};
