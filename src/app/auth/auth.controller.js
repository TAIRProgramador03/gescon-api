const jwt = require("jsonwebtoken");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const bcryptjs = require("bcryptjs");

const login = async (req, res) => {
  // Obtenemos los valores del login desde el cuerpo de la solicitud
  const { dbUser, password } = req.body;

  let cn;

  try {
    cn = await connection();

    // VALIDAR SI EXISTE USUARIO
    const sql = `
      SELECT U.ID, U.USU, U.CLV, U.V_TK, R.DESCRIPCION FROM ${SCHEMA_BD}.T_US_GC U
      JOIN ${SCHEMA_BD}.T_RL_GC R
      ON U.ID_RL = R.ID
      WHERE USU = ?
    `;

    const result = await cn.query(sql, [dbUser]);

    if (result.length == 0)
      return res
        .status(404)
        .json({ success: false, message: "El usuario es incorrecto" });

    if (!result[0].CLV)
      return res.status(403).json({
        success: false,
        message: "El usuario no cuenta con contraseña",
      });

    // VALIDAR SI ES LA CONTRASEÑA
    const hashed = await bcryptjs.compare(password, result[0].CLV);

    if (!hashed)
      return res
        .status(401)
        .json({ success: false, message: "La contraseña es incorrecta" });

    // RETORNAR PERMISOS DE USUARIO
    const sqlPs = `
      SELECT P.DESCRIPCION
      FROM ${SCHEMA_BD}.T_US_GC U
      JOIN ${SCHEMA_BD}.T_RL_GC R ON U.ID_RL = R.ID
      JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON R.ID = RP.ID_RL
      JOIN ${SCHEMA_BD}.T_PS_GC P ON RP.ID_PS = P.ID
      WHERE U.USU = ?
    `;

    const resultPs = await cn.query(sqlPs, [dbUser]);

    const permissions = resultPs.map((row) => row.DESCRIPCION);

    // Si la conexión es exitosa, generamos un token JWT con los datos del usuario
    const payload = {
      id: result[0].ID,
      user: result[0].USU,
      role: result[0].DESCRIPCION,
      tokenVersion: result[0].V_TK,
      permissions,
    };
    const token = jwt.sign(
      payload,
      process.env.SECRET_KEY || "3c0FNs1Md90ueIaYmaAZAC75TM1MD77l2JeffvxQY6w",
      { expiresIn: "24h", algorithm: "HS256" },
    );

    // Configura la cookie con el token JWT
    res.cookie("access_token", token, {
      httpOnly: false,
      secure: false,
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, message: "Ingreso autorizado", permissions });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res.json({
      success: false,
      message: "Ocuarrio un error al intentar ingresar",
    });
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

const logout = async (_req, res) => {
  // Limpiamos la cookie eliminando el token JWT
  res.clearCookie("access_token", {
    httpOnly: false,
    secure: false,
    sameSite: "strict",
  });
  
  res.json({ success: true, message: "Cierre de sesión exitoso" });
};

const verify = async (req, res) => {
  const token = req.cookies.access_token;

  if (!token) return res.status(401).send("No hay token");

  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.SECRET_KEY || "3c0FNs1Md90ueIaYmaAZAC75TM1MD77l2JeffvxQY6w",
    );
  } catch (err) {
    return res.status(403).send("Token inválido");
  }

  const pool = await connection();
  const cn = await pool.connect();

  try {
    const sql = `
      SELECT U.V_TK FROM ${SCHEMA_BD}.T_US_GC U
      WHERE U.ID = ?
    `;

    const result = await cn.query(sql, [decoded.id]);
    const usuario = result[0];

    if (!usuario || decoded.tokenVersion !== usuario.V_TK) {
      return res
        .status(401)
        .json({ success: false, message: "Sesión expirada" });
    }

    return res.status(200).json({
      success: true,
      message: "Token válido",
      globalDbUser: decoded.user,
      role: decoded.role,
      permissions: decoded.permissions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    try {
      if (cn) await cn.close();
    } catch (err) {
      console.error(err);
    }
  }
};

module.exports = {
  login,
  logout,
  verify,
};
