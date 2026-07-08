const router = require('express').Router();
const multer = require('multer');
const { analiceData, queryData, getFileContract } = require('./ai.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ── Endpoints ─────────────────────────────────────────────────────────────

// Caso 1 → JSON body: { contratoId, clase }
// Caso 2 → multipart/form-data: campo 'pdf' (archivo)
router.post('/ai/analizar', upload.single('pdf'), analiceData);

router.post('/ai/consultar', queryData);

router.get("/ai/consultar-contrato", getFileContract)

module.exports = router;