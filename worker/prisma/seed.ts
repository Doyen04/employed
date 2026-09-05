import { PrismaClient } from '../src/generated/prisma/client.js'

import { getDatabaseUrl } from '../src/database-url.js'

import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  const demoConfig = await prisma.analysisConfig.upsert({
    where: { id: 'demo-analysis' },
    update: {},
    create: {
      id: 'demo-analysis',
      name: 'Urgency detector',
      promptTemplate:
        'Analyze this Telegram message. Return JSON only.\nMessage: {{text}}\nUse this schema: {{schema}}',
      outputSchema: {
        type: 'object',
        properties: {
          urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
          category: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['urgency', 'category', 'summary'],
      },
      isActive: true,
    },
  })

  const demoNotifier = await prisma.notifier.upsert({
    where: { id: 'demo-webhook' },
    update: {},
    create: {
      id: 'demo-webhook',
      name: 'Sample webhook (off)',
      type: 'webhook',
      config: {
        url: 'https://example.com/hooks/demo',
        headers: {},
      },
      isActive: false,
    },
  })

  const demoRule = await prisma.actionRule.upsert({
    where: { id: 'demo-rule' },
    update: {},
    create: {
      id: 'demo-rule',
      analysisConfigId: demoConfig.id,
      condition: { urgency: 'high' },
      notifierId: demoNotifier.id,
      isActive: false,
    },
  })

  console.log('✅ Seeded analysis config, notifier, and rule:', {
    demoConfig: demoConfig.id,
    demoNotifier: demoNotifier.id,
    demoRule: demoRule.id,
  })
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })