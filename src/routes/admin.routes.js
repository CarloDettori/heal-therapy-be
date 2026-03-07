import express from 'express';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import {
  listBookings,
  cancelBooking,
  rescheduleBooking,
  listClosedDays,
  addClosedDay,
  removeClosedDay
} from '../controllers/admin.controller.js';

const router = express.Router();

router.get("/bookings", requireAdminAuth, listBookings);
router.post("/bookings/:id/cancel", requireAdminAuth, cancelBooking);
router.post("/bookings/:id/reschedule", requireAdminAuth, rescheduleBooking);
router.get("/closed-days", requireAdminAuth, listClosedDays);
router.post("/closed-days", requireAdminAuth, addClosedDay);
router.delete("/closed-days/:id", requireAdminAuth, removeClosedDay);

export default router;