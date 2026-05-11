const Router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
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
  listVehNoPending,
} = require("./operation.controller.js");

Router.get("/operacionesAsig", authenticateToken, validUser, listOperations);
Router.get("/asignacionPorContrato", authenticateToken, validUser, listAssingByContract)
Router.post("/insertaAsignacion", authenticateToken, validUser, insertOperation);
Router.post("/validaContratoCantidad", authenticateToken, validUser, valideAssign);
Router.put("/actualizarAsignacion/:id", authenticateToken, validUser, updateAssign);
Router.get("/vehiculosPendientesReasginar", authenticateToken, validUser, listVehPending);
Router.get("/vehiculosReasginar", authenticateToken, validUser, listVehNoPending);
Router.post("/traspasarOperacion/:id", authenticateToken, validUser, changeOperation)
Router.get("/historialMovimientos/:id", authenticateToken, validUser, listReassign)
Router.get("/obtenerReasignacion/:id", authenticateToken, validUser, getReassignById)

Router.post("/importarActas", authenticateToken, validUser, uploalMasiveRecords);

module.exports = Router;
