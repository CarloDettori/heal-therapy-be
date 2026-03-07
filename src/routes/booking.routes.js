import express from 'express';
import { validateBookingToken, consumeBookingToken, scheduleBookingWithToken, getBookingById, getAvailableSlots, getAvailableDays  } from '../controllers/booking.controller.js';

const router = express.Router();

// disattiva gli slot occupati
router.get("/available-slots", getAvailableSlots);

// mostra slots diponibili
router.get("/available-days", getAvailableDays);

// Valida token (NON lo marca used)
router.get('/token/validate', validateBookingToken);

// Consuma token (lo marca used = true) – utile quando l’utente conferma/entra nella pagina prenotazione
router.post('/token/consume', consumeBookingToken);

// schedule bookong
router.post('/schedule', scheduleBookingWithToken);



router.get('/:id', getBookingById);



export default router;
