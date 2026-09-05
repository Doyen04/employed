import { PrismaClient } from './generated/prisma/client'

import { PrismaPg } from '@prisma/adapter-pg'

import { config } from './config'

const adapter = new PrismaPg({
    connectionString: config.DATABASE_URL,
})

declare global {
    var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma
}