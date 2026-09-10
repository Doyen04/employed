import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions'

import { config } from '../config'

export function createClient(session = ''): TelegramClient<StringSession> {
    return new TelegramClient(
        new StringSession(session),
        Number(config.TELEGRAM_API_ID ?? 0),
        config.TELEGRAM_API_HASH ?? '',
        { connectionRetries: 5 },
    )
}
