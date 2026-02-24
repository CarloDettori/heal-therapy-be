import express from 'express';
import { validateBookingToken, consumeBookingToken } from '../controllers/booking.controller.js';

const router = express.Router();

// Valida token (NON lo marca used)
router.get('/token/validate', validateBookingToken);

// Consuma token (lo marca used = true) – utile quando l’utente conferma/entra nella pagina prenotazione
router.post('/token/consume', consumeBookingToken);

export default router;
