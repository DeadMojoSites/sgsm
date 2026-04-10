'use strict';

const jwt = require('jsonwebtoken');
const db  = require('../services/database');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token  = header.slice(7);
  const secret = db.getSetting('jwt_secret');
  if (!secret) return res.status(500).json({ error: 'Server configuration error' });

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
