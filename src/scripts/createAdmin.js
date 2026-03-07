import bcrypt from "bcrypt";
import { db } from "../config/db.js";

const run = async () => {
  try {
    const email = "admin@clinica.it";
    const plainPassword = "PasswordSuperSicura123!";

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await db.query(
      `INSERT INTO admin_users (email, password_hash) VALUES (?, ?)`,
      [email, passwordHash]
    );

    console.log("Admin creato con successo");
    process.exit(0);
  } catch (e) {
    console.error("Errore creazione admin:", e);
    process.exit(1);
  }
};

run();