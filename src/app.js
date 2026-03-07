import express from 'express';
import cors from 'cors';

import paymentsRoutes from './routes/payment.routes.js';
import testRoutes from "./routes/test.routes.js";
import bookingRoutes from './routes/booking.routes.js';
import adminRoutes from './routes/admin.routes.js';
import session from "express-session";
import authRoutes from "./routes/auth.routes.js";



const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "super_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // true in produzione con https
      maxAge: 1000 * 60 * 60 * 8, // 8 ore
    },
  }));

  

/* middlewares */
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

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

app.use('/api/bookings', bookingRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/admin', adminRoutes);
app.use("/api/auth", authRoutes);
/*error catcher*/
app.use((req, res) => {
    res.status(404).json({ message: 'Route non trovata' });
});

export default app;