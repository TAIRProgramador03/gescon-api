const jwt = require("jsonwebtoken");
const connection = require("../../shared/connect.js");
const { SCHEMA_BD } = require("../../shared/conf.js");

const login = async (req, res) => {
  // Obtenemos los valores del login desde el cuerpo de la solicitud
  const { dbUser, password } = req.body;

  // const isSup = dbUser.slice(0, 3);

  // if (dbUser.trim().toLowerCase() !== "gescon" && isSup.trim().toLowerCase() !== "sup") {
  //   return res
  //     .status(401)
  //     .json({ success: false, message: "Usuario no permitido" });
  // }

  let cn;

  try {
    cn = await connection();

    // VALIDAR SI EXISTE USUARIO
    const sql = `
      SELECT * FROM ${SCHEMA_BD}.T_US_GC U
      JOIN ${SCHEMA_BD}.T_RL_GC R
      ON U.ID_RL = R.ID
      WHERE USU = ?
    `;

    const result = await cn.query(sql, [dbUser]);

    if (result.length == 0)
      return res
        .status(404)
        .json({ success: false, message: "El usuario es incorrecto" });

    if(!result[0].CLV) return res.status(403).json({success: false, message: "El usuario no cuenta con contraseña"})

    // VALIDAR SI ES LA CONTRASEÑA
    const sqlClv = `
      SELECT * FROM ${SCHEMA_BD}.T_US_GC
      WHERE USU = ? AND CLV = ?
    `;

    const resultClv = await cn.query(sqlClv, [dbUser, password]);

    if(resultClv.length == 0) return res.status(401).json({success: false, message: "La contraseña es incorrecta"})

    // RETORNAR PERMISOS DE USUARIO
    const sqlPs = `
      SELECT P.DESCRIPCION
      FROM SPEED400AT.T_US_GC U
      JOIN SPEED400AT.T_RL_GC R ON U.ID_RL = R.ID
      JOIN SPEED400AT.T_RL_PS_GC RP ON R.ID = RP.ID_RL
      JOIN SPEED400AT.T_PS_GC P ON RP.ID_PS = P.ID
      WHERE U.USU = ?
    `

    const resultPs = await cn.query(sqlPs, [dbUser]);

    const permissions = resultPs.map(row => row.DESCRIPCION);

    // Si la conexión es exitosa, generamos un token JWT con los datos del usuario
    const payload = {id: result[0].ID, user: result[0].USU, role: result[0].DESCRIPCION, permissions};
    const token = jwt.sign(
      payload,
      process.env.SECRET_KEY || "3c0FNs1Md90ueIaYmaAZAC75TM1MD77l2JeffvxQY6w",
      { expiresIn: "24h", algorithm: "HS256" },
    );

    // Configura la cookie con el token JWT
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, message: "Ingreso autorizado", permissions });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res.json({ success: false, message: "Ocuarrio un error al intentar ingresar" });
  } finally {
    if (cn) {
      await cn.close();
    }
  }
};

const logout = async (_req, res) => {
  // Limpiamos la cookie eliminando el token JWT
  res.clearCookie("access_token");
  res.json({ success: true, message: "Cierre de sesión exitoso" });
};

const verify = async (req, res) => {
  const token = req.cookies.access_token;

  if (!token) return res.status(401).send("No hay token");

  jwt.verify(
    token,
    process.env.SECRET_KEY || "3c0FNs1Md90ueIaYmaAZAC75TM1MD77l2JeffvxQY6w",
    (err, user) => {
      if (err) return res.status(403).send("Token inválido");
      res.status(200).json({
        success: true,
        message: "Token válido",
        globalDbUser: user.user,
        role: user.role,
        permissions: user.permissions
      });
    },
  );
};

module.exports = {
  login,
  logout,
  verify,
};
