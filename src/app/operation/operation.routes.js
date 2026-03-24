const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const {
  listOperations,
  insertOperation,
  listAssingByContract,
} = require("./operation.controller.js");

Router.get("/operacionesAsig", authenticateToken, listOperations);
Router.get("/asignacionPorContrato", authenticateToken, listAssingByContract)
Router.post("/insertaAsignacion", authenticateToken, insertOperation);

module.exports = Router;
