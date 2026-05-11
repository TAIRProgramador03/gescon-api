const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const Router = require("express").Router();
const { login, logout, verify } = require("./auth.controller.js");

Router.post("/login", login);
Router.post("/logout", logout);
Router.get("/verify", authenticateToken, validUser, verify);

module.exports = Router;