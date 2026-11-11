import { FieldPath, Timestamp, collection, doc, getDocFromServer, getDocsFromServer, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { millis, roleKeys } from './core.mjs';

export function mailStore(db) {
  const get = async path => { const snapshot = await getDocFromServer(doc(db, path)); return snapshot.exists() ? snapshot.data() : null; };
  const optionalTarget = async uid => {
    try { return await get(`mailRecipients/${uid}`); }
    catch (error) { if (error.code === 'permission-denied') return null; throw error; }
  };
  const record = async (id, data) => {
    await setDoc(doc(db, 'mailDeliveries', id), { ...data,
      nextAttemptAt: Timestamp.fromMillis(millis(data.nextAttemptAt)), updatedAt: serverTimestamp() });
  };
  return {
    settings: () => get('settings/mail'),
    signals: async count => (await getDocsFromServer(query(collection(db, 'mailSignals'), where('state', '==', 'pending'), where('readyAt', '<=', Timestamp.now()), orderBy('readyAt'), limit(count))))
      .docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })),
    source: signal => get(`${signal.kind === 'petition' ? 'petitions' : 'tasks'}/${signal.sourceId}`),
    candidates: async (kind, source) => {
      if (kind === 'task') return [{ uid: source.assigneeUid }];
      const candidates = new Map();
      for (const key of roleKeys(source)) {
        const snapshot = await getDocsFromServer(query(collection(db, 'access'), where(new FieldPath('roleKeys', key), '>', Timestamp.now())));
        snapshot.docs.forEach(item => candidates.set(item.id, { uid: item.id }));
      }
      return [...candidates.values()];
    },
    recipient: async (uid, kind) => ({ recipient: await optionalTarget(uid), access: kind === 'petition' ? await get(`access/${uid}`) : null }),
    delivery: id => get(`mailDeliveries/${id}`),
    claim: async (id, identity, _settings, now) => {
      const reserve = () => runTransaction(db, async tx => {
      const target = doc(db, 'mailDeliveries', id);
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
      const counter = doc(db, 'mailDaily', day);
      const [current, daily, config] = await Promise.all([tx.get(target), tx.get(counter), tx.get(doc(db, 'settings/mail'))]);
      const previous = current.data();
      if (!config.data()?.enabled || config.data().senderEmail !== _settings.senderEmail || config.data().hubUrl !== _settings.hubUrl
        || (previous && (['sent','sending','uncertain','skipped'].includes(previous.state) || millis(previous.nextAttemptAt) > now))) return null;
      const attempts = daily.data()?.attempts ?? 0;
      if (attempts >= config.data().maxPerDay) return null;
      const claim = { ...identity, state: 'sending', attempts: (previous?.attempts ?? 0) + 1, nextAttemptAt: Timestamp.fromMillis(0), errorCode: '' };
      tx.set(counter, { attempts: attempts + 1, updatedAt: serverTimestamp() });
      tx.set(target, { ...claim, updatedAt: serverTimestamp() });
      return claim;
      });
      for (let retry = 0; retry < 3; retry++) {
        try { return await reserve(); }
        catch (error) {
          // Çakışan sayaç yazımı bazı SDK/emülatör sürümlerinde önkoşuldan önce
          // Rules tarafından reddedilir. Yetkiyi gevşetmeden sunucudan tekrar oku.
          if (!['permission-denied','aborted','failed-precondition'].includes(error.code) || retry === 2) throw error;
          const config = await get('settings/mail');
          if (!config?.enabled || config.senderEmail !== _settings.senderEmail || config.hubUrl !== _settings.hubUrl) return null;
          const current = await get(`mailDeliveries/${id}`);
          if (current && (['sending','sent','uncertain','skipped'].includes(current.state) || millis(current.nextAttemptAt) > now)) return null;
        }
      }
      return null;
    },
    record,
    finishSignal: async (signal, state, readyAt = Date.now()) => runTransaction(db, async tx => {
      const target = doc(db, 'mailSignals', signal.id);
      const current = await tx.get(target);
      if (current.exists() && current.data().sourceVersion.isEqual(signal.sourceVersion)
        && current.data().queuedAt.isEqual(signal.queuedAt)) tx.update(target, { state, readyAt: Timestamp.fromMillis(readyAt) });
    }),
    health: summary => setDoc(doc(db, 'mailHealth/current'), { ...summary, at: serverTimestamp() }),
  };
}
