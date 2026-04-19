import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const userid = process.env.SEED_USERID || "admin";
  const password = process.env.SEED_PASSWORD || "admin1234";

  const passwordHash = await hash(password, 10);

  await prisma.user.upsert({
    where: { userid },
    create: { userid, passwordHash },
    update: { passwordHash },
  });

  console.log(`Seeded user: ${userid}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
