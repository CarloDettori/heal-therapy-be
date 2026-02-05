import express from 'express';
import cors from 'cors';

import paymentsRoutes from './routes/payment.routes.js';
import testRoutes from "./routes/test.routes.js";

const app = express();

/* middlewares */
app.use(cors());

app.use(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' })
);
app.use(express.json());
app.use(express.static("public"));

/* rotte */
app.use('/api/payments', paymentsRoutes);
app.use('/test', testRoutes);

//console.log(process.env.STRIPE_SECRET_KEY.startsWith('sk_test_'));
//console.log("CLIENT_URL:", process.env.CLIENT_URL);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

/*error catcher*/
app.use((req, res) => {
    res.status(404).json({ message: 'Route non trovata' });
});

export default app;