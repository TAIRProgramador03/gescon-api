const Router = require('express').Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js")
const validUser = require("../../shared/middleware/user-valid.js");
const {contVehicleFeet, contLeasings, contVehicleLeasings, listVehicleLeasingExpire, listVehicleLeasingToExpire, contVehiculeByClient, contComparationDays, contTotalPriceByModel, depecratedVehicleExpires, depecratedVehicleToExpires, deprecatedVehicleById, contTotalVehicleMap, notifications, diferenceContractLeasing} = require("./report.controller.js")

Router.get("/contVehicleFleet", authenticateToken, validUser, contVehicleFeet);
Router.get("/contVehicleLeasing", authenticateToken, validUser, contVehicleLeasings);
Router.get("/contLeasing", authenticateToken, validUser, contLeasings);
Router.get("/diferenceContractLeasing", authenticateToken, validUser, diferenceContractLeasing);
Router.get("/listVehicleExpires", authenticateToken, validUser, listVehicleLeasingExpire)
Router.get("/listVehicleToExpires", authenticateToken, validUser, listVehicleLeasingToExpire)
Router.get("/contVehicleByClient", authenticateToken, validUser, contVehiculeByClient)
Router.get("/contComparationDays", authenticateToken, validUser, contComparationDays)
Router.get("/contTotalPriceModel", authenticateToken, validUser, contTotalPriceByModel)
Router.get("/contTotalVehicleMap", authenticateToken, validUser, contTotalVehicleMap)
Router.get("/deprecatedVehicleExpire", authenticateToken, validUser, depecratedVehicleExpires)
Router.get("/deprecatedVehicleToExpire", authenticateToken, validUser, depecratedVehicleToExpires)
Router.get("/deprecatedVehicle/:id", authenticateToken, validUser, deprecatedVehicleById)
Router.get("/notifications", authenticateToken, validUser, notifications)

module.exports = Router;