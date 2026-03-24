const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { insertDocument, listDocumentByNroContract, detailDocument, detailVehByDocu, detailVehByCont } = require("./document.controller.js");

Router.get("/documentoPorContrato", authenticateToken, listDocumentByNroContract)
Router.get("/detalleDocumento", authenticateToken, detailDocument)
Router.get("/placasPorDocumento", authenticateToken, detailVehByDocu)
Router.post("/insertarDocumento", authenticateToken, insertDocument);

module.exports = Router;
