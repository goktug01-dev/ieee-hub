import { getApps } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';

/** Hub çıkışı sırasında ayrı site oturumlarının da tarayıcıdan kaldırılması gerekir. */
export async function disconnectExternalSessions() {
  await Promise.allSettled(getApps().filter((app) => app.name.startsWith('ieee-hub-external-')).map((app) => signOut(getAuth(app))));
}
