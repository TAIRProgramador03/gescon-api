const {
  getUsers,
  getPermissionsByUser,
  getRoles,
  getPermissionsByRole,
  putPermissionsByRole,
  getUserById,
  putUser,
} = require("./user.service.js");

const listUsers = async (req, res) => {
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });

  try {
    const users = await getUsers();

    return res.status(200).json(
      users.map((user) => ({
        id: user.id,
        usuario: user.usuario,
        codEmp: user.codEmp,
        rol: user.rol,
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const findUserById = async (req, res) => {
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });

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

const updateUser = async (req, res) => {
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });

  const id = Number(req.params.id);

  if (isNaN(id))
    return res.status(400).json({
      success: false,
      message: "El parametro id debe ser un numero entero",
    });

  const body = req.body;

  try {
    const update = await putUser(id, body);
    
    return res.status(200).json(update);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listRoles = async (req, res) => {
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });
  try {
    const roles = await getRoles();

    return res.status(200).json(roles);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listPermissionsByUser = async (req, res) => {
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });

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
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });

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
  const { id: idUser } = req.user;

  if (!idUser)
    return res
      .status(401)
      .json({ success: false, message: "Acción no permitida" });

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
  findUserById,
  updateUser,
  listRoles,
  listPermissionsByUser,
  listPermissionsByRole,
  updatePermissionsByRole,
};
