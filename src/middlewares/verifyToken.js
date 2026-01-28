import { db } from '../config/db.js';

export const verifyToken = async (req, res, next) => {
    const { token } = req.query;

    const [rows] = await db.query(
        `SELECT * FROM booking_tokens
     WHERE token = ? AND used = false AND expires_at > NOW()`,
        [token]
    );

    if (!rows.length) {
        return res.status(403).send('Token non valido');
    }

    req.bookingToken = rows[0];
    next();
};