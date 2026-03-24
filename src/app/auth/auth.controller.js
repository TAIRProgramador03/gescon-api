const jwt = require("jsonwebtoken");
const connection = require("../../shared/connect.js");

const login = async (req, res) => {
  // Obtenemos los valores del login desde el cuerpo de la solicitud
  const { dbUser, password } = req.body;

  const isSup = dbUser.slice(0, 3);

  if (dbUser.trim().toLowerCase() !== "gescon" && isSup.trim().toLowerCase() !== "sup") {
    return res
      .status(401)
      .json({ success: false, message: "Usuario no permitido" });
  }

  let cn;

  try {
    cn = await connection(dbUser, password);

    // Si la conexión es exitosa, generamos un token JWT con los datos del usuario
    const payload = { globalDbUser: dbUser, globalPassword: password };
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
    res.json({ success: true, message: "Conexión exitosa" });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res.json({ success: false, message: "Error al iniciar sesión" });
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
        globalDbUser: user.globalDbUser,
      });
    },
  );
};

module.exports = {
  login,
  logout,
  verify,
};
