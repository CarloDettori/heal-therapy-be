import sgMail from '../config/sendgrid.js';

export const sendBookingEmail = async (email, token) => {
    const msg = {
        to: email,
        from: 'prenotazioni@clinica.it',
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

    await sgMail.send(msg);
};