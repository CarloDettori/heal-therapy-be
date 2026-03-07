import { db } from "../config/db.js";
import { sendScheduledConfirmationEmail } from "../services/email.service.js";

/**
 * GET /api/bookings/token/validate?token=xxxx
 * Valida token senza consumarlo.
 */
export const validateBookingToken = async (req, res) => {
  try {
    const token = (req.query.token || "").trim();

    if (!token) {
      return res.status(400).json({ valid: false, error: "Token mancante" });
    }

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
        b.status           AS booking_status,
        b.scheduled_at     AS scheduled_at
      FROM booking_tokens bt
      JOIN payments p ON p.id = bt.payment_id
      LEFT JOIN bookings b ON b.payment_id = p.id
      WHERE bt.token = ?
      LIMIT 1
      `,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ valid: false, error: "Token non trovato" });
    }

    const r = rows[0];

    if (r.token_used) {
      return res.status(410).json({ valid: false, error: "Token già usato" });
    }

    const now = new Date();
    const expiresAt = new Date(r.token_expires_at);
    if (expiresAt <= now) {
      return res.status(410).json({ valid: false, error: "Token scaduto" });
    }

    if (r.payment_status !== "paid") {
      return res
        .status(403)
        .json({ valid: false, error: "Pagamento non confermato" });
    }

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
        scheduledAt: r.scheduled_at || null,
        expiresAt: r.token_expires_at,
      },
    });
  } catch (err) {
    console.error("validateBookingToken error:", err);
    return res.status(500).json({ valid: false, error: "Errore server" });
  }
};

/**
 * POST /api/bookings/token/consume
 * Body: { "token": "xxxx" }
 * Marca il token come used=true se valido.
 */
export const consumeBookingToken = async (req, res) => {
  try {
    const token = (req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ consumed: false, error: "Token mancante" });
    }

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
        return res.status(404).json({ consumed: false, error: "Token non trovato" });
      }

      const r = rows[0];

      if (r.used) {
        await conn.rollback();
        return res.status(410).json({ consumed: false, error: "Token già usato" });
      }

      if (new Date(r.expires_at) <= new Date()) {
        await conn.rollback();
        return res.status(410).json({ consumed: false, error: "Token scaduto" });
      }

      if (r.payment_status !== "paid") {
        await conn.rollback();
        return res.status(403).json({ consumed: false, error: "Pagamento non confermato" });
      }

      await conn.query(`UPDATE booking_tokens SET used = TRUE WHERE id = ?`, [
        r.token_id,
      ]);

      await conn.commit();
      return res.json({ consumed: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("consumeBookingToken error:", err);
    return res.status(500).json({ consumed: false, error: "Errore server" });
  }
};

/**
 * POST /api/bookings/schedule
 * Body: { token, scheduledAt } dove scheduledAt = "YYYY-MM-DDTHH:MM"
 */
export const scheduleBookingWithToken = async (req, res) => {
  const token = (req.body?.token || "").trim();
  const scheduledAt = (req.body?.scheduledAt || "").trim();

  if (!token) return res.status(400).json({ ok: false, error: "Token mancante" });
  if (!scheduledAt) return res.status(400).json({ ok: false, error: "Data/ora mancante" });

  const dt = new Date(scheduledAt);
  if (Number.isNaN(dt.getTime())) {
    return res.status(400).json({ ok: false, error: "Formato data/ora non valido" });
  }
  if (dt <= new Date()) {
    return res.status(400).json({ ok: false, error: "Non puoi prenotare nel passato" });
  }

  const mysqlDatetime = dt.toISOString().slice(0, 19).replace("T", " ");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
      SELECT
        bt.id AS token_id,
        bt.used,
        bt.expires_at,
        bt.payment_id,
        p.status AS payment_status,
        p.email AS email,
        p.visit_type AS visit_type,
        b.id AS booking_id
      FROM booking_tokens bt
      JOIN payments p ON p.id = bt.payment_id
      JOIN bookings b ON b.payment_id = p.id
      WHERE bt.token = ?
      LIMIT 1
      FOR UPDATE
      `,
      [token]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: "Token non trovato" });
    }

    const r = rows[0];

    if (r.used) {
      await conn.rollback();
      return res.status(410).json({ ok: false, error: "Token già usato" });
    }

    if (new Date(r.expires_at) <= new Date()) {
      await conn.rollback();
      return res.status(410).json({ ok: false, error: "Token scaduto" });
    }

    if (r.payment_status !== "paid") {
      await conn.rollback();
      return res.status(403).json({ ok: false, error: "Pagamento non confermato" });
    }

    // check slot occupato (DB ha anche UNIQUE su scheduled_at)
    const [busy] = await conn.query(
      `SELECT id FROM bookings WHERE scheduled_at = ? LIMIT 1 FOR UPDATE`,
      [mysqlDatetime]
    );

    if (busy.length) {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "Orario già occupato, scegli un altro slot" });
    }

    await conn.query(
      `UPDATE bookings SET scheduled_at = ?, status = 'scheduled' WHERE id = ?`,
      [mysqlDatetime, r.booking_id]
    );

    await conn.query(`UPDATE booking_tokens SET used = TRUE WHERE id = ?`, [
      r.token_id,
    ]);

    await conn.commit();

    // email conferma (non blocca)
    try {
      const resp = await sendScheduledConfirmationEmail({
        to: r.email,
        scheduledAt: mysqlDatetime,
        visitType: r.visit_type,
      });
      console.log("SendGrid CONFIRM accepted:", resp?.[0]?.statusCode);
    } catch (e) {
      console.error("Errore invio email conferma (non blocco):", e?.response?.body || e);
    }

    return res.json({ ok: true, bookingId: r.booking_id, scheduledAt: mysqlDatetime });
  } catch (e) {
    await conn.rollback();
    console.error("scheduleBookingWithToken error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/bookings/:id
 */
export const getBookingById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "ID non valido" });
    }

    const [rows] = await db.query(
      `
      SELECT 
        b.id,
        b.email,
        b.visit_type,
        b.status,
        b.scheduled_at,
        b.created_at,
        b.updated_at,
        p.amount,
        p.status AS payment_status
      FROM bookings b
      JOIN payments p ON p.id = b.payment_id
      WHERE b.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Prenotazione non trovata" });
    }

    return res.json({ ok: true, booking: rows[0] });
  } catch (e) {
    console.error("getBookingById error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

/**
 * GET /api/bookings/available-slots?date=YYYY-MM-DD
 * Ritorna lista di "HH:MM" disponibili (durata visita = APPT_DURATION_MIN).
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const date = req.query.date; // "YYYY-MM-DD"
    if (!date) return res.status(400).json({ ok: false, error: "Data mancante" });

    // === CONFIG (da env, con default) ===
    const durationMin = parseInt(process.env.APPT_DURATION_MIN || "60", 10);

    const morningStart = process.env.WORK_START_MORNING || "09:00";
    const morningEnd = process.env.WORK_END_MORNING || "13:00";

    const afternoonStart = process.env.WORK_START_AFTERNOON || "15:00";
    const afternoonEnd = process.env.WORK_END_AFTERNOON || "19:00";

    const openDays = (process.env.OPEN_DAYS || "1,2,3,4,5")
      .split(",")
      .map((x) => parseInt(x.trim(), 10))
      .filter(Boolean);

    // === helpers ===
    const parseHHMM = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return { h, m };
    };

    const buildSlotsForWindow = ({ dateStr, startHHMM, endHHMM }) => {
      const { h: sh, m: sm } = parseHHMM(startHHMM);
      const { h: eh, m: em } = parseHHMM(endHHMM);

      const start = new Date(`${dateStr}T00:00:00`);
      start.setHours(sh, sm, 0, 0);

      const end = new Date(`${dateStr}T00:00:00`);
      end.setHours(eh, em, 0, 0);

      const slots = [];
      for (let t = new Date(start); t.getTime() + durationMin * 60000 <= end.getTime();) {
        slots.push(t.toISOString().slice(11, 16)); // HH:MM
        t = new Date(t.getTime() + durationMin * 60000);
      }
      return slots;
    };

    // === check giorno aperto ===
    const jsDay = new Date(`${date}T00:00:00`).getDay(); // 0 dom ... 6 sab
    const day1to7 = jsDay === 0 ? 7 : jsDay;

    if (!openDays.includes(day1to7)) {
      return res.json({ ok: true, date, availableSlots: [] });
    }

    // === booked ===
    const [rows] = await db.query(
      `SELECT scheduled_at
       FROM bookings
       WHERE scheduled_at >= ?
       AND scheduled_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [`${date} 00:00:00`, `${date} 00:00:00`]
    );

    const bookedSet = new Set(
      rows
        .filter((r) => r.scheduled_at)
        .map((r) => new Date(r.scheduled_at).toISOString().slice(11, 16))
    );

    // === generate all slots ===
    let allSlots = [];
    allSlots = allSlots.concat(buildSlotsForWindow({ dateStr: date, startHHMM: morningStart, endHHMM: morningEnd }));
    allSlots = allSlots.concat(buildSlotsForWindow({ dateStr: date, startHHMM: afternoonStart, endHHMM: afternoonEnd }));

    // === remove past slots if today ===
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (date === todayStr) {
      const curHHMM = now.toISOString().slice(11, 16);
      allSlots = allSlots.filter((s) => s > curHHMM);
    }

    // === available ===
    const availableSlots = allSlots.filter((s) => !bookedSet.has(s));

    return res.json({ ok: true, date, availableSlots });
  } catch (err) {
    console.error("getAvailableSlots error:", err);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

export const getAvailableDays = async (req, res) => {
  try {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const jsDay = d.getDay(); // 0 = domenica, 6 = sabato

      // salta sabato e domenica
      if (jsDay === 0 || jsDay === 6) {
        continue;
      }

      const date = d.toISOString().slice(0, 10);
      const [closedRows] = await db.query(
  `SELECT id FROM closed_days WHERE date = ? LIMIT 1`,
  [date]
);

if (closedRows.length) {
  continue;
}

      const [rows] = await db.query(
        `SELECT COUNT(*) as booked
         FROM bookings
         WHERE DATE(scheduled_at) = ?`,
        [date]
      );

      const booked = rows[0].booked;
      const MAX_PER_DAY = 8;

      days.push({
        date,
        available: MAX_PER_DAY - booked
      });
    }

    res.json({
      ok: true,
      days
    });
  } catch (err) {
    console.error("getAvailableDays error:", err);
    res.status(500).json({ ok: false, error: "Errore server" });
  }
};