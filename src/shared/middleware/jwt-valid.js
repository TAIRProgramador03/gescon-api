const jwt = require("jsonwebtoken");
const secret =
  process.env.SECRET_KEY || "3c0FNs1Md90ueIaYmaAZAC75TM1MD77l2JeffvxQY6w";

const authenticateToken = (req, res, next) => {
  // Extrae el token del encabezado de autorización
  const token = req.cookies.access_token;
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Token no proporcionado" });
  }

  try {
    // Verifica y decodifica el token
    const decode = jwt.verify(token, secret);

    // Agrega la información del usuario decodificada a la solicitud para su uso en rutas protegidas
    req.user = decode;

    next();
  } catch (err) {
    console.error("Error de autenticación:", err);
    console.error("Token recibido:", token);
    return res.status(401).json({ success: false, message: "Token inválido" });
  }
};

module.exports = authenticateToken;
