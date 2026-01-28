import 'dotenv/config';
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log('ENV CHECK:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    db: process.env.DB_NAME
});

try {
    const connection = await db.getConnection();
    console.log('Connection to database completed!');
    connection.release();
} catch (err) {
    console.error('Connection to DataBase Failed:', err.message);
    process.exit(1);
}

export default db;