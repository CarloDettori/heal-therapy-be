import { db } from '../config/db.js';
import {
  sendCancelledBookingEmail,
  sendRescheduledBookingEmail
} from "../services/email.service.js";

export const listBookings = async (req, res) => {
  try {
    const {
      status,     // scheduled | confirmed | cancelled | ...
      q,          // ricerca email
      from,       // YYYY-MM-DD
      to,         // YYYY-MM-DD
      limit = '50',
      offset = '0'
    } = req.query;

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;

    const where = [];
    const params = [];

    if (status) {
      where.push('b.status = ?');
      params.push(status);
    }

    if (q) {
      where.push('b.email LIKE ?');
      params.push(`%${q}%`);
    }

    if (from) {
      where.push('(b.scheduled_at >= ? OR (b.scheduled_at IS NULL AND b.created_at >= ?))');
      params.push(`${from} 00:00:00`, `${from} 00:00:00`);
    }

    if (to) {
      where.push('(b.scheduled_at < ? OR (b.scheduled_at IS NULL AND b.created_at < ?))');
      params.push(`${to} 23:59:59`, `${to} 23:59:59`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `
      SELECT
        b.id,
        b.email,
        b.visit_type,
        b.status,
        b.scheduled_at,
        b.created_at,
        p.amount,
        p.status AS payment_status
      FROM bookings b
      JOIN payments p ON p.id = b.payment_id
      ${whereSql}
      ORDER BY COALESCE(b.scheduled_at, b.created_at) DESC
      LIMIT ? OFFSET ?
      `,
      [...params, lim, off]
    );

    return res.json({ ok: true, items: rows, limit: lim, offset: off });
  } catch (e) {
    console.error('listBookings error:', e);
    return res.status(500).json({ ok: false, error: 'Errore server' });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "ID non valido" });
    }

    const [rows] = await db.query(
      `SELECT * FROM bookings WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Prenotazione non trovata" });
    }

    const booking = rows[0];

    await db.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = ?`,
      [id]
    );

    try {
      await sendCancelledBookingEmail({
        to: booking.email,
        scheduledAt: booking.scheduled_at,
        visitType: booking.visit_type,
      });
    } catch (e) {
      console.error("Errore invio mail cancellazione (non blocco):", e?.response?.body || e);
    }

    return res.json({
      ok: true,
      message: "Prenotazione cancellata con successo",
    });
  } catch (e) {
    console.error("cancelBooking error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

export const rescheduleBooking = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const scheduledAt = (req.body?.scheduledAt || "").trim();

    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "ID non valido" });
    }

    if (!scheduledAt) {
      return res.status(400).json({ ok: false, error: "Nuova data/ora mancante" });
    }

    const dt = new Date(scheduledAt);

    if (Number.isNaN(dt.getTime())) {
      return res.status(400).json({ ok: false, error: "Formato data/ora non valido" });
    }

    const mysqlDatetime = dt.toISOString().slice(0, 19).replace("T", " ");

    const [rows] = await db.query(
      `SELECT * FROM bookings WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Prenotazione non trovata" });
    }

    const booking = rows[0];
    const oldScheduledAt = booking.scheduled_at;

    const [busy] = await db.query(
      `SELECT id FROM bookings WHERE scheduled_at = ? AND id != ? LIMIT 1`,
      [mysqlDatetime, id]
    );

    if (busy.length) {
      return res.status(409).json({ ok: false, error: "Orario già occupato" });
    }

    await db.query(
      `UPDATE bookings SET scheduled_at = ?, status = 'scheduled' WHERE id = ?`,
      [mysqlDatetime, id]
    );

    try {
      await sendRescheduledBookingEmail({
        to: booking.email,
        oldScheduledAt,
        newScheduledAt: mysqlDatetime,
        visitType: booking.visit_type,
      });
    } catch (e) {
      console.error("Errore invio mail spostamento (non blocco):", e?.response?.body || e);
    }

    return res.json({
      ok: true,
      message: "Prenotazione spostata con successo",
      scheduledAt: mysqlDatetime,
    });
  } catch (e) {
    console.error("rescheduleBooking error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

export const listClosedDays = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM closed_days ORDER BY date ASC`
    );

    return res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("listClosedDays error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

export const addClosedDay = async (req, res) => {
  try {
    const date = (req.body?.date || "").trim();
    const reason = (req.body?.reason || "").trim();

    if (!date) {
      return res.status(400).json({ ok: false, error: "Data mancante" });
    }

    await db.query(
      `INSERT INTO closed_days (date, reason) VALUES (?, ?)`,
      [date, reason || null]
    );

    return res.json({ ok: true, message: "Giorno bloccato con successo" });
  } catch (e) {
    console.error("addClosedDay error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

export const removeClosedDay = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "ID non valido" });
    }

    await db.query(
      `DELETE FROM closed_days WHERE id = ?`,
      [id]
    );

    return res.json({ ok: true, message: "Giorno sbloccato con successo" });
  } catch (e) {
    console.error("removeClosedDay error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};