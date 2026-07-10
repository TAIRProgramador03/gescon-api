// tokenManager.js
const axios = require("axios");
const { URI_FIRMEASY, TOKEN_INTEGRATE, USER_FIRMEASY, PASS_FIRMEASY } = require("./conf.js");

const MARGEN_SEGURIDAD_MS = 60 * 1000; // 60s de colchón

// Caché por proveedor
const cache = {};
// cache["firmeasy"] = { token, expiresAt, renovando }

// Registro de "cómo obtener el token" por proveedor
const providers = {
  firmeasy: obtenerTokenFirmEasy,
};

async function obtenerTokenFirmEasy() {
  const { data } = await axios.post(
    `${URI_FIRMEASY}/auth/${TOKEN_INTEGRATE}/login`,
    {
      email: USER_FIRMEASY,
      password: PASS_FIRMEASY,
    },
  );
  return {
    token: data.access,
    expiresInMs: data.expires_in * 1000,
  };
}

async function getToken(service) {
  const fetchFn = providers[service];
  if (!fetchFn) {
    throw new Error(`Proveedor de token no soportado: ${service}`);
  }

  const entry =
    cache[service] ||
    (cache[service] = { token: null, expiresAt: 0, renovando: null });
  const ahora = Date.now();

  // Token vigente -> lo devolvemos directo
  if (entry.token && ahora < entry.expiresAt - MARGEN_SEGURIDAD_MS) {
    return entry.token;
  }

  // Evitar renovaciones concurrentes para el mismo proveedor
  if (!entry.renovando) {
    entry.renovando = fetchFn()
      .then(({ token, expiresInMs }) => {
        entry.token = token;
        entry.expiresAt = Date.now() + expiresInMs;
        return token;
      })
      .finally(() => {
        entry.renovando = null;
      });
  }

  return entry.renovando;
}

module.exports = { getToken };
