const router = require("express").Router();
const { getFileContract } = require("./ai.controller");

router.get("/ai/consultar-contrato", getFileContract);

module.exports = router;
