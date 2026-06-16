const router = require("express").Router();

// RUTAS DE API
const authRoutes = require("../../app/auth/auth.routes.js");
const clientRoutes = require("../../app/client/client.routes.js");
const contractRoutes = require("../../app/contract/contract.routes.js");
const documentRoutes = require("../../app/document/document.routes.js");
const leasingRoutes = require("../../app/leasing/leasing.routes.js");
const vehicleRoutes = require("../../app/vehicle/vehicle.routes.js");
const operationRoutes = require("../../app/operation/operation.routes.js");
const fileRoutes = require("../../app/file/file.routes.js");
const modelRoutes = require("../../app/model/model.routes.js");
const reportRoutes = require("../../app/report/report.routes.js");
const userRoutes = require("../../app/user/user.routes.js");

const idempotency = require("../middleware/idempotency.js");

// Solo en métodos que mutan datos
router.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return idempotency(req, res, next);
  }
  next();
});

router.use(authRoutes);
router.use(clientRoutes);
router.use(contractRoutes);
router.use(documentRoutes);
router.use(leasingRoutes);
router.use(vehicleRoutes);
router.use(operationRoutes);
router.use(fileRoutes);
router.use(modelRoutes);
router.use(reportRoutes);
router.use(userRoutes);

module.exports = router;
