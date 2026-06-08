
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

async function main() {
  const libsql = createClient({ url: 'file:./dev.db' });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });

  const empEmail = 'employee@recruitpro.com';
  const existing = await prisma.user.findUnique({ where: { email: empEmail } });
  if (existing) {
    console.log('Employee demo user already exists:', empEmail);
    await prisma.$disconnect();
    return;
  }

  const empUser = await prisma.user.create({
    data: {
      name: 'Demo Employee',
      email: empEmail,
      password: await bcrypt.hash('emp123', 10),
      role: 'EMPLOYEE',
    },
  });

  await prisma.candidate.create({
    data: {
      userId: empUser.id,
      firstName: 'Demo',
      lastName: 'Employee',
      email: empEmail,
      currentStage: 'JOINED',
      candidateStatus: 'ACTIVE',
    },
  });

  console.log('Created employee demo user:', empEmail);
  await prisma.$disconnect();
}

main().catch(console.error);
