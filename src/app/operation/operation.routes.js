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

Router.get("/operacionesAsig", authenticateToken, listOperations);
Router.get("/asignacionPorContrato", authenticateToken, listAssingByContract)
Router.post("/insertaAsignacion", authenticateToken, insertOperation);
Router.post("/validaContratoCantidad", authenticateToken, valideAssign);
Router.put("/actualizarAsignacion/:id", authenticateToken, updateAssign);
Router.get("/vehiculosPendientesReasginar", authenticateToken, listVehPending);
Router.post("/traspasarOperacion/:id", authenticateToken, changeOperation)
Router.get("/historialMovimientos/:id", authenticateToken, listReassign)
Router.get("/obtenerReasignacion/:id", authenticateToken, getReassignById)

Router.post("/importarActas", authenticateToken, uploalMasiveRecords);

module.exports = Router;
