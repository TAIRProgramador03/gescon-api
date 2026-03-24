const path = require("path");
const fs = require("fs");

const uploadFile = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.json({
      success: false,
      message: "No se recibió ningún archivo",
    });
  }

  const tipo = req.body.documentType?.replace(/\/+$/, "") || "";
  const destinoFinal = path.join(process.cwd(), "public/pdf", tipo);
  fs.mkdirSync(destinoFinal, { recursive: true });
  const rutaFinal = path.join(destinoFinal, file.originalname);
  fs.renameSync(file.path, rutaFinal);

  res.json({
    success: true,
    message: "Archivo subido correctamente",
    ruta: rutaFinal,
  });
};

const validateFile = async (req, res) => {
  const nombreArchivo = req.query.nombre;

  if (!nombreArchivo) {
    return res.status(400).json({
      success: false,
      message: "No se proporcionó el nombre del archivo",
    });
  }

  // Ruta absoluta al archivo dentro del directorio 'public/pdf'
  const ruta = path.join(__dirname, "public", "pdf", nombreArchivo);

  // Verificar si el archivo existe
  fs.access(ruta, fs.constants.F_OK, (err) => {
    if (err) {
      return res.json({ success: false });
    } else {
      return res.json({ success: true });
    }
  });
};

module.exports = {
  uploadFile,
  validateFile,
};
