const jwt = require('jsonwebtoken')
const logger = require('../utils/logger')

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || ''
  const parts = header.split(' ')

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = parts[1]

  try {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      logger.error('JWT_SECRET is not configured')
      return res.status(500).json({ error: 'Authentication not configured' })
    }

    const payload = jwt.verify(token, secret)
    req.user = payload
    next()
  } catch (error) {
    logger.error('JWT verification failed', { error: error.message })
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = authenticate

