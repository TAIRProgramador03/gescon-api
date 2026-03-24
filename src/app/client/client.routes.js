const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { listClient, tableClient, tableClientLea } = require("./client.controller.js");

Router.get("/clientes", authenticateToken, listClient);
Router.get("/tablaCliente", authenticateToken, tableClient);
Router.get("/tablaClienteLeas", authenticateToken, tableClientLea);

module.exports = Router;