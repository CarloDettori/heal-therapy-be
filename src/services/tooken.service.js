import crypto from 'crypto';
import { db } from '../config/db.js';

export const createToken = async (paymentId) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
        `INSERT INTO booking_tokens (token, payment_id, expires_at)
     VALUES (?, ?, ?)`,
        [token, paymentId, expires]
    );

    return token;
};