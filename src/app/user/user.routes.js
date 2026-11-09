const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const validUser = require("../../shared/middleware/user-valid.js");
const { listUsers, listPermissionsByUser, listRoles, listPermissionsByRole, updatePermissionsByRole, findUserById, updateUser, updatePasswordUser, createUser, listPermissions, createRole, statusAccessSystem, assignUsersToSystem, listOthersUsers } = require("./user.controller.js");

/* USUARIOS */
Router.get("/obtenerUsuarios", authenticateToken, validUser, listUsers);
Router.get("/obtenerOtrosUsuarios", authenticateToken, validUser, listOthersUsers);
Router.get("/obtenerUsuarioPorId/:id", authenticateToken, validUser, findUserById);
Router.post("/crearUsuario", authenticateToken, validUser, createUser);
Router.post("/asignarUsuarios", authenticateToken, validUser, assignUsersToSystem);
Router.put("/actualizarUsuario/:id", authenticateToken, validUser, updateUser);
Router.put("/actualizarClave/:id", authenticateToken, validUser, updatePasswordUser);

/* ROLES */
Router.get("/obtenerRoles", authenticateToken, validUser, listRoles);
Router.post("/crearRol", authenticateToken, validUser, createRole);

/* PERMISOS */
Router.get("/obtenerPermisos", authenticateToken, validUser, listPermissions);
Router.get("/obtenerPermisosDeUsuario/:id", authenticateToken, validUser, listPermissionsByUser);
Router.get("/obtenerPermisosDeRol/:id", authenticateToken, validUser, listPermissionsByRole);
Router.put("/actualizarPermisosDeRol/:id", authenticateToken, validUser, updatePermissionsByRole);

/* SISTEMAS */
Router.put("/actualizarAccesoSistema", authenticateToken, validUser, statusAccessSystem);

module.exports = Router;