export const adminAuth = (req, res, next) => {
  const key = req.headers['credentials'];
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ ok: false, error: 'ADMIN_KEY non configurata' });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Non autorizzato' });
  }
  next();
};