import sgMail from '../config/sendgrid.js';

export const sendBookingEmail = async (email, token) => {
    const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Prenota la tua videochiamata',
        html: `
      <p>Pagamento ricevuto.</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/prenota?token=${token}">
          Clicca qui per prenotare
        </a>
      </p>
    `
    };

    return await sgMail.send(msg);
};