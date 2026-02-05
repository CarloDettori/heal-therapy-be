
import { db } from '../config/db.js';
import { createToken } from '../services/tooken.service.js';
import { sendBookingEmail } from '../services/email.service.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log('STRIPE KEY:', process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email mancante' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: email,
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Videochiamata medica',
                            description: 'Consulenza online'
                        },
                        unit_amount: 3000 // €30.00
                    },
                    quantity: 1
                }
            ],
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`
        });

        // Salviamo pagamento come pending
        await db.query(
            'INSERT INTO payments (email, stripe_session_id, amount, status) VALUES (?, ?, ?, ?)',
            [email, session.id, 10000, 'pending']
        );

        //ritorna al checkout
        res.json({ url: session.url });

    } catch (err) {
        console.error('Stripe checkout error MESSAGE:', err.message);
        console.error('Stripe checkout error FULL:', err);
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
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
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

            // Crea token di prenotazione
            const token = await createToken(payment.id);

            // Invia email al paziente
            await sendBookingEmail(payment.email, token);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Errore webhook Stripe' });
    }
};