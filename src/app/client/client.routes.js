const Router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { listClient, tableClient, tableClientLea, getClientsByContractPending, getClientsByDocumentPending, getClientAbr, updateClientAbr } = require("./client.controller.js");

Router.get("/clientes", authenticateToken, validUser, listClient);
Router.get("/tablaCliente", authenticateToken, validUser, tableClient);
Router.get("/tablaClienteLeas", authenticateToken, validUser, tableClientLea);
Router.get("/clientesContratosPendientes", authenticateToken, validUser, getClientsByContractPending);
Router.get("/clientesDocumentosPendientes", authenticateToken, validUser, getClientsByDocumentPending);
Router.get("/clientesAbr", authenticateToken, validUser, getClientAbr);
Router.put("/actualizarCliente/:id", authenticateToken, validUser, updateClientAbr);

module.exports = Router;