const router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");

const msal = require("@azure/msal-node");
const {
  AZURE_CLIENT_ID,
  AZURE_TENANT_ID,
  AZURE_CLIENT_SECRET,
} = require("../../shared/conf.js");

const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`, // tenant-specific, evita el error de /common que ya viviste
    clientSecret: AZURE_CLIENT_SECRET,
  },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

const tokenCache = new Map(); // key: id_usuario, value: refreshToken

function guardarTokenUsuario(idUsuario, refreshToken) {
  tokenCache.set(String(idUsuario), refreshToken);
}

function obtenerTokenUsuario(idUsuario) {
  return tokenCache.get(String(idUsuario));
}

function eliminarTokenUsuario(idUsuario) {
  tokenCache.delete(String(idUsuario));
}

router.get("/auth/microsoft/login", async (req, res) => {
  const { id_usuario } = req.query;
  const authUrl = await cca.getAuthCodeUrl({
    scopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
    redirectUri:
      "https://degrading-pried-prance.ngrok-free.dev/api/v1/auth/microsoft/callback",
    state: id_usuario,
  });
  res.redirect(authUrl);
});

router.get("/auth/microsoft/callback", async (req, res) => {
  const { code, state: id_usuario } = req.query;

  await cca.acquireTokenByCode({
    code,
    scopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
    redirectUri:
      "https://degrading-pried-prance.ngrok-free.dev/api/v1/auth/microsoft/callback",
  });

  // el token cache completo (incluye el refresh token internamente, en formato serializado)
  const cacheSerializado = cca.getTokenCache().serialize();
  guardarTokenUsuario(id_usuario, cacheSerializado);

  res.send(`
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'outlook-conectado' }, '*');
      }
      window.close();
    </script>
  `);
});

router.get(
  "/calendario/eventos",
  authenticateToken,
  validUser,
  async (req, res) => {
    const { user: id_usuario } = req.user;

    const cacheSerializado = obtenerTokenUsuario(id_usuario);
    if (!cacheSerializado) {
      return res
        .status(401)
        .json({ error: "Usuario no ha conectado su cuenta de Outlook" });
    }

    // nueva instancia de cca para esta petición, cargando el cache de este usuario específico
    const ccaUsuario = new msal.ConfidentialClientApplication(msalConfig);
    await ccaUsuario.getTokenCache().deserialize(cacheSerializado);

    const cuentas = await ccaUsuario.getTokenCache().getAllAccounts();
    if (cuentas.length === 0) {
      return res
        .status(401)
        .json({ error: "Sesión de Outlook inválida, reconectar" });
    }

    const result = await ccaUsuario.acquireTokenSilent({
      account: cuentas[0],
      scopes: ["Calendars.ReadWrite", "User.Read"],
    });
    // MSAL internamente usa el refresh token guardado en el cache para renovar el access token si expiró

    const graphResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/events?$top=999",
      {
        headers: { Authorization: `Bearer ${result.accessToken}` },
      },
    );

    // opcional: si el cache cambió (se renovó el token), vuelve a guardarlo actualizado
    const cacheActualizado = ccaUsuario.getTokenCache().serialize();
    guardarTokenUsuario(id_usuario, cacheActualizado);

    const data = await graphResponse.json();

    res.status(200).json(
      data.value.map((ema) => ({
        id: ema.uid,
        subject: ema.subject,
        start: ema.start,
        end: ema.end,
        isAllDay: ema.isAllDay,
        webLink:
          ema.onlineMeeting && ema.onlineMeeting.joinUrl
            ? ema.onlineMeeting.joinUrl
            : undefined,
      })),
    );
  },
);

router.get(
  "/auth/microsoft/status",
  authenticateToken,
  validUser,
  async (req, res) => {
    const { user: id_usuario } = req.user;

    const cacheSerializado = obtenerTokenUsuario(id_usuario);
    if (!cacheSerializado) {
      return res.json({ conectado: false });
    }

    // verifica que el cache realmente tenga una cuenta válida, no solo que exista la entrada
    try {
      const ccaUsuario = new msal.ConfidentialClientApplication(msalConfig);
      await ccaUsuario.getTokenCache().deserialize(cacheSerializado);
      const cuentas = await ccaUsuario.getTokenCache().getAllAccounts();

      if (cuentas.length === 0) {
        return res.json({ conectado: false });
      }

      // intento silencioso para confirmar que el refresh token todavía sirve
      await ccaUsuario.acquireTokenSilent({
        account: cuentas[0],
        scopes: ["Calendars.ReadWrite", "User.Read"],
      });

      res.json({ conectado: true, email: cuentas[0].username });
    } catch (error) {
      // el refresh token expiró o fue revocado
      res.json({ conectado: false });
    }
  },
);

router.post("/auth/microsoft/logout", authenticateToken, validUser, async (req, res) => {
  const { user: id_usuario } = req.user;

  eliminarTokenUsuario(id_usuario); // borra la entrada del Map en memoria

  res.json({ conectado: false });
});

module.exports = router;
