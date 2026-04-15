require("dotenv").config();
const crypto = require("crypto");
const odbc = require("odbc");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const fs = require("fs");

const s3 = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

let pool = null;

const conDb = async () => {
  try {
    if (!pool) {
      pool = await odbc.pool({
        connectionString: `
          DSN=QDSN_192.168.5.5;
          UID=GES360;
          PWD=Ge$360;
          System=192.168.5.5;
          CCSID=1208;
          UNICODE=UCS-2
        `,
        initialSize: 10,
        maxSize: 40,
        incrementSize: 5,
      });

      console.log("Pool de conexiones creada");
    }

    return pool;
  } catch (error) {
    console.error("Error de conexión a la base de datos:", error.message);
    throw error;
  }
};

async function migrateContracts() {
  const cn = await conDb();

  try {
    const sql = `
      SELECT ID, TRIM(ARCHIVO_PDF) AS ARCHIVO_PDF FROM SPEED400AT.TBLCONTRATO_CAB tc
      WHERE ARCHIVO_PDF LIKE 'http://%'
    `;

    const result = await cn.query(sql);

    const cleanResult = result.map((row) => {
      const nameFile = row.ARCHIVO_PDF.split("/");

      return {
        id: row.ID,
        file: nameFile.pop(),
      };
    });

    const validados = [];

    for (const item of cleanResult) {
      const { id, file } = item;

      if (!file) {
        console.warn(`⚠️ Archivo inválido en ID: ${id}`);
        continue;
      }

      const ruta = path.join(process.cwd(), "public/pdf/contracts", file);

      if (!fs.existsSync(ruta)) {
        console.warn(`❌ Archivo no encontrado: ${file}`);
        continue; // 🔥 importante, no uses return aquí
      }

      const sanitizedFile =
        file
          .replace(/\s+/g, "-") // espacios → guiones
          .replace(/\.pdf$/i, "") // quitar extensión
          .replace(/\./g, "-") // puntos intermedios → guiones
          .replace(/[^a-zA-Z0-9\-]/g, "-") // caracteres raros → guiones
          .replace(/-+/g, "-") // 🔥 múltiples guiones → uno solo
          .replace(/^-|-$/g, "") + // 🔥 quitar guiones al inicio/fin
        ".pdf";

      const key = `contracts/${id}-${sanitizedFile}`;

      const fileContent = fs.readFileSync(ruta);

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: "application/pdf",
      };

      await s3.send(new PutObjectCommand(params));

      const newUrl = key;

      await cn.query(
        `
          UPDATE SPEED400AT.TBLCONTRATO_CAB
          SET ARCHIVO_PDF = ?
          WHERE ID = ?
        `,
        [newUrl, id],
      );

      console.log(`${key}, SUBIDO Y ACTUALIZADO`);
      validados.push(key);
    }

    console.log(
      `TOTAL: ${cleanResult.length}; VALIDADOS: ${validados.length}; FALLOS: ${cleanResult.length - validados.length};`,
    );
  } catch (error) {
    console.log(error);
  }
}

