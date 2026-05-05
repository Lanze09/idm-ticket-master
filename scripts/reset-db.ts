/**
 * Wipe the SQLite database and re-seed.
 *
 * Deletes the .db, .db-wal, .db-shm, and .db-journal files, then re-runs
 * the seed so you're back to a clean demo state.
 *
 * Run with:   npm run db:reset
 *
 * WARNING: this destroys all tickets, comments, and any non-demo users.
 *          Only run in dev / demo environments.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

async function main(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || './data/idm-ticket-master.db';
  const absolute = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

  if (process.env.SKIP_CONFIRM !== '1' && process.stdin.isTTY) {
    const ok = await confirm(`This will delete the database at:\n  ${absolute}\nAre you sure? (y/N) `);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  let removed = 0;
  for (const ext of ['', '-journal', '-wal', '-shm']) {
    const file = absolute + ext;
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`  removed ${file}`);
        removed += 1;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EBUSY' || code === 'EPERM') {
          console.error(`\n❌ Could not delete ${file} — file is in use.`);
          console.error('   Stop the running app first (e.g. `pm2 stop idm-ticket` or Ctrl+C the dev server),');
          console.error('   then run `npm run db:reset` again.\n');
          process.exit(1);
        }
        throw err;
      }
    }
  }
  if (removed === 0) {
    console.log(`  (no existing database files at ${absolute})`);
  }

  // Schema bootstrap + seed run when we touch the db module.
  const { db, closeDb } = await import('../src/lib/db');
  const { seedIfEmpty } = await import('../src/lib/seed');
  db();
  await seedIfEmpty();
  closeDb();

  console.log('✅ Database reset and re-seeded.\n');
  console.log('Demo accounts:');
  console.log('  admin@idm.com           / admin123');
  console.log('  northwind.user@idm.com  / user123');
  console.log('  contoso.user@idm.com    / user123');
  console.log('  multi.user@idm.com      / user123');
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

main().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
