const Router = require('express').Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js")
const {contVehicleFeet, contLeasings, contVehicleLeasings, listVehicleLeasingExpire, listVehicleLeasingToExpire, contVehiculeByClient, contComparationDays, contTotalPriceByModel} = require("./report.controller.js")

Router.get("/contVehicleFleet", authenticateToken, contVehicleFeet);
Router.get("/contVehicleLeasing", authenticateToken, contVehicleLeasings);
Router.get("/contLeasing", authenticateToken, contLeasings);
Router.get("/listVehicleExpires", authenticateToken, listVehicleLeasingExpire)
Router.get("/listVehicleToExpires", authenticateToken, listVehicleLeasingToExpire)
Router.get("/contVehicleByClient", authenticateToken, contVehiculeByClient)
Router.get("/contComparationDays", authenticateToken, contComparationDays)
Router.get("/contTotalPriceModel", authenticateToken, contTotalPriceByModel)

module.exports = Router;