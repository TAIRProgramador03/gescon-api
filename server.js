require("dotenv").config(); // Esto carga las variables del archivo .env

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { IP_LOCAL } = require("./src/shared/conf.js");

// RUTAS DE API
const authRoutes = require("./src/app/auth/auth.routes.js");
const clientRoutes = require("./src/app/client/client.routes.js");
const contractRoutes = require("./src/app/contract/contract.routes.js");
const documentRoutes = require("./src/app/document/document.routes.js");
const leasingRoutes = require("./src/app/leasing/leasing.routes.js");
const vehicleRoutes = require("./src/app/vehicle/vehicle.routes.js");
const operationRoutes = require("./src/app/operation/operation.routes.js");
const fileRoutes = require("./src/app/file/file.routes.js");
const modelRoutes = require("./src/app/model/model.routes.js");
const reportRoutes = require("./src/app/report/report.routes.js")

const app = express();
const port = 3000;

// const { OpenAI } = require("openai");

// // Crear una instancia de OpenAI con tu API Key cargada desde las variables de entorno
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY, // Usar la clave de API desde las variables de entorno
// });

app.use(
  cors({
    origin: [
      "http://localhost",
      `http://${IP_LOCAL}`,
      "http://localhost:3000",
      `http://${IP_LOCAL}:3000`,
      `http://cdn.datatables.net`,
      `http://192.168.5.25`,
      `http://192.168.5.25:3000`
    ], // Permite solicitudes solo desde esta URL
    credentials: true, // Permite el envío de cookies con las solicitudes
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Rutas de api
app.use(authRoutes);
app.use(clientRoutes);
app.use(contractRoutes);
app.use(documentRoutes);
app.use(leasingRoutes);
app.use(vehicleRoutes);
app.use(operationRoutes);
app.use(fileRoutes);
app.use(modelRoutes);
app.use(reportRoutes);

// Servir el archivo HTML
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/Index.html");
});

// app.get("/get-openai-response", async (req, res) => {
//   try {
//     // Usar OpenAI para generar una respuesta
//     const response = await openai.completions.create({
//       model: "text-davinci-003", // Modelo de OpenAI
//       prompt: "Escribe un poema sobre el sol",
//       max_tokens: 50,
//     });

//     // Enviar la respuesta de OpenAI al cliente
//     res.send(response.choices[0].text);
//   } catch (error) {
//     console.error("Error al contactar a OpenAI:", error);
//     res.status(500).send("Error al contactar con OpenAI");
//   }
// });

// Iniciar servidor IP_LOCAL/

app.listen(port, () => {
  console.log(`Servidor corriendo en https://${IP_LOCAL}:${port}`);
});