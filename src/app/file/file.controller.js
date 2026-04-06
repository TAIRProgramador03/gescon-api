const { s3, getFileUrl, fileExists } = require("../../shared/service/aws-s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const uploadFile = async (req, res) => {
  // const file = req.file;

  // if (!file) {
  //   return res.json({
  //     success: false,
  //     message: "No se recibió ningún archivo",
  //   });
  // }

  const tipo = req.body.documentType?.replace(/\/+$/, "") || "files";
  const nombreSeguro = req.file.originalname.replace(/\s+/g, "-");
  const key = `temp/${tipo}/${Date.now()}-${nombreSeguro}`;
  // const destinoFinal = path.join(process.cwd(), "public/pdf", tipo);
  // fs.mkdirSync(destinoFinal, { recursive: true });
  // const rutaFinal = path.join(destinoFinal, file.originalname);
  // fs.renameSync(file.path, rutaFinal);

  // res.json({
  //   success: true,
  //   message: "Archivo subido correctamente",
  //   ruta: rutaFinal,
  // });

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  await s3.send(new PutObjectCommand(params));

  const url = await getFileUrl(key);

  res.json({
    success: true,
    message: "Archivo subido",
    ruta: url,
    key,
  });
};

const validateFile = async (req, res) => {
  const nombreArchivo = req.query.nombre;

  const isExist = await fileExists(nombreArchivo);

  if (!isExist) {
    return res.status(404).json({
      success: false,
    });
  }

  return res.status(200).json({ success: true });
};

const previewFile = async (req, res) => {
  const key = req.query.key;

  const isExist = await fileExists(key);

  if (!isExist) {
    return res.status(404).json({
      success: false,
      message: "Archivo no encontrado"
    });
  }

  const url = await getFileUrl(key);

  return res.status(200).json({ success: true, url });
};

module.exports = {
  uploadFile,
  validateFile,
  previewFile
};
