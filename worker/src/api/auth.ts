import type { NextFunction, Request, Response } from 'express'

import { config } from '../config'

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

  if (!token || token !== config.WORKER_API_KEY) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  next()
}