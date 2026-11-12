import { createHash } from 'node:crypto';

export const millis = value => typeof value?.toMillis === 'function' ? value.toMillis() : Number(value ?? 0);
export const openSource = (kind, source) => !!source && (kind === 'petition'
  ? source.status === 'pending' && !!source.steps?.[source.currentStep ?? 0]
  : ['todo', 'in_progress', 'blocked'].includes(source.status));
export function roleKeys(source) {
  const step = source.steps?.[source.currentStep ?? 0];
  if (!step) return [];
  const unit = step.unitMode === 'petition' ? source.unitId : step.unitMode === 'branch' ? 'branch' : step.unitId ?? 'branch';
  return step.roleIds.filter(role => !(source.stepApprovalRoleIds ?? []).includes(role)).map(role => `${unit}__${role}`);
}
export function fingerprint(kind, id, source) {
  return kind === 'petition' ? `petition:${id}:${source.revision ?? 1}:${source.currentStep ?? 0}`
    : `task:${id}:${source.assigneeUid}:${source.mailAssignmentKey ?? millis(source.createdAt)}`;
}
export const deliveryId = (key, uid) => createHash('sha256').update(`${key}\n${uid}`).digest('hex');
export function eligible(kind, source, uid, access, recipient, now = Date.now()) {
  if (!openSource(kind, source) || !recipient?.[kind === 'petition' ? 'petitions' : 'tasks']) return false;
  if (typeof recipient.email !== 'string' || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient.email)) return false;
  if (kind === 'task') return source.assigneeUid === uid;
  return source.ownerUid !== uid && roleKeys(source).some(key => millis(access?.roleKeys?.[key]) > now)
    && (source.visibleTo ?? []).some(token => (access?.tokens ?? []).includes(token));
}
export function mailMessage(settings, kind, id) {
  const url = new URL(settings.hubUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('invalid-hub-url');
  url.pathname = kind === 'petition' ? `/dilekceler/${encodeURIComponent(id)}` : '/gorevler';
  const subject = kind === 'petition' ? 'IEEE Hub · Onayınızı bekleyen dilekçe' : 'IEEE Hub · Size bir görev atandı';
  return { subject, text: `${kind === 'petition' ? 'Hub’da onayınızı bekleyen bir dilekçe var.' : 'Hub’da sorumlusu olduğunuz yeni bir görev var.'}\n\nAyrıntıları hesabınızla giriş yaparak inceleyin:\n${url.href}\n\nDilekçe metni ve ekleri bu e-postada paylaşılmaz. İşlem tamamlanmışsa güncel durumu Hub’da görebilirsiniz.\nBildirim tercihlerinizi Profilim sayfasından değiştirebilirsiniz:\n${settings.hubUrl}/profil` };
}
export function smtpFailure(error) {
  if (Number.isInteger(error?.responseCode)) return { state: 'failed', errorCode: 'smtp-rejected', permanent: error.responseCode >= 500 };
  if (['CONN','AUTH'].includes(error?.command) || error?.code === 'EAUTH') return { state: 'failed', errorCode: 'smtp-connection', permanent: false };
  return { state: 'uncertain', errorCode: 'smtp-uncertain', permanent: true };
}

/** store ve transport enjekte edilir; testlerde gerçek SMTP veya Admin SDK kullanılmaz. */
export async function processMail({ store, transport, sender, dryRun = true, now = () => Date.now() }) {
  const summary = { mode: dryRun ? 'dry-run' : 'live', result: 'ok', sent: 0, skipped: 0, uncertain: 0, errorCode: '' };
  try {
    const settings = await store.settings();
    if (!settings?.enabled) { summary.result = 'disabled'; return summary; }
    if (settings.senderEmail !== sender) throw new Error('sender-mismatch');
    mailMessage(settings, 'task', 'validation');
    await transport.verify(); // Kimlik/bağlantı hatasında teslim kaydı ve kota tüketilmez.
    const signals = await store.signals(settings.maxPerRun);
    let attempts = 0;
    for (const signal of signals) {
      if (attempts >= settings.maxPerRun) break;
      let source = await store.source(signal);
      if (!openSource(signal.kind, source)) {
        summary.skipped++;
        if (!dryRun) await store.finishSignal(signal, 'processed');
        continue;
      }
      const key = fingerprint(signal.kind, signal.sourceId, source);
      const candidates = await store.candidates(signal.kind, source);
      let pending = false, blocked = false, retryAt = Infinity;
      // İlk giriş / adres doğrulaması gecikirse yeni bildirimi kaybetmeyin.
      // Sınırsız tarama yapmadan 24 saat boyunca yarım saatte bir yeniden çözün.
      const queuedAt = millis(signal.queuedAt);
      const registrationWindowOpen = queuedAt > 0 && now() - queuedAt < 86400000;
      const awaitRegistration = () => {
        if (registrationWindowOpen) { pending = true; retryAt = Math.min(retryAt, now() + 1800000); }
      };
      if (!candidates.length) awaitRegistration();
      for (const candidate of candidates) {
        if (attempts >= settings.maxPerRun) { pending = true; retryAt = Math.min(retryAt, now() + 600000); break; }
        // Kaynak, rol/erişim ve adres gönderimden hemen önce yeniden okunur.
        const currentSettings = await store.settings();
        if (!currentSettings?.enabled || currentSettings.senderEmail !== sender) throw new Error('settings-changed');
        source = await store.source(signal);
        if (!openSource(signal.kind, source) || fingerprint(signal.kind, signal.sourceId, source) !== key) { pending = true; break; }
        const { access, recipient } = await store.recipient(candidate.uid, signal.kind);
        if (!recipient) { summary.skipped++; awaitRegistration(); continue; }
        if (!eligible(signal.kind, source, candidate.uid, access, recipient, now())) { summary.skipped++; continue; }
        const id = deliveryId(key, candidate.uid);
        const previous = await store.delivery(id);
        if (previous?.state === 'sent' || previous?.state === 'skipped') { summary.skipped++; continue; }
        if (previous?.state === 'sending' || previous?.state === 'uncertain') {
          blocked = true; summary.uncertain++;
          if (!dryRun && previous.state === 'sending') await store.record(id, { ...previous, state: 'uncertain', errorCode: 'interrupted-delivery' });
          continue;
        }
        if (previous && millis(previous.nextAttemptAt) > now()) {
          if (previous.errorCode === 'smtp-rejected-permanent') blocked = true;
          else { pending = true; retryAt = Math.min(retryAt, millis(previous.nextAttemptAt)); }
          continue;
        }
        if (dryRun) { summary.skipped++; continue; }
        const claim = await store.claim(id, { signalId: signal.id, recipientUid: candidate.uid, fingerprint: key }, currentSettings, now());
        if (!claim) { pending = true; retryAt = Math.min(retryAt, now() + 600000); continue; }
        attempts++;
        let accepted = false;
        try {
          const response = await transport.sendMail({ from: { name: 'IEEE İKÇÜ Hub', address: sender }, to: { address: recipient.email },
            messageId: `<${id}@gmail.com>`, ...mailMessage(currentSettings, signal.kind, signal.sourceId) });
          accepted = response.accepted?.some(address => String(address).toLowerCase() === recipient.email.toLowerCase()) === true;
          if (!accepted) throw Object.assign(new Error('not-accepted'), { responseCode: 550 });
          await store.record(id, { ...claim, state: 'sent', errorCode: '' });
          summary.sent++;
        } catch (error) {
          // SMTP kabulünden sonra Firestore makbuzu yazılamadıysa tekrar göndermek güvenli değildir.
          const failure = accepted ? { state: 'uncertain', errorCode: 'receipt-failed', permanent: true } : smtpFailure(error);
          const delay = failure.permanent ? 100 * 365 * 86400000 : Math.min(6 * 3600000, 600000 * 2 ** Math.min(claim.attempts - 1, 6));
          const errorCode = failure.state === 'failed' && failure.permanent ? 'smtp-rejected-permanent' : failure.errorCode;
          await store.record(id, { ...claim, state: failure.state, errorCode, nextAttemptAt: now() + delay });
          if (failure.state === 'uncertain') { blocked = true; summary.uncertain++; }
          else if (failure.permanent) blocked = true;
          else { pending = true; retryAt = Math.min(retryAt, now() + delay); }
        }
      }
      if (!dryRun) await store.finishSignal(signal, pending ? 'pending' : blocked ? 'blocked' : 'processed', Number.isFinite(retryAt) ? retryAt : now());
    }
    return summary;
  } catch (error) {
    summary.result = 'error';
    summary.errorCode = ['sender-mismatch','invalid-hub-url','settings-changed'].includes(error?.message) ? error.message : 'worker-failed';
    return summary;
  } finally {
    await store.health(summary);
  }
}
