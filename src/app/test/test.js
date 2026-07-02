const multer = require("multer");
const mime = require("mime-types");
const router = require("express").Router();
const { getContactById } = require("../../shared/service/keynua/require.js");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4.5 * 1024 * 1024, // 10MB en bytes
    files: 5, // máximo 5 archivos por request
  },
});

router.get("/keynua-test-contract/:contractId", async (req, res) => {
  try {
    const contractId = req.params.contractId;

    const data = await getContactById(contractId);

    const findItem = data.items.find((itm) => itm.type == "pdf");

    const transformData = {
      id: data.id,
      accountId: data.accountId,
      sentBy: data.sentBy,
      templateId: data.templateId,
      createdAt: data.createdAt,
      startedAt: data.startedAt,
      title: data.title,
      description: data.description,
      finishedAt: data.finishedAt,
      deletedAt: data.deletedAt,
      canceledAt: data.canceledAt,
      expired: data.expired,
      groups: data.groups,
      users: data.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        groups: user.groups,
        token: user.token,
        state: user.state,
        documentNumber: user.documentNumber,
      })),
      items: findItem ?? null,
      status: data.status,
    };

    return res.status(200).json(transformData);
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
          error: `El archivo excede el límite permitido de 4.5MB`,
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

    const documentos = req.files.map((file) => {
      // Buscar la metadata que corresponde a este archivo
      const meta = metadata.find((m) => m.fieldName === file.fieldname);
      const ext = mime.extension(file.mimetype);

      return {
        name: `${meta.nombre}.${ext}`,
        base64: file.buffer.toString("base64"),
      };
    });

    return res.status(200).json({
      ...convertData,
      documents: documentos,
    });
  },
);

module.exports = router;
