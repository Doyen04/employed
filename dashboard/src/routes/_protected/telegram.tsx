import { createFileRoute } from '@tanstack/react-router'

import { Panel } from '../../components/dashboard/Panel'
import { TelegramLoginCard, useTelegramLoggedIn } from '../../components/dashboard/TelegramLoginCard'

export const Route = createFileRoute('/_protected/telegram')({ component: TelegramPage })

function TelegramPage() {
  const { loggedIn, onDone, onDisconnect } = useTelegramLoggedIn()

  return (
    <Panel
      title="Telegram session"
      description={
        loggedIn
          ? 'The worker is authenticated — it can listen for incoming messages in real time.'
          : 'Authenticate the worker with your personal Telegram account via MTProto.'
      }
    >
      <TelegramLoginCard loggedIn={loggedIn} onDone={onDone} onDisconnect={onDisconnect} />
    </Panel>
  )
}