import { Router } from 'express'

import { hasSession } from '../../telegram/sessionStore'

export const telegramRouter = Router()

telegramRouter.get('/status', async (_req, res) => {
  res.json({ loggedIn: await hasSession() })
})