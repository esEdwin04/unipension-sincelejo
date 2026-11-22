// Punto de entrada de Vercel: la API de Express se ejecuta como función sin servidor.
// Las rutas /api/* llegan aquí (ver vercel.json); el frontend lo sirve la CDN desde client/dist.
module.exports = require('../backend/server');
