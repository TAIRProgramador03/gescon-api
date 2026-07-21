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

// Graph pide el end de un evento de todo el dia como el dia SIGUIENTE (exclusivo)
function buildDateRange(start, end, isAllDay) {
  if (!isAllDay) {
    return {
      start: { dateTime: start, timeZone: "America/Lima" },
      end: { dateTime: end, timeZone: "America/Lima" },
    };
  }

  const fechaFin = new Date(`${end}T00:00:00Z`);
  fechaFin.setUTCDate(fechaFin.getUTCDate() + 1);
  const endExclusivo = fechaFin.toISOString().slice(0, 10);

  return {
    start: { dateTime: `${start}T00:00:00.0000000`, timeZone: "UTC" },
    end: { dateTime: `${endExclusivo}T00:00:00.0000000`, timeZone: "UTC" },
  };
}

const loginMsCalendar = async (req, res) => {
  const { id_usuario } = req.query;
  const authUrl = await cca.getAuthCodeUrl({
    scopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
    redirectUri:
      "https://degrading-pried-prance.ngrok-free.dev/api/v1/auth/microsoft/callback",
    state: id_usuario,
  });
  res.redirect(authUrl);
};

const callBackMsCalendar = async (req, res) => {
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
};

const getEventsCalendar = async (req, res) => {
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
      id: ema.id,
      subject: ema.subject,
      start: ema.start,
      end: ema.end,
      isAllDay: ema.isAllDay,
      isOrganizer: ema.isOrganizer,
      webLink:
        ema.onlineMeeting && ema.onlineMeeting.joinUrl
          ? ema.onlineMeeting.joinUrl
          : undefined,
    })),
  );
};

const getEventDetailCalendar = async (req, res) => {
  const { user: id_usuario } = req.user;
  const { id: eventId } = req.params;

  const cacheSerializado = obtenerTokenUsuario(id_usuario);
  if (!cacheSerializado) {
    return res
      .status(401)
      .json({ error: "Usuario no ha conectado su cuenta de Outlook" });
  }

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

  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
    {
      headers: {
        Authorization: `Bearer ${result.accessToken}`,
        // el evento puede haberse creado en HTML (ej. directo desde Outlook);
        // se pide explicitamente en ese formato para renderizarlo tal cual en el frontend
        Prefer: 'outlook.body-content-type="html"',
      },
    },
  );

  const cacheActualizado = ccaUsuario.getTokenCache().serialize();
  guardarTokenUsuario(id_usuario, cacheActualizado);

  const data = await graphResponse.json();

  if (!graphResponse.ok) {
    return res.status(graphResponse.status).json({ error: data });
  }

  res.status(200).json({
    id: data.id,
    subject: data.subject,
    start: data.start,
    end: data.end,
    isAllDay: data.isAllDay,
    isOrganizer: data.isOrganizer,
    body: data.body?.content,
    bodyContentType: data.body?.contentType,
    location: data.location?.displayName,
    organizer: data.organizer?.emailAddress,
    attendees: data.attendees?.map((a) => a.emailAddress),
    webLink:
      data.onlineMeeting && data.onlineMeeting.joinUrl
        ? data.onlineMeeting.joinUrl
        : undefined,
  });
};

const createEventCalendar = async (req, res) => {
  const { user: id_usuario } = req.user;
  const { subject, start, end, isAllDay, body, location, attendees } = req.body;

  if (!subject || !start || !end) {
    return res
      .status(400)
      .json({ error: "subject, start y end son obligatorios" });
  }

  const cacheSerializado = obtenerTokenUsuario(id_usuario);
  if (!cacheSerializado) {
    return res
      .status(401)
      .json({ error: "Usuario no ha conectado su cuenta de Outlook" });
  }

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

  const eventPayload = {
    subject,
    isAllDay: !!isAllDay,
    ...buildDateRange(start, end, isAllDay),
    ...(body && { body: { contentType: "text", content: body } }),
    ...(location && { location: { displayName: location } }),
    ...(attendees?.length && {
      attendees: attendees.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      })),
    }),
  };

  const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${result.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  const cacheActualizado = ccaUsuario.getTokenCache().serialize();
  guardarTokenUsuario(id_usuario, cacheActualizado);

  const data = await graphResponse.json();

  if (!graphResponse.ok) {
    return res.status(graphResponse.status).json({ error: data });
  }

  res.status(201).json({
    id: data.id,
    subject: data.subject,
    start: data.start,
    end: data.end,
    isAllDay: data.isAllDay,
    webLink:
      data.onlineMeeting && data.onlineMeeting.joinUrl
        ? data.onlineMeeting.joinUrl
        : undefined,
  });
};

const updateEventDatesCalendar = async (req, res) => {
  const { user: id_usuario } = req.user;
  const { id: eventId } = req.params;
  const { start, end, isAllDay } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: "start y end son obligatorios" });
  }

  const cacheSerializado = obtenerTokenUsuario(id_usuario);
  if (!cacheSerializado) {
    return res
      .status(401)
      .json({ error: "Usuario no ha conectado su cuenta de Outlook" });
  }

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

  // solo el organizador puede mover la fecha de un evento; un invitado no
  const eventoActual = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${eventId}?$select=isOrganizer`,
    { headers: { Authorization: `Bearer ${result.accessToken}` } },
  );
  const datosEventoActual = await eventoActual.json();

  if (!eventoActual.ok) {
    return res.status(eventoActual.status).json({ error: datosEventoActual });
  }

  if (!datosEventoActual.isOrganizer) {
    return res.status(403).json({
      error: "Solo el organizador del evento puede modificar la fecha",
    });
  }

  const eventPayload = {
    isAllDay: !!isAllDay,
    ...buildDateRange(start, end, isAllDay),
  };

  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${result.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    },
  );

  const cacheActualizado = ccaUsuario.getTokenCache().serialize();
  guardarTokenUsuario(id_usuario, cacheActualizado);

  const data = await graphResponse.json();

  if (!graphResponse.ok) {
    return res.status(graphResponse.status).json({ error: data });
  }

  res.status(200).json({
    id: data.id,
    subject: data.subject,
    start: data.start,
    end: data.end,
    isAllDay: data.isAllDay,
  });
};

const deleteEventCalendar = async (req, res) => {
  const { user: id_usuario } = req.user;
  const { id: eventId } = req.params;

  const cacheSerializado = obtenerTokenUsuario(id_usuario);
  if (!cacheSerializado) {
    return res
      .status(401)
      .json({ error: "Usuario no ha conectado su cuenta de Outlook" });
  }

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

  const graphResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${result.accessToken}` },
    },
  );

  const cacheActualizado = ccaUsuario.getTokenCache().serialize();
  guardarTokenUsuario(id_usuario, cacheActualizado);

  // Graph responde 204 sin body en un delete exitoso
  if (!graphResponse.ok) {
    const data = await graphResponse.json().catch(() => null);
    return res.status(graphResponse.status).json({ error: data });
  }

  res.status(204).send();
};

const getStatusMs = async (req, res) => {
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
};

const logoutMsCalendar = async (req, res) => {
  const { user: id_usuario } = req.user;

  eliminarTokenUsuario(id_usuario); // borra la entrada del Map en memoria

  res.json({ conectado: false });
};

module.exports = {
  loginMsCalendar,
  callBackMsCalendar,
  getEventsCalendar,
  getEventDetailCalendar,
  createEventCalendar,
  updateEventDatesCalendar,
  deleteEventCalendar,
  getStatusMs,
  logoutMsCalendar
}