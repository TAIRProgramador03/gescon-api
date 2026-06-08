const { withConnection } = require("../utils.js");
const { SCHEMA_BD } = require("../conf.js");

const validUser = async (req, res, next) => {
  const { id: idUser } = req.user;

  try {
    const row = await withConnection(async (cn) => {
      const sql = `SELECT TUG.USU AS USUARIO, TUG.ID_RL AS ID_ROL FROM SPEED400AT.T_US_GC tug WHERE TUG.ID = ?`;
      const result = await cn.query(sql, [idUser]);
      return result[0];
    });

    if (!row) return res.status(403).json({ success: false, message: "Acceso no autorizado" });

    req.user.roleId = row.ID_ROL;
    next();
  } catch (error) {
    console.error("Error al validar usuario", error);
    return res.status(500).json({ success: false, message: "Error al validar usuario" });
  }
};

module.exports = validUser;
