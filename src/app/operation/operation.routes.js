const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const {
  listOperations,
  insertOperation,
  listAssingByContract,
  valideAssign,
  updateAssign,
  listVehPending,
  changeOperation,
  listReassign,
  getReassignById,
  uploalMasiveRecords,
} = require("./operation.controller.js");
const multer = require("multer");
const path = require("path")

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const mimeTypesValidos = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];

    const ext = path.extname(file.originalname).toLowerCase();

    if (
      mimeTypesValidos.includes(file.mimetype) &&
      ext === ".xlsx"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos .xlsx"), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("archivo");

Router.get("/operacionesAsig", authenticateToken, listOperations);
Router.get("/asignacionPorContrato", authenticateToken, listAssingByContract)
Router.post("/insertaAsignacion", authenticateToken, insertOperation);
Router.post("/validaContratoCantidad", authenticateToken, valideAssign);
Router.put("/actualizarAsignacion/:id", authenticateToken, updateAssign);
Router.get("/vehiculosPendientesReasginar", authenticateToken, listVehPending);
Router.post("/traspasarOperacion/:id", authenticateToken, changeOperation)
Router.get("/historialMovimientos/:id", authenticateToken, listReassign)
Router.get("/obtenerReasignacion/:id", authenticateToken, getReassignById)

Router.post("/importarActas", authenticateToken, (req, res, next) => {
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
  }, uploalMasiveRecords);

module.exports = Router;
