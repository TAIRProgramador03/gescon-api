const multer = require("multer");
const mime = require("mime-types");
const router = require("express").Router();
const { fitForKeynua } = require("../../shared/pdfCompressor.js");
const { getToken } = require("../../shared/tokenManager.js");
const { getOneDocument } = require("../../shared/service/firmeasy.js");
const FirmEasySevice = require("../../shared/service/firmeasy.js");
const { URI_FIRMEASY } = require("../../shared/conf.js");

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // techo de entrada

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 5, // máximo 5 archivos por request
  },
});

router.get("/keynua-test-contract/:contractId", async (req, res) => {
  try {
  } catch (error) {
    console.log(error);
    return res
      .status(error.response.status)
      .json({ message: error.response.data.message });
  }
});

router.post(
  "/keynua-test-contract/create-mix",
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: `El archivo excede el límite permitido de ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`,
        });
      }
      if (err) return res.status(500).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    const formdata = JSON.parse(req.body.formdata);
    /* Formato de formdata
      {
        "title": "Titulo de contrato",
        "description": "Una simple descripcion (opcional)",
        "reference": "Una referencia (ej. DOC001) (opcional)",
        "groups": [
          {
            "name": "Nombre para el grupo",
            "type": "signers",
            "signatureTypes": ["video-signature"], // ← video-signature - digital-signature - draw - selfie
            "documentType": "", // ← pe-dni - pe-ce - passport
            "documentSides": "", // ← front - back - both
          }
          //...
        ],
        "users": [
          {
            "name": "Nombre Firmante Empresa",
            "email": "Correo Firmante Empresa",
            "phone": "Codigo+Telefono", // ← ej. 51963258741
            "groups": [""] // ←  nombre del grupo creado en minuscula y separado por guiones
          }
        ],
        chosenNotificationOptions: [""] // ← whatsapp - email - sms
      }
    */

    const convertData = {
      title: formdata.title,
      description: formdata.description,
      reference: formdata.reference,
      templateOptions: {
        stages: [
          {
            groups: formdata.groups,
          },
        ],
      },
      users: formdata.users,
      flags: {
        chosenNotificationOptions: formdata.chosenNotificationOptions,
      },
    };

    const metadata = JSON.parse(req.body.metadata);

    try {
      const documentos = await Promise.all(
        req.files.map(async (file) => {
          // Buscar la metadata que corresponde a este archivo
          const meta = metadata.find((m) => m.fieldName === file.fieldname);
          const ext = mime.extension(file.mimetype);

          let finalBuffer = file.buffer;
          if (file.mimetype === "application/pdf") {
            const { buffer } = await fitForKeynua(file.buffer);
            finalBuffer = buffer;
          }

          return {
            name: `${meta.nombre}.${ext}`,
            base64: finalBuffer.toString("base64"),
          };
        }),
      );

      return res.status(200).json({
        ...convertData,
        documents: documentos,
      });
    } catch (error) {
      console.log(error);
      return res.status(400).json({ error: error.message });
    }
  },
);

router.get("/firmeasy-get-documents", async (req, res) => {
  try {
    const params = req.query;

    const token = await getToken("firmeasy");

    const firmeasy = new FirmEasySevice(token);

    const getDocuments = await firmeasy.getDocuments(params);

    return res.status(200).json(getDocuments);
  } catch (error) {
    if (error.response.data.errorType) {
      console.log(
        "[FIRMEASY] Error al obtener documentos: ",
        error.response.data.message,
      );
      return res
        .status(error.response.data.status)
        .json({ success: false, message: error.response.data.message });
    }

    console.log("[FIRMEASY] Error al obtener documentos: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener documentos" });
  }
});

router.get("/firmeasy-get-document/:documentId", async (req, res) => {
  try {
    const documentId = req.params.documentId;

    const { include } = req.query;

    const qInclude = Array.isArray(include) ? include : [include];

    const token = await getToken("firmeasy");

    const firmeasy = new FirmEasySevice(token);

    const getDocument = await firmeasy.getOneDocument(documentId, qInclude);

    return res.status(200).json(getDocument);
  } catch (error) {
    if (error.response.data.errorType) {
      console.log(
        "[FIRMEASY] Error al obtener documento por ID: ",
        error.response.data.message,
      );
      return res
        .status(error.response.data.status)
        .json({ success: false, message: error.response.data.message });
    }

    console.log("[FIRMEASY] Error al obtener documento por ID: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener documento por ID" });
  }
});

router.post(
  "/firmeasy-create-document",
  (req, res, next) => {
    upload.single("pdf")(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: `El archivo excede el límite permitido de ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`,
        });
      }
      if (err) return res.status(500).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const { data } = req.body;

      const dataParse = JSON.parse(data);

      const file = req.file;

      if (!file)
        return res.status(400).json({
          success: false,
          message: "Es obligatorio enviar un archivo",
        });

      const fileBase64 = file.buffer.toString("base64");

      dataParse.document_pdf_base64 = fileBase64;

      const token = await getToken("firmeasy");

      const firmeasy = new FirmEasySevice(token);

      const newDocument = await firmeasy.createDocument(dataParse);

      return res.status(201).json(newDocument);
    } catch (error) {
      if (error.response.data.errorType) {
        console.log(
          "[FIRMEASY] Error al obtener documento por ID: ",
          error.response.data.message,
        );
        return res
          .status(error.response.data.status)
          .json({ success: false, message: error.response.data.message });
      }

      console.log("[FIRMEASY] Error al crear documento: ", error);
      return res
        .status(500)
        .json({ success: false, message: "Error al crear documento" });
    }
  },
);

router.delete("/firmeasy-delete-document/:documentId", async (req, res) => {
  try {
    const documentId = req.params.documentId;

    const token = await getToken("firmeasy");

    const firmeasy = new FirmEasySevice(token);

    const deleteDocument = await firmeasy.deleteDocument(documentId);

    return res.status(200).json(deleteDocument);
  } catch (error) {
    if (error.response.data.errorType) {
      console.log(
        "[FIRMEASY] Error al obtener documento por ID: ",
        error.response.data.message,
      );
      return res
        .status(error.response.data.status)
        .json({ success: false, message: error.response.data.message });
    }

    console.log("[FIRMEASY] Error al obtener documento por ID: ", error);
    return res
      .status(500)
      .json({ success: false, message: "Error al obtener documento por ID" });
  }
});

module.exports = router;
