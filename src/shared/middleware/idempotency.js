const store = new Map();
const TTL_MS = 10_000; // 10 segundos

const idempotency = (req, res, next) => {
  const key = req.headers["X-Idempotency-Key"];

  if (!key) return next(); // sin key → pasa normal

  const userId = req.user?.id ?? "anon";
  const storeKey = `${userId}:${req.method}:${req.path}:${key}`;

  const cached = store.get(storeKey);
  if (cached) {
    return res.status(cached.status).json(cached.body);
  }

  // Interceptar res.json para cachear respuesta
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    store.set(storeKey, { status: res.statusCode, body });
    setTimeout(() => store.delete(storeKey), TTL_MS);
    return originalJson(body);
  };

  next();
};

module.exports = idempotency;