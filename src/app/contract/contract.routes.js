const Router = require("express").Router();
const {
  contractNro,
  contractNroAdi,
  tableContract,
  detailContract,
  contContract,
  insertContract,
  contClient,
  valideContractQuantity,
  detailVehByCont,
} = require("./contract.controller.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");

Router.get("/contratosNro", authenticateToken, contractNro);
Router.get("/contratosNroAdi", authenticateToken, contractNroAdi);
Router.get("/tablaContrato", authenticateToken, tableContract);
Router.get("/contratoDetalle", authenticateToken, detailContract);
Router.get("/contContrato", authenticateToken, contContract);
Router.get("/contCliente", authenticateToken, contClient);
Router.get("/placasPorContrato", authenticateToken, detailVehByCont)
Router.post("/insertarContrato", authenticateToken, insertContract);
Router.post(
  "/validaContratoCantidad",
  authenticateToken,
  valideContractQuantity,
);

module.exports = Router;
