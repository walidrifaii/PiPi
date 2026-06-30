import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = PrismaService.create();

  await prisma.appVersion.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      latestVersion: '1.0.0',
      minVersion: '1.0.0',
      androidUrl: null,
      iosUrl: null,
    },
    update: {},
  });

  console.log('✅ app_version seeded — default row inserted (id=1)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
