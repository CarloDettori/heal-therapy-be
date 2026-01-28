export const getBookingPage = (req, res) => {
    res.send(`
    <h1>Prenota la tua visita</h1>
    <iframe
      src="https://calendar.google.com/calendar/appointments/schedules/XXXX"
      width="100%"
      height="600"
      frameborder="0">
    </iframe>
  `);
};