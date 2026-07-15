const jwt = require("jsonwebtoken");
const { withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD } = require("../../shared/conf.js");
const bcryptjs = require("bcryptjs");

const login = async (req, res) => {
  const { dbUser, password } = req.body;

  try {
    const data = await withConnection(async (cn) => {
      const sql = `
        SELECT U.ID, U.NOMBRE, U.APELLIDO, U.USU, U.CLV, U.V_TK, U.ESTADO, R.DESCRIPCION FROM ${SCHEMA_BD}.T_US_GC U
        JOIN ${SCHEMA_BD}.T_RL_GC R
        ON U.ID_RL = R.ID
        WHERE USU = ?
      `;
      const result = await cn.query(sql, [dbUser]);
      if (result.length == 0)
        return { code: 404, message: "El usuario es incorrecto" };
      if (!result[0].CLV)
        return { code: 403, message: "El usuario no cuenta con contraseña" };

      console.log(result[0].ESTADO);

      if (result[0].ESTADO != 1)
        return { code: 403, message: "El usuario no puede acceder al sistema" };

      const hashed = await bcryptjs.compare(password, result[0].CLV);
      if (!hashed) return { code: 401, message: "La contraseña es incorrecta" };

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

      return { code: 200, user: result[0], permissions };
    });

    if (data.code !== 200)
      return res
        .status(data.code)
        .json({ success: false, message: data.message });

    const payload = {
      id: data.user.ID,
      user: data.user.USU,
      nombre:
        data.user.NOMBRE && data.user.APELLIDO
          ? `${data.user.NOMBRE} ${data.user.APELLIDO}`
          : data.user.USU,
      role: data.user.DESCRIPCION,
      tokenVersion: data.user.V_TK,
      permissions: data.permissions,
    };
    const token = jwt.sign(
      payload,
      process.env.SECRET_KEY || "3c0FNs1Md90ueIaYmaAZAC75TM1MD77l2JeffvxQY6w",
      { expiresIn: "24h", algorithm: "HS256" },
    );

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(200).json({
      success: true,
      message: "Ingreso autorizado",
      permissions: data.permissions,
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res.status(500).json({
      success: false,
      message: "Ocurrio un error al intentar ingresar",
    });
  }
};

const logout = async (_req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
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

  try {
    const usuario = await withConnection(async (cn) => {
      const sql = `SELECT U.V_TK, U.ESTADO FROM ${SCHEMA_BD}.T_US_GC U WHERE U.ID = ?`;
      const result = await cn.query(sql, [decoded.id]);
      return result[0];
    });

    if (!usuario || decoded.tokenVersion !== usuario.V_TK) {
      return res
        .status(401)
        .json({ success: false, message: "Sesión expirada" });
    }

    if (!usuario.ESTADO) {
      return res
        .status(401)
        .json({ success: false, message: "Sesión no válida" });
    }

    return res.status(200).json({
      success: true,
      message: "Token válido",
      globalDbUser: decoded.user,
      role: decoded.role,
      nombre: decoded.nombre,
      permissions: decoded.permissions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, logout, verify };
