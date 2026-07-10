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
const routerV1 = require("./src/shared/routes/v1.js")

const app = express();
const port = process.env.PORT ?? "3000";

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true }); // ← sin server ni path

wss.on("connection", (ws, req) => {
  console.log("[WS] ✅ Cliente conectado:", req.socket.remoteAddress);

  const keepAlive = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping(); // Frame nativo WS, no un mensaje JSON
    }
  }, 50_000);

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

  ws.on("close", () => {
    clearInterval(keepAlive); // ✅ Limpiar intervalo al desconectar
    console.log("[WS] Cliente desconectado");
  });

  ws.on("error", (err) => {
    clearInterval(keepAlive); // ✅ También limpiar en error
    console.error("[WS] error:", err);
  });
});

// Manejar el upgrade manualmente
server.on("upgrade", (req, socket, head) => {
  console.log("[WS] Upgrade solicitado para:", req.url);
  console.log("[WS] Headers:", req.headers); // ← Agregar temporalmente para debug

  // ✅ NUEVO: validar que sea realmente un upgrade de WebSocket
  const upgradeHeader = req.headers["upgrade"];
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    console.warn(
      "[WS] ⚠️ Upgrade rechazado, cabecera inválida:",
      upgradeHeader,
    );
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  if (req.url === "/ws/heartbeat") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  }
});

app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://192.168.4.22:8080",
      "http://192.168.4.22:5173",
      "https://gescon.tair360.net",
      "https://tair360.net",
      "http://104.21.60.95",
      "http://172.67.195.129"
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
app.use("/api/v1", routerV1);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/webhook", (req, res) => {
  res.status(200);

  console.log(JSON.stringify(req.body));
})

// Iniciar servidor IP_LOCAL/
server.listen(port, () => {
  console.log(`Servidor corriendo en https://${IP_LOCAL}:${port}`);
});
