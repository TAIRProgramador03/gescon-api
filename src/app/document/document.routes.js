const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { insertDocument, listDocumentByNroContract, detailDocument, detailVehByDocu, detailVehByCont, getDocumentById, updateDocument } = require("./document.controller.js");

Router.get("/documentoPorContrato", authenticateToken, listDocumentByNroContract)
Router.get("/detalleDocumento", authenticateToken, detailDocument)
Router.get("/placasPorDocumento", authenticateToken, detailVehByDocu)
Router.get("/obtenerDocumentoPorId/:id", authenticateToken, getDocumentById)
Router.post("/insertarDocumento", authenticateToken, insertDocument);
Router.put("/actualizarDocumento/:id", authenticateToken, updateDocument);

module.exports = Router;
