import { db } from './db';
import type { Project } from './types';

export function listProjects(): Project[] {
  return db().prepare('SELECT id, code, name FROM projects ORDER BY name').all() as Project[];
}

export function listProjectsForUser(userId: number): Project[] {
  return db().prepare(`
    SELECT p.id, p.code, p.name FROM projects p
    JOIN user_projects up ON up.project_id = p.id
    WHERE up.user_id = ?
    ORDER BY p.name
  `).all(userId) as Project[];
}
