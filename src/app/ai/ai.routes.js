const router = require("express").Router();
const { getFileContract, getContratosPorVencer } = require("./ai.controller");

router.get("/ai/consultar-contrato", getFileContract);
router.get('/ai/contrato-proximos-vencer', getContratosPorVencer);


module.exports = router;
