const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const { listUsers, listPermissionsByUser, listRoles, listPermissionsByRole, updatePermissionsByRole, findUserById, updateUser, listNewUsers, createUser, listRolesGesoper } = require("./user.controller.js");

/* USUARIOS */
Router.get("/obtenerUsuarios", authenticateToken, listUsers);
Router.get("/obtenerNuevosUsuarios", authenticateToken, listNewUsers);
Router.get("/obtenerUsuarioPorId/:id", authenticateToken, findUserById);
Router.post("/crearUsuario", authenticateToken, createUser);
Router.put("/actualizarUsuario/:id", authenticateToken, updateUser);

/* ROLES */
Router.get("/obtenerRoles", authenticateToken, listRoles);
Router.get("/obtenerRolesGesoper", authenticateToken, listRolesGesoper);

/* PERMISOS */
Router.get("/obtenerPermisosDeUsuario/:id", authenticateToken, listPermissionsByUser);
Router.get("/obtenerPermisosDeRol/:id", authenticateToken, listPermissionsByRole);
Router.put("/actualizarPermisosDeRol/:id", authenticateToken, updatePermissionsByRole);

module.exports = Router;