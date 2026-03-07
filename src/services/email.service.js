import sgMail from '../config/sendgrid.js';

export const sendBookingEmail = async (email, token) => {
    const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Prenota la tua Visita in clinica RC',
        html: `
        <h1>IGNORA QUESTA MAIL SE HAI GIA PRENOTATO LA VISITA<h1/>
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

export const sendScheduledConfirmationEmail = async ({ to, scheduledAt, visitType }) => {
  const when = new Date(scheduledAt);

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: "Prenotazione confermata",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Prenotazione confermata ✅</h2>

        <p>Gentile paziente, la sua prenotazione è stata confermata.</p>

        <p><strong>Tipo visita:</strong> ${
          visitType === "in_person" ? "In presenza" : "Online"
        }</p>

        <p><strong>Data e ora:</strong> ${when.toLocaleString("it-IT")}</p>

        <p><strong>Indirizzo:</strong> ${process.env.CLINIC_ADDRESS || "Indirizzo clinica da definire"}</p>

        <p>La invitiamo a presentarsi con qualche minuto di anticipo.</p>

        <p>Se ha bisogno di modificare o annullare la prenotazione, contatti la clinica.</p>
      </div>
    `
  };

  return await sgMail.send(msg);
};

export const sendCancelledBookingEmail = async ({ to, scheduledAt, visitType }) => {
  const when = scheduledAt ? new Date(scheduledAt) : null;

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: "Prenotazione annullata",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Prenotazione annullata</h2>

        <p>Gentile paziente, la sua prenotazione è stata annullata.</p>

        <p><strong>Tipo visita:</strong> ${
          visitType === "in_person" ? "In presenza" : "Online"
        }</p>

        ${
          when
            ? `<p><strong>Appuntamento previsto per:</strong> ${when.toLocaleString("it-IT")}</p>`
            : ""
        }

        <p>Per maggiori informazioni o per fissare una nuova data, contatti la clinica.</p>
      </div>
    `,
  };

  return await sgMail.send(msg);
};

export const sendRescheduledBookingEmail = async ({
  to,
  oldScheduledAt,
  newScheduledAt,
  visitType,
}) => {
  const oldWhen = oldScheduledAt ? new Date(oldScheduledAt) : null;
  const newWhen = new Date(newScheduledAt);

  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: "Prenotazione modificata",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Prenotazione modificata</h2>

        <p>Gentile paziente, la sua prenotazione è stata spostata.</p>

        <p><strong>Tipo visita:</strong> ${
          visitType === "in_person" ? "In presenza" : "Online"
        }</p>

        ${
          oldWhen
            ? `<p><strong>Data precedente:</strong> ${oldWhen.toLocaleString("it-IT")}</p>`
            : ""
        }

        <p><strong>Nuova data e ora:</strong> ${newWhen.toLocaleString("it-IT")}</p>

        <p><strong>Indirizzo:</strong> ${
          process.env.CLINIC_ADDRESS || "Indirizzo clinica da definire"
        }</p>

        <p>Se ha bisogno di ulteriori modifiche, contatti la clinica.</p>
      </div>
    `,
  };

  return await sgMail.send(msg);
};