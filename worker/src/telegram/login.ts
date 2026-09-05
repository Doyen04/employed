import readline from 'node:readline/promises'

import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions'

import { config } from '../config'
import { setSessionString } from './sessionStore'

async function main() {
  if (!config.TELEGRAM_API_ID || !config.TELEGRAM_API_HASH) {
    console.error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required in worker/.env')
    process.exit(1)
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const client = new TelegramClient(
    new StringSession(''),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 5 },
  )

  await client.start({
    phoneNumber: async () => {
      const value = await rl.question('Phone number (e.g. +15551234567): ')
      return value.trim()
    },
    password: async () => {
      const value = await rl.question('2FA password (if set, else press Enter): ')
      return value.trim()
    },
    phoneCode: async () => {
      const value = await rl.question('Code sent by Telegram: ')
      return value.trim()
    },
    onError: (error) => {
      console.error('Login error:', error)
    },
  })

  const session = client.session.save()
  await setSessionString(session)
  console.log('Session authenticated and stored (encrypted in the database).')
  console.log('The worker will pick it up on next start.')

  rl.close()
  await client.disconnect()
  process.exit(0)
}

main().catch((error) => {
  console.error('Login failed:', error)
  process.exit(1)
})