const router = require("express").Router();
const validUser = require("../../shared/middleware/user-valid.js");
const authenticateToken = require("../../shared/middleware/jwt-valid.js");
const {
  loginMsCalendar,
  callBackMsCalendar,
  getEventsCalendar,
  getEventDetailCalendar,
  createEventCalendar,
  updateEventDatesCalendar,
  deleteEventCalendar,
  getStatusMs,
  logoutMsCalendar,
} = require("./crm.controller.js");

router.get("/auth/microsoft/login", loginMsCalendar);
router.get("/auth/microsoft/callback", callBackMsCalendar);
router.get("/calendario/eventos", authenticateToken, validUser, getEventsCalendar);
router.post("/calendario/eventos", authenticateToken, validUser, createEventCalendar);
router.get("/calendario/eventos/:id", authenticateToken, validUser, getEventDetailCalendar);
router.patch("/calendario/eventos/:id/fechas", authenticateToken, validUser, updateEventDatesCalendar);
router.delete("/calendario/eventos/:id", authenticateToken, validUser, deleteEventCalendar);
router.get("/auth/microsoft/status", authenticateToken, validUser, getStatusMs);
router.post("/auth/microsoft/logout", authenticateToken, validUser, logoutMsCalendar);

module.exports = router;
