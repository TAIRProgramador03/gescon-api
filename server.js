require("dotenv").config(); // Esto carga las variables del archivo .env

process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled Rejection — servidor estable:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[server] Uncaught Exception — servidor estable:", error);
});

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const { IP_LOCAL } = require("./src/shared/conf.js");
const authenticateToken = require("./src/shared/middleware/jwt-valid.js");

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
const reportRoutes = require("./src/app/report/report.routes.js");
const userRoutes = require("./src/app/user/user.routes.js");

const app = express();
const port = process.env.PORT ?? "3000";

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true }); // ← sin server ni path

wss.on("connection", (ws, req) => {
  console.log("[WS] ✅ Cliente conectado:", req.socket.remoteAddress);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: msg.timestamp }));
      }
    } catch {
      /* ignorar */
    }
  });

  ws.on("close", () => console.log("[WS] Cliente desconectado"));
  ws.on("error", (err) => console.error("[WS] error:", err));
});

// Manejar el upgrade manualmente
server.on("upgrade", (req, socket, head) => {
  console.log("[WS] Upgrade solicitado para:", req.url);

  if (req.url === "/ws/heartbeat") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy(); // rechazar paths desconocidos
  }
});

app.use(
  cors({
    origin: [
      "http://localhost",
      `http://${IP_LOCAL}`,
      "http://localhost:8080",
      `http://${IP_LOCAL}:8080`,
      "http://localhost:3000",
      `http://${IP_LOCAL}:3000`,
      `http://cdn.datatables.net`,
      `http://192.168.5.25`,
      `http://192.168.5.25:3000`,
      `http://${IP_LOCAL}:5173`,
      `http://locahost:5173`,
      `http://${IP_LOCAL}:8080`,
      `http://locahost:8080`,
      "https://gescon.tair360.net",
      "http://192.168.4.22",
      "http://192.168.4.22:5173",
    ], // Permite solicitudes solo desde esta URL
    credentials: true, // Permite el envío de cookies con las solicitudes
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// Acceso a los archivos public
app.use(
  "/files",
  authenticateToken,
  express.static(path.join(__dirname, "/public")),
);

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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Iniciar servidor IP_LOCAL/
server.listen(port, () => {
  console.log(`Servidor corriendo en https://${IP_LOCAL}:${port}`);
});
