const Router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { insertDocument, listDocumentByNroContract, detailDocument, detailVehByDocu, detailVehByCont, getDocumentById, updateDocument } = require("./document.controller.js");

Router.get("/documentoPorContrato", authenticateToken, validUser, listDocumentByNroContract)
Router.get("/detalleDocumento", authenticateToken, validUser, detailDocument)
Router.get("/placasPorDocumento", authenticateToken, validUser, detailVehByDocu)
Router.get("/obtenerDocumentoPorId/:id", authenticateToken, validUser, getDocumentById)
Router.post("/insertarDocumento", authenticateToken, validUser, insertDocument);
Router.put("/actualizarDocumento/:id", authenticateToken, validUser, updateDocument);

module.exports = Router;
