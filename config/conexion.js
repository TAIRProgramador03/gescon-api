require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const odbc = require("odbc"); // Usar el paquete odbc para conectar a la base de datos
const app = express();
const port = 3000;
const IP_ODBC = process.env.IP_ODBC;


// Middleware para parsear los datos JSON
app.use(bodyParser.json());

// Ruta para la autenticación
app.post("./config/conexion.js", async (req, res) => {
  const { dbUser, password } = req.body;

  try {
    // Establecer conexión con la base de datos usando ODBC
    const connection = await odbc.connect(
      `DSN=QDSN_${IP_ODBC};UID=` +
      dbUser +
      ";PWD=" +
      password +
      `;System=${IP_ODBC}`
    );
    console.log("Conexión exitosa.");

    // Hacer algo con la conexión, como verificar que el usuario existe
    const result = await connection.query(
      "SELECT * FROM SPEED400AT.USUARIOS WHERE usuario = ?",
      [dbUser]
    );

    if (result.length > 0) {
      // Usuario encontrado, autenticación exitosa
      res.json({ success: true, message: "Usuario autenticado correctamente" });
    } else {
      // Usuario no encontrado
      res.json({ success: false, message: "Usuario o contraseña incorrectos" });
    }
  } catch (err) {
    console.error("Error de conexión:", err);
    res.status(500).json({
      success: false,
      message: "Error de conexión a la base de datos",
    });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

/*const odbc = require('odbc');

// Función para conectar a la base de datos y validar las credenciales de usuario y contraseña
async function connectToDatabase(dbUser, password) {
    try {
        // Conexión ODBC usando las credenciales proporcionadas
        const connection = await odbc.connect(`DSN=QDSN_192.168.5.5;UID=${dbUser};PWD=${password};System=192.168.5.5`);
        console.log("Conexión exitosa.");

        // Consulta SQL para verificar si el usuario y la contraseña son correctos
        const query = `
            SELECT COUNT(*) AS count 
            FROM SPEED400AT.USUARIOS 
            WHERE usuario = ? 
        `;

        // Ejecutamos la consulta, pasando las credenciales como parámetros
        const result = await connection.query(query, [dbUser]);

        // Verificamos si se encuentra el usuario
        if (result[0].count > 0) {
            console.log("Usuario y contraseña válidos.");
            return true;  // Credenciales válidas
        } else {
            console.log("Usuario o contraseña incorrectos.");
            return false;  // Credenciales incorrectas
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        return false;  // Error de conexión
    }
}

// Ejemplo de cómo llamar la función (normalmente se recibirían los datos desde el frontend)
async function validateLogin(dbUser, password) {
    const isValid = await connectToDatabase(dbUser, password);
    if (isValid) {
        console.log("Acceso concedido.");
    } else {
        console.log("Acceso denegado.");
    }
}

// Exportar la función para utilizarla en el servidor (por ejemplo, con Express)
module.exports = { validateLogin };*/
