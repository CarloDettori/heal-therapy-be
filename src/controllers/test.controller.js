import { db } from '../config/db.js';

export const testInsert = async (req, res) => {
    try {
        const email = 'test-node@test.it';
        const sessionId = 'cs_test_node_123';
        const amount = 10000;

        const [result] = await db.query(
            `INSERT INTO payments (email, stripe_session_id, amount)
       VALUES (?, ?, ?)`,
            [email, sessionId, amount]
        );

        res.json({
            message: 'INSERT riuscita',
            insertedId: result.insertId
        });
    } catch (err) {
        console.error('DB INSERT ERROR:', err);
        res.status(500).json({ error: 'Errore INSERT DB' });
    }
};