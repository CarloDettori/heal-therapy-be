import mysql from 'mysql2/promise';

export const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'clinic_db',
    waitForConnections: true,
    connectionLimit: 10
});