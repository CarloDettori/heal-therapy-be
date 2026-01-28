import mysql from 'mysql2';

export const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

db.connect((err) => {
    if (err) {
        console.error("Connection to DataBase Failed:", err.message);
        return process.exit(1); // Termina il server con errore
    } else {
        console.log("Connection to database completed!");
    }
});

export default db