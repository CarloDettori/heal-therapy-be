
import { db } from '../config/db.js';
import { createToken } from '../services/tooken.service.js';
import { sendBookingEmail } from '../services/email.service.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log('STRIPE KEY:', process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
   
    try {
       
        const { email, visitType } = req.body;

        const onlineEnabled = process.env.ENABLE_ONLINE_VISITS === 'true';

        if (visitType === 'online' && !onlineEnabled) {
            return res.status(400).json({
                error: 'Le visite online sono temporaneamente disabilitate'
            });
        }


        if (!email) {
            return res.status(400).json({ error: 'Email mancante' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],

            customer_email: email,
            mode: 'payment',
            metadata: {
                visitType: visitType
            },
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        unit_amount: 3000, // €30.00
                        product_data: {
                            name: visitType === 'online'
                                ? 'Videochiamata medica'
                                : 'Visita in presenza',
                        },
                    },
                    quantity: 1
                }
            ],
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`
        });

        // Salviamo pagamento come pending
        await db.query(
            'INSERT INTO payments (email, stripe_session_id, amount, status, visit_type) VALUES (?, ?, ?, ?, ?)',
            [email, session.id, 10000, 'pending', visitType]
        );
     
        //ritorna al checkout
        res.json({ url: session.url });

    } catch (err) {
        console.error('Stripe checkout error MESSAGE:', err.message);
        console.error('Stripe checkout error FULL:', err);
        console.error('SendGrid full error:', e?.response?.body || e);
        res.status(500).json({
            error: err.message
        });
    }
};

/*
 * Webhook Stripe
 * chiamato SOLO da Stripe
 */

export const stripeWebhook = async (req, res) => {
    console.log('WEBHOOK enter ');
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log('EVENT TYPE:', event.type);
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            // Recupero pagamento
            const [rows] = await db.query(
                'SELECT * FROM payments WHERE stripe_session_id = ?',
                [session.id]
            );

            if (!rows.length) {
                console.warn('Pagamento non trovato:', session.id);
                return res.json({ received: true });
            }

            const payment = rows[0];

            // Evitiamo doppia esecuzione
            if (payment.status === 'paid') {
                return res.json({ received: true });
            }

            // Segna pagamento come pagato
            await db.query(
                'UPDATE payments SET status = "paid" WHERE id = ?',
                [payment.id]
            );

            // Controlla se booking esiste già
            const [existingBooking] = await db.query(
            'SELECT id FROM bookings WHERE payment_id = ?',
            [payment.id]
            );

        if (!existingBooking.length) {
            await db.query(
                `INSERT INTO bookings (payment_id, email, visit_type)
                VALUES (?, ?, ?)`,
            [payment.id, payment.email, payment.visit_type]
            );
        }

            // Crea prenotazione
            await db.query(
                'INSERT INTO bookings (payment_id, email, visit_type, status) VALUES (?, ?, ?, ?)',
                [
                    payment.id,
                    payment.email,
                    session.metadata.visitType,
                    'confirmed'
                ]
            );


            // Crea token di prenotazione
            const token = await createToken(payment.id);

            //da cancellare
            console.log("TOKEN CREATO:", token);
            console.log('Invio email a:', payment.email);

        try {
            const resp = await sendBookingEmail(payment.email, token);
            console.log('SendGrid OK:', resp);
        } catch (e) {
            console.error('SendGrid full error:', e?.response?.body || e);
        }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Errore webhook Stripe' });
    }
};

export const getBookingLinkBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [pRows] = await db.query(
      'SELECT * FROM payments WHERE stripe_session_id = ? LIMIT 1',
      [sessionId]
    );

    if (!pRows.length) {
      return res.status(404).json({ ok: false, error: 'Pagamento non trovato' });
    }

    const payment = pRows[0];

    if (payment.status !== 'paid') {
      return res.status(409).json({ ok: false, error: 'Pagamento non ancora confermato' });
    }

    const [tRows] = await db.query(
      'SELECT token, used, expires_at FROM booking_tokens WHERE payment_id = ? ORDER BY id DESC LIMIT 1',
      [payment.id]
    );

    if (!tRows.length) {
      return res.status(404).json({ ok: false, error: 'Token non trovato' });
    }

    const t = tRows[0];

    if (t.used) {
      return res.status(410).json({ ok: false, error: 'Token già usato' });
    }

    if (new Date(t.expires_at) <= new Date()) {
      return res.status(410).json({ ok: false, error: 'Token scaduto' });
    }

    return res.json({
      ok: true,
      bookingUrl: `${process.env.FRONTEND_URL}/prenota?token=${t.token}`,
      token: t.token,
    });
  } catch (e) {
    console.error('getBookingLinkBySession error:', e);
    return res.status(500).json({ ok: false, error: 'Errore server' });
  }
};

