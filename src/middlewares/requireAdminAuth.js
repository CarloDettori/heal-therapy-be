export const requireAdminAuth = (req, res, next) => {
  if (!req.session?.admin) {
    return res.status(401).json({ ok: false, error: "Non autenticato" });
  }

  next();
};