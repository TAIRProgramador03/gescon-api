const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { listUsers, listPermissionsByUser, listRoles, listPermissionsByRole, updatePermissionsByRole, findUserById, updateUser, listNewUsers } = require("./user.controller.js");

Router.get("/obtenerUsuarios", authenticateToken, listUsers);
Router.get("/obtenerNuevosUsuarios", authenticateToken, listNewUsers);
Router.get("/obtenerUsuarioPorId/:id", authenticateToken, findUserById);
Router.put("/actualizarUsuario/:id", authenticateToken, updateUser);
Router.get("/obtenerRoles", authenticateToken, listRoles);
Router.get("/obtenerPermisosDeUsuario/:id", authenticateToken, listPermissionsByUser);
Router.get("/obtenerPermisosDeRol/:id", authenticateToken, listPermissionsByRole);
Router.put("/actualizarPermisosDeRol/:id", authenticateToken, updatePermissionsByRole);

module.exports = Router;