const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const validUser = async (req, res, next) => {
  const { id: idUser } = req.user;

  const pool = await connection();
  const cn = await pool.connect();

  try {
    const sql = `
      SELECT TUG.USU AS USUARIO, TUG.ID_RL AS ID_ROL FROM SPEED400AT.T_US_GC tug WHERE TUG.ID = ?
    `;

    const result = await cn.query(sql, [idUser]);

    if (!result[0] || result.length == 0)
      return res
        .status(403)
        .json({ success: false, message: "Acceso no autorizado" });

    req.user.roleId = result[0].ID_ROL;

    next();
  } catch (error) {
    console.error("Error al validar usuario", error);

    return res.status(500).json({
      success: false,
      message: "Error al validar usuario",
    });
  } finally {
    try {
        if(cn) await cn.close();
    } catch(err) {
        console.error(err);
    }
  }
};

module.exports = validUser;
