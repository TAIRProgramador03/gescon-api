const Router = require("express").Router();
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const validUser = require("../../shared/middleware/user-valid.js");
const {listLeasing, listLeasingOfClient, listLeasingByContract, detailLeasing, insertLeasing, listLeasingByDocument, detailVehByLeasing, detailAssignByLeasing, listAllLeasing, listLeasingGeneral} = require("./leasing.controller.js");

Router.get("/leasing", authenticateToken, validUser, listLeasing);
Router.get("/leasingAll", authenticateToken, validUser,  listAllLeasing);
Router.get("/leasingOfClient", authenticateToken, validUser, listLeasingOfClient)
Router.get("/leasingByContract", authenticateToken, validUser, listLeasingByContract)
Router.get("/leasingGeneral", authenticateToken, validUser, listLeasingGeneral)
Router.get("/leasingByDocument", authenticateToken, validUser, listLeasingByDocument)
Router.get("/detailLeasing", authenticateToken, validUser, detailLeasing)
Router.get("/vehiclesByLeasing", authenticateToken, validUser, detailVehByLeasing)
Router.get("/assignByLeasing", authenticateToken, validUser, detailAssignByLeasing)
Router.post("/insertaLeasing", authenticateToken, validUser, insertLeasing)

module.exports = Router;