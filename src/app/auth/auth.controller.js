const jwt = require("jsonwebtoken");
const { withConnection } = require("../../shared/utils.js");
const { SCHEMA_BD, CODE_SYSTEM } = require("../../shared/conf.js");
const bcryptjs = require("bcryptjs");

const login = async (req, res) => {
  const { dbUser, password } = req.body;

  try {
    const data = await withConnection(async (cn) => {
      const sql = `
        SELECT
          U.ID, U.NOMBRE, U.APELLIDO, U.USU, U.CLV, U.COD_EMP, U.V_TK, U.ACTIVO,
          US.ID_RL, US.ACTIVO AS ACCESO_ACTIVO, R.DESCRIPCION
        FROM ${SCHEMA_BD}.T_US_GC U
        LEFT JOIN (
            SELECT X.ID_US, X.ID_RL, X.ACTIVO
            FROM ${SCHEMA_BD}.T_US_SY_GC X
            INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S
              ON S.ID = X.ID_SYS AND TRIM(S.CODIGO) = ? AND S.ACTIVO = 'S'
        ) US ON US.ID_US = U.ID
        LEFT JOIN ${SCHEMA_BD}.T_RL_GC R ON R.ID = US.ID_RL
        WHERE USU = ?
      `;
      const result = await cn.query(sql, [CODE_SYSTEM, dbUser]);
      if (result.length == 0)
        return { code: 404, message: "El usuario es incorrecto" };
      if (!result[0].CLV)
        return { code: 403, message: "El usuario no cuenta con contraseña" };

      if (result[0].ACTIVO != "1")
        return { code: 403, message: "El usuario no puede acceder al sistema" };

      const hashed = await bcryptjs.compare(password, result[0].CLV);
      if (!hashed) return { code: 401, message: "La contraseña es incorrecta" };

      if (!result[0].ID_RL || result[0].ACCESO_ACTIVO !== "S")
        return {
          code: 403,
          message: "El usuario no tiene acceso a este sistema",
        };

      const sqlPs = `
        SELECT P.DESCRIPCION
        FROM ${SCHEMA_BD}.T_US_SY_GC US
        INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S ON S.ID = US.ID_SYS AND TRIM(S.CODIGO) = ?
        INNER JOIN ${SCHEMA_BD}.T_RL_PS_GC RP ON RP.ID_RL = US.ID_RL
        INNER JOIN ${SCHEMA_BD}.T_PS_GC P ON P.ID = RP.ID_PS AND P.ID_SYS = S.ID
        WHERE US.ID_US = ?
      `;
      const resultPs = await cn.query(sqlPs, [CODE_SYSTEM, result[0].ID]);
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
      httpOnly: false,
      secure: false,
      sameSite: "strict",
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
    httpOnly: false,
    secure: false,
    sameSite: "strict",
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
      const sql = `
        SELECT U.V_TK, U.ACTIVO, US.ACTIVO AS ACCESO_ACTIVO
        FROM ${SCHEMA_BD}.T_US_GC U
        LEFT JOIN (
            SELECT X.ID_US, X.ACTIVO
            FROM ${SCHEMA_BD}.T_US_SY_GC X
            INNER JOIN ${SCHEMA_BD}.T_SYS_G360 S
              ON S.ID = X.ID_SYS AND TRIM(S.CODIGO) = ? AND S.ACTIVO = 'S'
        ) US ON US.ID_US = U.ID
        WHERE U.ID = ?
      `;
      const result = await cn.query(sql, [CODE_SYSTEM, decoded.id]);
      return result[0];
    });

    if (!usuario || decoded.tokenVersion !== usuario.V_TK) {
      return res
        .status(401)
        .json({ success: false, message: "Sesión expirada" });
    }

    if (usuario.ACTIVO != "1") {
      return res
        .status(401)
        .json({ success: false, message: "Sesión no válida" });
    }

    if (usuario.ACCESO_ACTIVO !== "S") {
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
