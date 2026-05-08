const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const validUser = require("../../shared/middleware/user-valid.js");
const { listUsers, listPermissionsByUser, listRoles, listPermissionsByRole, updatePermissionsByRole, findUserById, updateUser, listNewUsers, createUser, listRolesGesoper, listPermissions, createRole } = require("./user.controller.js");

/* USUARIOS */
Router.get("/obtenerUsuarios", authenticateToken, validUser, listUsers);
Router.get("/obtenerNuevosUsuarios", authenticateToken, validUser, listNewUsers);
Router.get("/obtenerUsuarioPorId/:id", authenticateToken, validUser, findUserById);
Router.post("/crearUsuario", authenticateToken, validUser, createUser);
Router.put("/actualizarUsuario/:id", authenticateToken, validUser, updateUser);

/* ROLES */
Router.get("/obtenerRoles", authenticateToken, validUser, listRoles);
Router.get("/obtenerRolesGesoper", authenticateToken, validUser, listRolesGesoper);
Router.post("/crearRol", authenticateToken, validUser, createRole);

/* PERMISOS */
Router.get("/obtenerPermisos", authenticateToken, validUser, listPermissions);
Router.get("/obtenerPermisosDeUsuario/:id", authenticateToken, validUser, listPermissionsByUser);
Router.get("/obtenerPermisosDeRol/:id", authenticateToken, validUser, listPermissionsByRole);
Router.put("/actualizarPermisosDeRol/:id", authenticateToken, validUser, updatePermissionsByRole);

module.exports = Router;