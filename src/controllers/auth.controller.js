import bcrypt from "bcrypt";
import { db } from "../config/db.js";

export const loginAdmin = async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password || "";

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email e password obbligatorie" });
    }

    const [rows] = await db.query(
      `SELECT * FROM admin_users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ ok: false, error: "Credenziali non valide" });
    }

    const admin = rows[0];

    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      return res.status(401).json({ ok: false, error: "Credenziali non valide" });
    }

    req.session.admin = {
      id: admin.id,
      email: admin.email,
    };

    return res.json({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    });
  } catch (e) {
    console.error("loginAdmin error:", e);
    return res.status(500).json({ ok: false, error: "Errore server" });
  }
};

export const logoutAdmin = async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    return res.json({ ok: true });
  });
};

export const getMeAdmin = async (req, res) => {
  if (!req.session?.admin) {
    return res.status(401).json({ ok: false, error: "Non autenticato" });
  }

  return res.json({
    ok: true,
    admin: req.session.admin,
  });
};