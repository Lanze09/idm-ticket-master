import { db } from './db';
import { hashPassword } from './auth';

export async function seedIfEmpty(): Promise<void> {
  const conn = db();
  const userCount = (conn.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (userCount > 0) return;

  const projects = [
    { code: 'NORTHWIND', name: 'Northwind Trading Co.' },
    { code: 'CONTOSO', name: 'Contoso Manufacturing' },
    { code: 'FABRIKAM', name: 'Fabrikam Logistics' },
  ];
  const insertProject = conn.prepare('INSERT INTO projects (code, name) VALUES (?, ?)');
  const projectIds: Record<string, number> = {};
  for (const p of projects) {
    const r = insertProject.run(p.code, p.name);
    projectIds[p.code] = Number(r.lastInsertRowid);
  }

  const adminPwd = await hashPassword('admin123');
  const userPwd = await hashPassword('user123');

  const insertUser = conn.prepare(
    'INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)',
  );
  const linkProject = conn.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)');

  // Admin (sees everything)
  const adminId = Number(
    insertUser.run('admin@idm.com', 'Alex Admin', 'admin', adminPwd).lastInsertRowid,
  );
  for (const code of Object.keys(projectIds)) linkProject.run(adminId, projectIds[code]!);

  // Conversion-team users
  const u1 = Number(
    insertUser.run('northwind.user@idm.com', 'Nina Northwind', 'user', userPwd).lastInsertRowid,
  );
  linkProject.run(u1, projectIds['NORTHWIND']!);

  const u2 = Number(
    insertUser.run('contoso.user@idm.com', 'Carlos Contoso', 'user', userPwd).lastInsertRowid,
  );
  linkProject.run(u2, projectIds['CONTOSO']!);

  const u3 = Number(
    insertUser.run('multi.user@idm.com', 'Mira Multi', 'user', userPwd).lastInsertRowid,
  );
  linkProject.run(u3, projectIds['NORTHWIND']!);
  linkProject.run(u3, projectIds['FABRIKAM']!);

  // Backup admin (so assignment dropdown has options)
  const backupId = Number(
    insertUser.run('backup.admin@idm.com', 'Bea Backup', 'admin', adminPwd).lastInsertRowid,
  );
  for (const code of Object.keys(projectIds)) linkProject.run(backupId, projectIds[code]!);

  // A few sample tickets so the dashboard is not empty.
  const now = new Date().toISOString();
  const t1 = conn.prepare(`
    INSERT INTO tickets (
      ticket_number, project_id, created_by_id, encountered_in, issue,
      go_live, production, mock_lifecycle, status, severity, priority,
      assigned_to_id, escalated, acknowledged_at, sla_expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, 0, 'Mock3', 'New', 'Low', 'Low', NULL, 0, NULL, NULL, ?, ?)
  `);
  t1.run('IDM-202605-0001', projectIds['NORTHWIND'], u1,
    'Conversion Run #42', 'IDM throws "INVALID_TARGET" when running customer migration.', now, now);
  t1.run('IDM-202605-0002', projectIds['CONTOSO'], u2,
    'Reconciliation step', 'Reconciliation export is missing two columns (TaxCode, Region).', now, now);

  const ackedAt = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();
  conn.prepare(`
    INSERT INTO tickets (
      ticket_number, project_id, created_by_id, encountered_in, issue,
      go_live, production, mock_lifecycle, status, severity, priority,
      assigned_to_id, escalated, acknowledged_at, sla_expires_at, created_at, updated_at
    ) VALUES ('IDM-202605-0003', ?, ?, ?, ?, 1, 1, 'PROD', 'Open', 'High', 'High', ?, 0, ?, ?, ?, ?)
  `).run(
    projectIds['FABRIKAM'], u3,
    'Production cutover', 'During PROD cutover, IDM job hangs at "Transform stage" — investigation in progress.',
    adminId, ackedAt,
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 5 - 1000 * 60 * 60 * 6).toISOString(),
    ackedAt, ackedAt,
  );
}
