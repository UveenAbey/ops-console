const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const db = require('../utils/database')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await db.query(
      `SELECT id, email, password_hash, role, active
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = result.rows[0]

    if (!user.active) {
      return res.status(403).json({ error: 'User is disabled' })
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Password login not configured for this user' })
    }

    const match = await bcrypt.compare(password, user.password_hash)

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const secret = process.env.JWT_SECRET

    if (!secret) {
      logger.error('JWT_SECRET is not configured')
      return res.status(500).json({ error: 'Authentication not configured' })
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      secret,
      { expiresIn: '1d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    logger.error('Error during login', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', async (req, res) => {
  try {
    res.json({ success: true })
  } catch (error) {
    logger.error('Error during logout', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
