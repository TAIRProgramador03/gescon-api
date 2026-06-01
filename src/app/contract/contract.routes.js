const Router = require("express").Router();
const {
  contractNro,
  contractNroAdi,
  tableContract,
  detailContract,
  contContract,
  insertContract,
  contClient,
  detailVehByCont,
  getContractById,
  getContractAdiById,
  updateContract,
  verifyContractsTemp,
} = require("./contract.controller.js");
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");

Router.get("/contratosNro", authenticateToken, validUser, contractNro);
Router.get("/contratosNroAdi", authenticateToken, validUser, contractNroAdi);
Router.get("/tablaContrato", authenticateToken, validUser, tableContract);
Router.get("/contratoDetalle", authenticateToken, validUser, detailContract);
Router.get("/contContrato", authenticateToken, validUser, contContract);
Router.get("/contCliente", authenticateToken, validUser, contClient);
Router.get("/placasPorContrato", authenticateToken, validUser, detailVehByCont)
Router.post("/insertarContrato", authenticateToken, validUser, insertContract);
Router.put("/actualizarContrato/:id", authenticateToken, validUser, updateContract);
Router.get("/contratoPorId/:id", authenticateToken, validUser, getContractById)
Router.get("/contratoAdiPorId/:id", authenticateToken, validUser, getContractAdiById)
Router.get("/verificarContratosTemp", authenticateToken, validUser, verifyContractsTemp)

module.exports = Router;
