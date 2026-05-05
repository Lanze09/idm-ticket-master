/**
 * Manual seed runner.
 *
 * Idempotent: if the users table already has rows, this is a no-op.
 * Use `npm run db:reset` if you want to wipe and re-seed instead.
 *
 * Run with:   npm run db:seed
 */
import { seedIfEmpty } from '../src/lib/seed';
import { closeDb, db } from '../src/lib/db';

async function main(): Promise<void> {
  // Touch the DB to trigger schema bootstrap.
  db();

  const before = countUsers();
  await seedIfEmpty();
  const after = countUsers();

  if (after > before) {
    console.log(`✅ Seeded demo data (${after} users, projects, and tickets created).`);
    printDemoAccounts();
  } else {
    console.log(`ℹ️  Database already has ${before} users — seed skipped (idempotent).`);
    console.log('   Run `npm run db:reset` if you want to wipe and start fresh.');
  }
  closeDb();
}

function countUsers(): number {
  const row = db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number } | undefined;
  return row?.n ?? 0;
}

function printDemoAccounts(): void {
  console.log('\nDemo accounts:');
  console.log('  admin@idm.com           / admin123    (admin · all projects)');
  console.log('  backup.admin@idm.com    / admin123    (admin · all projects)');
  console.log('  northwind.user@idm.com  / user123     (user  · Northwind only)');
  console.log('  contoso.user@idm.com    / user123     (user  · Contoso only)');
  console.log('  multi.user@idm.com      / user123     (user  · Northwind + Fabrikam)');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
