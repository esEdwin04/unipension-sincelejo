// Control de acceso por perfil (RNF-06)
function requiereSesion(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ error: 'Debe iniciar sesión' });
  next();
}

function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.session.usuario) return res.status(401).json({ error: 'Debe iniciar sesión' });
    if (!roles.includes(req.session.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    next();
  };
}

module.exports = { requiereSesion, requiereRol };