async function migrateDocuments() {
  const cn = await conDb();

  try {
    const sql = `
      SELECT ID, TRIM(ARCHIVO_PDF) AS ARCHIVO_PDF FROM SPEED400AT.TBLDOCUMENTO_CAB tc
      WHERE ARCHIVO_PDF LIKE 'http://%'
    `;

    const result = await cn.query(sql);

    const cleanResult = result.map((row) => {
      const nameFile = row.ARCHIVO_PDF.split("/");

      return {
        id: row.ID,
        file: nameFile.pop(),
      };
    });

    const validados = [];

    for (const item of cleanResult) {
      const { id, file } = item;

      if (!file) {
        console.warn(`⚠️ Archivo inválido en ID: ${id}`);
        continue;
      }

      const ruta = path.join(process.cwd(), "public/pdf/documents", file);

      if (!fs.existsSync(ruta)) {
        console.warn(`❌ Archivo no encontrado: ${file}`);
        continue; // 🔥 importante, no uses return aquí
      }

      const sanitizedFile =
        file
          .replace(/\s+/g, "-") // espacios → guiones
          .replace(/\.pdf$/i, "") // quitar extensión
          .replace(/\./g, "-") // puntos intermedios → guiones
          .replace(/[^a-zA-Z0-9\-]/g, "-") // caracteres raros → guiones
          .replace(/-+/g, "-") // 🔥 múltiples guiones → uno solo
          .replace(/^-|-$/g, "") + // 🔥 quitar guiones al inicio/fin
        ".pdf";

      const key = `documents/${id}-${sanitizedFile}`;

      const fileContent = fs.readFileSync(ruta);

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: "application/pdf",
      };

      await s3.send(new PutObjectCommand(params));

      const newUrl = key;

      await cn.query(
        `
          UPDATE SPEED400AT.TBLDOCUMENTO_CAB
          SET ARCHIVO_PDF = ?
          WHERE ID = ?
        `,
        [newUrl, id],
      );

      console.log(`${key}, SUBIDO Y ACTUALIZADO`);
      validados.push(key);
    }

    console.log(
      `TOTAL: ${cleanResult.length}; VALIDADOS: ${validados.length}; FALLOS: ${cleanResult.length - validados.length};`,
    );
  } catch (error) {
    console.log(error);
  }
}

async function migrateLeasings() {
  const cn = await conDb();

  try {
    const sql = `
      SELECT ID, TRIM(PDF) AS ARCHIVO_PDF FROM SPEED400AT.TBL_LEASING_CAB
      WHERE PDF LIKE 'http://%' AND ID IN (11, 137, 168, 169)
    `;

    const result = await cn.query(sql);

    const cleanResult = result.map((row) => {
      const nameFile = row.ARCHIVO_PDF.split("/");

      return {
        id: row.ID,
        file: nameFile.pop(),
      };
    });

    const validados = [];

    // cache en memoria (clave: hash)
    const uploadedFiles = new Map();

    for (const item of cleanResult) {
      const { id, file } = item;

      if (!file) {
        console.warn(`⚠️ Archivo inválido en ID: ${id}`);
        continue;
      }

      const ruta = path.join(process.cwd(), "public/pdf/leasings", file);

      if (!fs.existsSync(ruta)) {
        console.warn(`❌ Archivo no encontrado: ${file}`);
        continue;
      }

      const fileContent = fs.readFileSync(ruta);

      // hash único por contenido
      const hash = crypto.createHash("md5").update(fileContent).digest("hex");

      // sanitizar nombre
      const sanitizedFile =
        file
          .replace(/\s+/g, "-")
          .replace(/\.pdf$/i, "")
          .replace(/\./g, "-")
          .replace(/[^a-zA-Z0-9\-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") + ".pdf";

      // key basada en hash (NO en ID)
      const key = `leasings/${hash}-${sanitizedFile}`;

      // verificar cache primero (más rápido)
      if (!uploadedFiles.has(hash)) {
        let exists = true;

        try {
          await s3.send(
            new HeadObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: key,
            }),
          );
        } catch (err) {
          exists = false;
        }

        if (!exists) {
          const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: "application/pdf",
          };

          await s3.send(new PutObjectCommand(params));
          console.log(`Subido: ${key}`);
        } else {
          console.log(`Ya existía en S3: ${key}`);
        }

        // guardar en cache
        uploadedFiles.set(hash, key);
      } else {
        console.log(`Reutilizado desde memoria: ${key}`);
      }

      const newUrl = uploadedFiles.get(hash);

      await cn.query(
        `
          UPDATE SPEED400AT.TBL_LEASING_CAB
          SET PDF = ?
          WHERE ID = ?
        `,
        [newUrl, id],
      );

      validados.push(newUrl);
    }

    console.log(
      `TOTAL: ${cleanResult.length}; VALIDADOS: ${validados.length}; FALLOS: ${cleanResult.length - validados.length};`,
    );
  } catch (error) {
    console.log(error);
  }
}

// migrateContracts();

// migrateDocuments();

// migrateLeasings();
