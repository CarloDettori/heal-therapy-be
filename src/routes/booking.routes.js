import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { getBookingPage } from '../controllers/booking.controller.js';

const router = express.Router();

router.get('/prenota', verifyToken, getBookingPage);

export default router;
