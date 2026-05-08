const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const validUser = async (req, res, next) => {
  const { id: idUser } = req.user;

  const pool = await connection();
  const cn = await pool.connect();

  try {
    const sql = `
      SELECT TUG.USU AS USUARIO FROM SPEED400AT.T_US_GC tug WHERE TUG.ID = ?
    `;

    const result = await cn.query(sql, [idUser]);

    if (!result[0] || result.length == 0)
      return res
        .status(403)
        .json({ success: false, message: "Acceso no autorizado" });

    next();
  } catch (error) {
  } finally {
    if (cn) await cn.close();
  }
};

module.exports = validUser;
