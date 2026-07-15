const {
  getUsers,
  getPermissionsByUser,
  getRoles,
  getPermissionsByRole,
  putPermissionsByRole,
  getUserById,
  putUser,
  getNewUsers,
  getUserByField,
  postUser,
  postUserGesoper,
  getRolesGesoper,
  getUserGesoperByField,
  getPermissions,
  postRole,
  putPasswordUser,
} = require("./user.service.js");

const bcryptjs = require("bcryptjs");

/* USUARIOS */

const listUsers = async (req, res) => {
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
        rol: user.rol,
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listNewUsers = async (req, res) => {
  try {
    const users = await getNewUsers();

    return res.status(200).json(users);
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: error.message });
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

  try {
    const findUsername = await getUserByField("usuario", body.usuario);

    if (findUsername)
      return res.status(409).json({
        success: false,
        message: "El usuario ingresado ya se encuentra registrado",
      });

    if (body.inGesoper) {
      const findUsernameGesoper = await getUserGesoperByField(
        "usuario",
        body.usuario,
      );

      if (findUsernameGesoper)
        return res.status(409).json({
          success: false,
          message:
            "El usuario ingresado ya se encuentra registrado dentro del GesOper",
        });

      await postUserGesoper(body);
    }

    const salt = await bcryptjs.genSalt(Number(process.env.SALT_NUMBER));

    const passHash = await bcryptjs.hash(body.clave, salt);

    body.clave = passHash;

    const create = await postUser(body, user);

    return res.status(201).json(create);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
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

const listRoles = async (req, res) => {
  try {
    const roles = await getRoles();

    return res.status(200).json(roles);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listRolesGesoper = async (req, res) => {
  try {
    const roles = await getRolesGesoper();

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

module.exports = {
  listUsers,
  listNewUsers,
  findUserById,
  createUser,
  updateUser,
  updatePasswordUser,
  listRoles,
  listRolesGesoper,
  createRole,
  listPermissions,
  listPermissionsByUser,
  listPermissionsByRole,
  updatePermissionsByRole,
};
