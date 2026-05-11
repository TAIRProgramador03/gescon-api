const Router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { listModels } = require("./model.controller.js");

Router.get("/modelos", authenticateToken, validUser, listModels);

module.exports = Router;
