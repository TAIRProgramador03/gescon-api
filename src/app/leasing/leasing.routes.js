const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const {listLeasing, listLeasingOfClient, listLeasingByContract, detailLeasing, insertLeasing, listLeasingByDocument, detailVehByLeasing, detailAssignByLeasing, listAllLeasing} = require("./leasing.controller.js");

Router.get("/leasing", authenticateToken, listLeasing);
Router.get("/leasingAll", authenticateToken, listAllLeasing);
Router.get("/leasingOfClient", authenticateToken, listLeasingOfClient)
Router.get("/leasingByContract", authenticateToken, listLeasingByContract)
Router.get("/leasingByDocument", authenticateToken, listLeasingByDocument)
Router.get("/detailLeasing", authenticateToken, detailLeasing)
Router.get("/vehiclesByLeasing", authenticateToken, detailVehByLeasing)
Router.get("/assignByLeasing", authenticateToken, detailAssignByLeasing)
Router.post("/insertaLeasing", authenticateToken, insertLeasing)

module.exports = Router;