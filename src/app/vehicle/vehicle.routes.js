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
const authenticateToken = require("../../shared/middleware/jwt-valid.js");

Router.get("/todosLosVehiculos", authenticateToken, listVehicles);
Router.get("/tablaVehiculo", authenticateToken, tableVehicles);
Router.get("/tablaconVehiculo", authenticateToken, contVehicles);
Router.get("/consultaVehiculoLeasing", authenticateToken, vehicleLeasing);
Router.get("/vehiculosPorContrato", authenticateToken, listVehiclesByContract)
Router.get("/modedosGenericos", authenticateToken, listModelGen);
Router.get("/aniosPorModelo", authenticateToken, listYearByModelGen);
Router.get("/trazabilidadPlaca", authenticateToken, listPlateTraceability);
Router.get("/vehiculosPorRegion", authenticateToken, listPlateByRegion);

module.exports = Router;
