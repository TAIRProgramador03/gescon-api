require("dotenv").config(); // Esto carga las variables del archivo .env

const express = require("express");
const cors = require("cors");
const path = require('path');
const cookieParser = require("cookie-parser");
const { IP_LOCAL } = require("./src/shared/conf.js");
const authenticateToken = require("./src/shared/middleware/jwt-valid.js")

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
const userRoutes = require("./src/app/user/user.routes.js")

const app = express();
const port = 3000;

app.use(
  cors({
    origin: [
      "http://localhost",
      `http://${IP_LOCAL}`,
      "http://localhost:3000",
      `http://${IP_LOCAL}:3000`,
      `http://cdn.datatables.net`,
      `http://192.168.5.25`,
      `http://192.168.5.25:3000`,
      `http://${IP_LOCAL}:5173`,
      `http://locahost:5173`,
    ], // Permite solicitudes solo desde esta URL
    credentials: true, // Permite el envío de cookies con las solicitudes
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Acceso a los archivos public
app.use("/files", authenticateToken, express.static(path.join(__dirname, '/public')));

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
app.use(userRoutes);

// Iniciar servidor IP_LOCAL/
app.listen(port, () => {
  console.log(`Servidor corriendo en https://${IP_LOCAL}:${port}`);
});