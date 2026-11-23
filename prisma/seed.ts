import { prisma } from "../src/lib/prisma";
import { seedReferenceData } from "../src/modules/reference/seeds";

seedReferenceData()
  .then((created) => console.log("Reference data seeded:", created))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
