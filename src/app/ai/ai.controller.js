const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { withConnection } = require("../../shared/utils.js");

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
        `SELECT ARCHIVO_PDF FROM SPEED400AT.${table} WHERE ID = ?`,
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

    res.set("Content-Type", "application/pdf");
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

module.exports = {
  getFileContract,
};
