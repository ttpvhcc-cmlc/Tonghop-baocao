import fs from 'fs';

const migrationSql = fs.readFileSync('supabase/migrations/001_initial.sql', 'utf-8');
const seedSql = fs.readFileSync('supabase/seed.sql', 'utf-8');

const output = `// Auto-generated from supabase/migrations/001_initial.sql and supabase/seed.sql

export const INITIAL_MIGRATION_SQL = ${JSON.stringify(migrationSql)};

export const SEED_DATA_SQL = ${JSON.stringify(seedSql)};
`;

fs.writeFileSync('src/services/sqlScripts.ts', output);
console.log('src/services/sqlScripts.ts created successfully.');
