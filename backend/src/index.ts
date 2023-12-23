import './config/env.config.js'

import cors from 'cors'
import express, { type Request, type Response } from 'express'
import http from 'node:http'
import { PORT } from './constants/envVars.js'
import LoggerService from './services/logger.services.js'
import { createIOServer } from './config/io.config.js'

const app = express()
const server = http.createServer(app)
const io = createIOServer(server)
// Middlewares
app.use(cors())

app.get('/health', (req: Request, res: Response) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  }

  try {
    res.status(200).send(health)
  } catch (e) {
    health.message = String(e) // Convert 'e' to string
    res.status(503).send()
  }
})

server.listen(PORT, () => {
  LoggerService.info(`🚀 server started at http://localhost:${PORT}`)
})

export { app, io }
