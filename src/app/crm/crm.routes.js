const router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const {
  loginMsCalendar,
  callBackMsCalendar,
  getEventsCalendar,
  getStatusMs,
  logoutMsCalendar,
} = require("./crm.controller.js");

router.get("/auth/microsoft/login", loginMsCalendar);
router.get("/auth/microsoft/callback", callBackMsCalendar);
router.get("/calendario/eventos", authenticateToken, validUser, getEventsCalendar);
router.get("/auth/microsoft/status", authenticateToken, validUser, getStatusMs);
router.post("/auth/microsoft/logout", authenticateToken, validUser, logoutMsCalendar);

module.exports = router;
