const Anthropic = require("@anthropic-ai/sdk");
const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const { withConnection } = require("../../shared/utils.js");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const s3 = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// ── Session store (in-memory, TTL 30 min) ─────────────────────────────────
const sessions = new Map();
const TTL = 30 * 60 * 1000;

setInterval(
  () => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (s.expiresAt < now) sessions.delete(id);
    }
  },
  5 * 60 * 1000,
);

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

const SYSTEM_PROMPT = `Eres un asistente especializado en análisis de contratos de alquiler de flota vehicular en Perú.
La empresa es Transportes Angel Ibarcena S.A.C. (TAIR), con clientes como Antamina, Volcan, Southern, PNP VII Región etc.
Los contratos involucran vehículos en tipos de terreno: Superficie, Severo, Socavón y Ciudad.
Responde siempre en español. Sé conciso y cita la sección o página del contrato cuando menciones datos específicos.

LÍMITE DE RESPUESTA:
Tienes un máximo de 2096 tokens para responder. Administra ese espacio así:
- Si el contenido cabe completo, responde con todo el detalle posible.
- Si el contenido es extenso y no cabe completo, prioriza: partes involucradas, vigencia, tarifas, obligaciones críticas y fechas clave. Omite el resto.
- Si tuviste que omitir información por el límite, indica al final: "⚠️ Resumen parcial: el documento contiene más información que no pudo incluirse por límite de capacidad. Puedes consultarme sobre secciones específicas."

FORMATO DE RESPUESTA:
- Usa ## para secciones principales y ### para subsecciones
- Usa tablas markdown para datos comparativos (tarifas, vehículos, plazos)
- Usa listas con - para obligaciones o puntos múltiples
- Usa **negrita** solo para datos clave: fechas, montos, nombres de partes
- No uses bloques de código ni HTML
- No uses emojis
- Separa secciones con ---`;

const PROMPT_RESUMEN = `Genera un resumen ejecutivo de este contrato con los siguientes puntos:
- Partes involucradas (cliente y operación)
- Vigencia: fecha de firma y duración
- Vehículos: cantidad y tipo de terreno por modelo
- Tarifas y CPK pactados por tipo de terreno
- Kilómetros totales y adicionales
- Moneda y condiciones económicas destacadas
- Fechas clave y obligaciones importantes`;

// El PDF siempre va en el primer mensaje con cache_control
// Así Claude lo cachea y las consultas siguientes son mucho más baratas
function buildMessages(pdfBase64, historial) {
  const [first, ...rest] = historial;
  return [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: first.content },
      ],
    },
    ...rest.map((m) => ({ role: m.role, content: m.content })),
  ];
}

async function callClaude(pdfBase64, historial) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2096,
    system: SYSTEM_PROMPT,
    messages: buildMessages(pdfBase64, historial),
  });
  return response.content[0].text;
}

const analiceData = async (req, res) => {
  try {
    let pdfBase64;

    if (req.file) {
      pdfBase64 = req.file.buffer.toString("base64");
    } else {
      const { contratoId, clase = "P" } = req.body;
      if (!contratoId)
        return res.status(400).json({ error: "Falta contratoId" });
      const key = await getS3Key(contratoId, clase);
      pdfBase64 = await getPdfFromS3(key);
    }

    const historial = [{ role: "user", content: PROMPT_RESUMEN }];
    const resumen = await callClaude(pdfBase64, historial);
    historial.push({ role: "assistant", content: resumen });

    const sessionId = uuidv4();
    sessions.set(sessionId, {
      pdfBase64,
      historial,
      expiresAt: Date.now() + TTL,
    });

    res.json({ sessionId, resumen });
  } catch (err) {
    console.error("[AI] /analizar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

const queryData = async (req, res) => {
  try {
    const { sessionId, pregunta } = req.body;
    if (!sessionId || !pregunta)
      return res.status(400).json({ error: "Faltan parámetros" });

    const session = sessions.get(sessionId);
    if (!session)
      return res
        .status(404)
        .json({ error: "Sesión expirada, vuelve a analizar el contrato" });

    session.historial.push({ role: "user", content: pregunta });
    const respuesta = await callClaude(session.pdfBase64, session.historial);
    session.historial.push({ role: "assistant", content: respuesta });
    session.expiresAt = Date.now() + TTL;

    res.json({ respuesta });
  } catch (err) {
    console.error("[AI] /consultar:", err.message);
    res.status(500).json({ error: err.message });
  }
};

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
  analiceData,
  queryData,
  getFileContract,
};
