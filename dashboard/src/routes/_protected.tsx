import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'

import { getSession } from '../server/auth'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session.authenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})