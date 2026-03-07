import express from 'express';
import {createCheckoutSession, stripeWebhook, getBookingLinkBySession} from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/checkout', createCheckoutSession);
router.post('/webhook', stripeWebhook);
router.get('/session/:sessionId', getBookingLinkBySession);

export default router;