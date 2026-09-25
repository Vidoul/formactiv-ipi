import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Configuration du CLI Prisma (migrations versionnées, jeu de données de démonstration).
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
