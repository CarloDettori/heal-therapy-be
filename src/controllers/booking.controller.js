import { db } from '../config/db.js';

/**
 * GET /api/bookings/token/validate?token=xxxx
 * Valida token senza consumarlo.
 */
export const validateBookingToken = async (req, res) => {
  try {
    const token = (req.query.token || '').trim();

    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token mancante' });
    }

    // 1) Recupera token + pagamento + booking (se esiste)
    const [rows] = await db.query(
      `
      SELECT
        bt.id              AS token_id,
        bt.token           AS token,
        bt.used            AS token_used,
        bt.expires_at      AS token_expires_at,
        bt.payment_id      AS payment_id,

        p.status           AS payment_status,
        p.email            AS email,
        p.amount           AS amount,
        p.visit_type       AS visit_type,

        b.id               AS booking_id,
        b.status           AS booking_status
      FROM booking_tokens bt
      JOIN payments p ON p.id = bt.payment_id
      LEFT JOIN bookings b ON b.payment_id = p.id
      WHERE bt.token = ?
      LIMIT 1
      `,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ valid: false, error: 'Token non trovato' });
    }

    const r = rows[0];

    // 2) Controlli token
    if (r.token_used) {
      return res.status(410).json({ valid: false, error: 'Token già usato' });
    }

    const now = new Date();
    const expiresAt = new Date(r.token_expires_at);
    if (expiresAt <= now) {
      return res.status(410).json({ valid: false, error: 'Token scaduto' });
    }

    // 3) Controllo pagamento
    if (r.payment_status !== 'paid') {
      return res.status(403).json({ valid: false, error: 'Pagamento non confermato' });
    }

    // ✅ valido
    return res.json({
      valid: true,
      data: {
        token: r.token,
        paymentId: r.payment_id,
        bookingId: r.booking_id || null,
        email: r.email,
        amount: r.amount,
        visitType: r.visit_type,
        bookingStatus: r.booking_status || null,
        expiresAt: r.token_expires_at
      }
    });
  } catch (err) {
    console.error('validateBookingToken error:', err);
    return res.status(500).json({ valid: false, error: 'Errore server' });
  }
};

/**
 * POST /api/bookings/token/consume
 * Body: { "token": "xxxx" }
 * Marca il token come used=true se valido.
 */
export const consumeBookingToken = async (req, res) => {
  try {
    const token = (req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ consumed: false, error: 'Token mancante' });
    }

    // transazione per evitare race conditions
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `
        SELECT bt.id AS token_id, bt.used, bt.expires_at, p.status AS payment_status
        FROM booking_tokens bt
        JOIN payments p ON p.id = bt.payment_id
        WHERE bt.token = ?
        LIMIT 1
        FOR UPDATE
        `,
        [token]
      );

      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ consumed: false, error: 'Token non trovato' });
      }

      const r = rows[0];

      if (r.used) {
        await conn.rollback();
        return res.status(410).json({ consumed: false, error: 'Token già usato' });
      }

      if (new Date(r.expires_at) <= new Date()) {
        await conn.rollback();
        return res.status(410).json({ consumed: false, error: 'Token scaduto' });
      }

      if (r.payment_status !== 'paid') {
        await conn.rollback();
        return res.status(403).json({ consumed: false, error: 'Pagamento non confermato' });
      }

      await conn.query(
        `UPDATE booking_tokens SET used = TRUE WHERE id = ?`,
        [r.token_id]
      );

      await conn.commit();
      return res.json({ consumed: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('consumeBookingToken error:', err);
    return res.status(500).json({ consumed: false, error: 'Errore server' });
  }
};

