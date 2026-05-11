const Router = require("express").Router();
const {
  listVehicles,
  tableVehicles,
  contVehicles,
  vehicleLeasing,
  listVehiclesByContract,
  listModelGen,
  listYearByModelGen,
  listPlateTraceability,
  listPlateByRegion
} = require("./vehicle.controller.js");
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");

Router.get("/todosLosVehiculos", authenticateToken, validUser, listVehicles);
Router.get("/tablaVehiculo", authenticateToken, validUser, tableVehicles);
Router.get("/tablaconVehiculo", authenticateToken, validUser, contVehicles);
Router.get("/consultaVehiculoLeasing", authenticateToken, validUser, vehicleLeasing);
Router.get("/vehiculosPorContrato", authenticateToken, validUser, listVehiclesByContract)
Router.get("/modedosGenericos", authenticateToken, validUser, listModelGen);
Router.get("/aniosPorModelo", authenticateToken, validUser, listYearByModelGen);
Router.get("/trazabilidadPlaca", authenticateToken, validUser, listPlateTraceability);
Router.get("/vehiculosPorRegion", authenticateToken, validUser, listPlateByRegion);

module.exports = Router;
