const {
  getUsers,
  getPermissionsByUser,
  getRoles,
  getPermissionsByRole,
  putPermissionsByRole,
  getUserById,
  putUser,
  getUserByField,
  postUser,
  getPermissions,
  postRole,
  putPasswordUser,
  getFindUserSystemAccess,
  putStatusAccessSystem,
  postAssignUsersToSystem,
  getListOthersUsers,
} = require("./user.service.js");

const bcryptjs = require("bcryptjs");

/* USUARIOS */

const listUsers = async (_req, res) => {
  try {
    const users = await getUsers();

    return res.status(200).json(
      users.map((user) => ({
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        usuario: user.usuario,
        codEmp: user.codEmp,
        estado: user.estado,
        conClave: user.conClave,
        accesoSistema: user.accesoSistema,
        rol: user.rol,
        sistemas: user.sistemas,
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listOthersUsers = async (_req, res) => {
  try {
    const result = await getListOthersUsers();

    return res.status(200).json(result);
  } catch (error) {
    console.error("[USER] Error al obtener lista de otros usuarios: ", error);
    return res
      .status(500)
      .json({
        message: "Error al obtener lista de otros usuarios",
        error: error.message,
      });
  }
};

const findUserById = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  try {
    const findUser = await getUserById(id);

    if (!findUser)
      return res
        .status(404)
        .json({ success: false, message: "No se encontro el usuario" });

    return res.status(200).json(findUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  const { user } = req.user;
  const body = req.body;
  const { usuario, codEmp, clave } = body;

  try {
    const findUser = await getFindUserSystemAccess(
      { username: usuario },
      { scope: "global" },
    );

    if (findUser)
      return res
        .status(409)
        .json({ message: "Este usuario ya esta registrado en el sistema" });

    const findCode = await getFindUserSystemAccess(
      { codEmp },
      { scope: "global" },
    );

    if (findCode)
      return res
        .status(409)
        .json({ message: "Este codigo ya esta registrado en el sistema" });

    const salt = await bcryptjs.genSalt(Number(process.env.SALT_NUMBER));
    const passHash = await bcryptjs.hash(clave, salt);
    body.clave = passHash;

    const create = await postUser(body, user);

    return res.status(201).json(create);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const assignUsersToSystem = async (req, res) => {
  const { user } = req.user;
  const { usersId, roleId } = req.body;

  if (!Array.isArray(usersId) || usersId.length === 0) {
    return res
      .status(400)
      .json({ message: "Debe enviar al menos un usuario." });
  }

  if (!roleId || !Number.isInteger(Number(roleId))) {
    return res.status(400).json({ message: "Debe indicar un rol valido." });
  }

  try {
    const result = await postAssignUsersToSystem(usersId, roleId, user);

    return res.status(201).json({
      message: "Los usuarios fueron asignados con exito",
      inserted: result.inserted,
    });
  } catch (error) {
    console.error("[USER] Error al asignar usuarios al sistema: ", error);

    if (error.message === "ROLE_NOT_VALID_FOR_SYSTEM") {
      return res
        .status(400)
        .json({ message: "El rol indicado no es valido para este sistema." });
    }

    return res
      .status(500)
      .json({
        message: "Error al asignar usuarios al sistema",
        error: error.message,
      });
  }
};

const updateUser = async (req, res) => {
  const { user } = req.user;

  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  const body = req.body;

  try {
    const update = await putUser(id, body, user);

    return res.status(200).json(update);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updatePasswordUser = async (req, res) => {
  const { user } = req.user;

  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  const body = req.body;

  try {
    const findUser = await getUserById(id);

    if (!findUser)
      return res
        .status(404)
        .json({ success: false, message: "No se encontro al usuario" });

    if (body.password != body.confirm)
      return res.status(400).json({
        success: false,
        message:
          "La contraseña de confirmación no coincide con la contraseña nueva",
      });

    const salt = await bcryptjs.genSalt(Number(process.env.SALT_NUMBER));

    const passHash = await bcryptjs.hash(body.password, salt);

    const update = await putPasswordUser(id, passHash, user);

    return res.status(200).json(update);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ROLES */

const listRoles = async (_req, res) => {
  try {
    const roles = await getRoles();

    return res.status(200).json(roles);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createRole = async (req, res) => {
  const { user } = req.user;

  const body = req.body;

  try {
    const create = await postRole(body, user);

    return res.status(201).json(create);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* PERMISOS */

const listPermissions = async (req, res) => {
  try {
    const permissions = await getPermissions();

    return res.status(200).json(permissions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listPermissionsByUser = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  try {
    const permissions = await getPermissionsByUser(id);

    return res.status(200).json(permissions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listPermissionsByRole = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  try {
    const permissions = await getPermissionsByRole(id);

    return res.status(200).json(permissions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updatePermissionsByRole = async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  const { permissions } = req.body;

  try {
    const update = await putPermissionsByRole(id, permissions);

    if (!update.success)
      return res.status(400).json({
        success: false,
        message: "No se pudo realizar la actualización",
      });

    return res.status(200).json(update);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* SISTEMAS */
const statusAccessSystem = async (req, res) => {
  const { status, userId } = req.body;

  try {
    const target = await getFindUserSystemAccess({ id: userId });
    if (!target)
      return res
        .status(404)
        .json({ message: "El usuario no pertenece a este sistema" });

    if (userId === req.user.id)
      return res
        .status(403)
        .json({ message: "No puede cambiar su propio acceso" });

    if (target.isSuper)
      return res
        .status(403)
        .json({ message: "No se puede modificar el acceso de un super" });

    if (target.hasAccess === status)
      return res.status(409).json({
        message: status
          ? "El usuario ya tiene acceso"
          : "El usuario ya no tiene acceso",
      });

    await putStatusAccessSystem(status, userId);

    return res.status(200).json({
      message: `Se ${status ? "concedio" : "revoco"} el acceso al sistema con exito`,
    });
  } catch (error) {
    console.error(
      "[USER] Error al cambiar el acceso al sistema del usuario: ",
      error,
    );
    return res.status(500).json({
      message: "Error al cambiar el acceso al sistema del usuario",
      error,
    });
  }
};

module.exports = {
  listUsers,
  listOthersUsers,
  findUserById,
  createUser,
  assignUsersToSystem,
  updateUser,
  updatePasswordUser,
  listRoles,
  createRole,
  listPermissions,
  listPermissionsByUser,
  listPermissionsByRole,
  updatePermissionsByRole,
  statusAccessSystem,
};
