import 'dotenv/config'

import { z } from 'zod'

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(8000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    WORKER_API_KEY: z.string().min(8, 'WORKER_API_KEY must be at least 8 characters'),
    ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 characters'),
    TELEGRAM_API_ID: z.coerce.number().optional(),
    TELEGRAM_API_HASH: z.string().optional(),
    LLM_PROVIDER: z.enum(['groq', 'openrouter']).default('groq'),
    LLM_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.enum(['true', 'false']).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    SOCKET_TOKEN: z.string().optional(),
    CORS_ORIGIN: z.string().default('*'),
})

const parsed = envSchema.parse(process.env)

export const config = {
    ...parsed,
    socketToken: parsed.SOCKET_TOKEN ?? parsed.WORKER_API_KEY,
}

export type Config = typeof config