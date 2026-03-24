const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { listModels } = require("./model.controller.js");

Router.get("/modelos", authenticateToken, listModels);

module.exports = Router;
