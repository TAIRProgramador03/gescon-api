const Router = require("express").Router();
const multer = require("multer");
const { uploadFile, validateFile } = require("./file.controller.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const path = require("path");
const fs = require("fs");

// Guarda el archivo temporalmente en la carpeta "tmp" antes de moverlo a su destino final
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const rutaDestino = path.join(process.cwd(), "public/pdf/tmp");
    fs.mkdirSync(rutaDestino, { recursive: true });
    cb(null, rutaDestino);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

// Configura multer para aceptar solo archivos PDF y limitar el tamaño a 5MB
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true); // Aceptar archivo
    } else {
      cb(new Error("Solo se permiten archivos PDF"), false); // Rechazar
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // Limite de tamaño de archivo a 50MB
}).single("archivoPdf");

Router.post(
  "/subirArchivo",
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        console.error("Error al subir el archivo:", err);

        return res.status(500).json({
          success: false,
          message: err.message || "Error al subir el archivo",
        });
      }

      next();
    });
  },
  uploadFile,
);

Router.get("/validarArchivo", authenticateToken, validateFile);

module.exports = Router;
