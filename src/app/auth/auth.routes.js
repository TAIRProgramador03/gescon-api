const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const Router = require("express").Router();
const { login, logout, verify } = require("./auth.controller.js");

Router.post("/login", login);
Router.post("/logout", logout);
Router.get("/verify", authenticateToken, verify);

module.exports = Router;