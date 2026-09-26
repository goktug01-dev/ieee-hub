import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  CopyButton,
  Grid,
  Group,
  Modal,
  PasswordInput,
  Radio,
  Stack,
  Text,
  Textarea,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconArrowBackUp,
  IconCheck,
  IconCircleDashed,
  IconDownload,
  IconEdit,
  IconPrinter,
  IconSend,
  IconTrash,
  IconX,
  IconArrowLeft,
  IconCopy,
} from '@tabler/icons-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { DocxPreview } from '../../components/DocxPreview';
import { PetitionForm, missingRequired } from '../../components/PetitionForm';
import { EmptyState, ErrorAlert, SectionLoader, StatusBadge, notifyError, notifySuccess } from '../../components/ui';
import { downloadBlob } from '../../lib/docx';
import { DECISION_LABEL, fmtDateTime } from '../../lib/format';
import { useDoc } from '../../lib/hooks';
import { eligibleRoles } from '../../lib/inbox';
import { useOrg } from '../../lib/org';
import {
  decidePetition,
  deleteDraft,
  ensureRecentLogin,
  petitionFileName,
  renderPetitionDocx,
  resubmitPetition,
  stepRequiredApprovals,
  stepUnitId,
  submitPetition,
  updateDraft,
  verifyUrl,
  withdrawPetition,
} from '../../lib/petitions';
import type { Decision, Petition, TemplateVersion } from '../../lib/types';

export function PetitionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, access, publicSettings, orgSettings } = useAuth();
  const { roleName, unitName } = useOrg();
  const { data: p, loading, error } = useDoc<Petition>(`petitions/${id}`);
  const version = useDoc<TemplateVersion>(p ? `petitionTemplates/${p.templateId}/versions/${p.templateVersion}` : null);

  const [blob, setBlob] = useState<Blob | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const isOwner = p?.ownerUid === user?.uid;
  const canEdit = isOwner && (p?.status === 'draft' || p?.status === 'returned');
  const myRoles = p ? eligibleRoles(p, access, user?.uid) : [];

  // Belgeyi üret (içerik veya onaylar değiştikçe)
  const renderKey = p ? `${p.updatedAt?.toMillis?.()}-${p.status}-${editing}` : '';
  useEffect(() => {
    if (!p || editing) return;
    renderPetitionDocx(p, { orgName: publicSettings.orgName, settings: orgSettings })
      .then(setBlob)
      .catch((e) => notifyError(e, 'Belge oluşturulamadı'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey, publicSettings.orgName, orgSettings]);

  const vUrl = p?.verificationCode ? verifyUrl(orgSettings, p.verificationCode) : null;
  useEffect(() => {
    if (vUrl) QRCode.toDataURL(vUrl, { margin: 1, width: 160 }).then(setQr);
  }, [vUrl]);

  const startEdit = () => {
    if (!p) return;
    setValues(p.data);
    setTitle(p.title);
    setEditing(true);
  };

  const fields = version.data?.fields ?? [];

  const saveEdit = async (andSubmit: boolean) => {
    if (!p || !id) return;
    if (andSubmit) {
      const missing = missingRequired(fields, values);
      if (missing.length) return notifyError(new Error(`Zorunlu alanlar: ${missing.map((f) => f.label).join(', ')}`), 'Eksik bilgi');
    }
    setBusy(true);
    try {
      if (p.status === 'draft') {
        if (andSubmit) {
          const no = await submitPetition(id, values, title);
          notifySuccess(`Evrak sayısı: ${no}`, 'Dilekçe onaya gönderildi');
        } else {
          await updateDraft(id, { data: values, title });
          notifySuccess('Taslak kaydedildi.');
        }
      } else if (p.status === 'returned') {
        await resubmitPetition(id, values, title);
        notifySuccess('Dilekçe düzeltildi ve yeniden onaya gönderildi.');
      }
      setEditing(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = async () => {
    if (!p || !id) return;
    const missing = missingRequired(fields, p.data);
    if (missing.length) {
      startEdit();
      return notifyError(new Error(`Zorunlu alanlar: ${missing.map((f) => f.label).join(', ')}`), 'Eksik bilgi');
    }
    setBusy(true);
    try {
      const no = await submitPetition(id, p.data, p.title);
      notifySuccess(`Evrak sayısı: ${no}`, 'Dilekçe onaya gönderildi');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = () =>
    modals.openConfirmModal({
      title: 'Dilekçe geri çekilsin mi?',
      children: <Text size="sm">Geri çekilen dilekçe onay sürecinden çıkar. Evrak numarası tekrar kullanılmaz.</Text>,
      labels: { confirm: 'Geri çek', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await withdrawPetition(id!);
          notifySuccess('Dilekçe geri çekildi.');
        } catch (e) {
          notifyError(e);
        }
      },
    });

  const remove = () =>
    modals.openConfirmModal({
      title: 'Taslak silinsin mi?',
      labels: { confirm: 'Sil', cancel: 'Vazgeç' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteDraft(id!);
          navigate('/dilekceler');
        } catch (e) {
          notifyError(e);
        }
      },
    });

  if (loading) return <SectionLoader />;
  if (error) return <ErrorAlert error={error} />;
  if (!p) return <EmptyState title="Dilekçe bulunamadı" description="Silinmiş olabilir ya da görüntüleme yetkiniz yok." />;

  return (
    <Stack>
      <Anchor component={Link} to="/dilekceler" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Dilekçeler
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div style={{ minWidth: 0, flex: '1 1 360px' }}>
          <Group gap="sm">
            <Title order={2}>{p.title || p.templateName}</Title>
            <StatusBadge status={p.status} />
          </Group>
          <Text c="dimmed" size="sm" mt={4}>
            {p.documentNo ? <b>{p.documentNo}</b> : 'Taslak (evrak numarası gönderimde atanır)'} · {p.templateName} (sürüm{' '}
            {p.templateVersion}) · {p.unitId === 'branch' ? 'Kol Geneli' : p.unitName} · {p.ownerName}
            {p.revision && p.revision > 1 ? ` · Revizyon ${p.revision}` : ''}
          </Text>
        </div>
        <Group gap="xs">
          {canEdit && !editing && (
            <Button variant="default" leftSection={<IconEdit size={16} />} onClick={startEdit}>
              Düzenle
            </Button>
          )}
          {isOwner && p.status === 'draft' && !editing && (
            <>
              <Button leftSection={<IconSend size={16} />} onClick={submitDraft} loading={busy}>
                Onaya gönder
              </Button>
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={remove}>
                Sil
              </Button>
            </>
          )}
          {isOwner && (p.status === 'pending' || p.status === 'returned') && !editing && (
            <Button variant="subtle" color="red" onClick={withdraw}>
              Geri çek
            </Button>
          )}
        </Group>
      </Group>

      {p.status === 'returned' && isOwner && !editing && (
        <Alert color="orange" title="Dilekçeniz düzeltme için iade edildi">
          İade gerekçesini sağdaki onay geçmişinde görebilirsiniz. "Düzenle" ile düzeltip yeniden gönderin; evrak numarası
          değişmez, onay zinciri baştan başlar.
        </Alert>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          {editing ? (
            <Card>
              <Stack>
                <Textarea label="Başlık" autosize minRows={1} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
                <PetitionForm fields={fields} values={values} onChange={setValues} showErrors />
                <Group justify="flex-end">
                  <Button variant="default" onClick={() => setEditing(false)}>
                    Vazgeç
                  </Button>
                  {p.status === 'draft' && (
                    <Button variant="default" loading={busy} onClick={() => void saveEdit(false)}>
                      Kaydet
                    </Button>
                  )}
                  <Button loading={busy} leftSection={<IconSend size={16} />} onClick={() => void saveEdit(true)}>
                    {p.status === 'returned' ? 'Düzelt ve yeniden gönder' : 'Kaydet ve gönder'}
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : (
            <Card padding="sm">
              <Group justify="space-between" px="xs" mb="xs">
                <Text fw={600}>Belge</Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<IconDownload size={14} />}
                    disabled={!blob}
                    onClick={() => blob && downloadBlob(blob, petitionFileName(p))}
                  >
                    Word (.docx)
                  </Button>
                  <Tooltip label="Tarayıcının yazdır penceresinde 'PDF olarak kaydet'i seçin">
                    <Button size="xs" variant="default" leftSection={<IconPrinter size={14} />} disabled={!blob} onClick={() => window.print()}>
                      Yazdır / PDF
                    </Button>
                  </Tooltip>
                </Group>
              </Group>
              {blob ? <DocxPreview blob={blob} printable /> : <SectionLoader />}
            </Card>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack>
            {myRoles.length > 0 && !editing && (
              <DecisionPanel petitionId={id!} p={p} roleIds={myRoles} roleName={roleName} unitName={unitName} />
            )}
            <ApprovalTimeline p={p} roleName={roleName} unitName={unitName} />
            {p.verificationCode && vUrl && (
              <Card>
                <Group wrap="nowrap" align="flex-start">
                  {qr && <img src={qr} width={96} height={96} alt="Doğrulama QR kodu" />}
                  <Stack gap={4} style={{ minWidth: 0 }}>
                    <Text fw={600}>Doğrulama</Text>
                    <Group gap={4}>
                      <Text ff="monospace">{p.verificationCode}</Text>
                      <CopyButton value={vUrl}>
                        {({ copied, copy }) => (
                          <Tooltip label={copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}>
                            <Button size="compact-xs" variant="subtle" onClick={copy}>
                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </Button>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>
                    <Anchor href={vUrl} target="_blank" size="xs" style={{ wordBreak: 'break-all' }}>
                      {vUrl}
                    </Anchor>
                  </Stack>
                </Group>
              </Card>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function ApprovalTimeline({
  p,
  roleName,
  unitName,
}: {
  p: Petition;
  roleName: (id: string) => string;
  unitName: (id: string) => string;
}) {
  const steps = p.steps ?? [];
  const rev = p.revision ?? 1;
  const current = (p.approvals ?? []).filter((a) => a.revision === rev);
  const older = (p.approvals ?? []).filter((a) => a.revision !== rev);
  const noteFor = (idx: number) => p.notes?.find((n) => n.approvalIndex === idx)?.text;
  const allApprovals = p.approvals ?? [];

  if (!steps.length) {
    return (
      <Card>
        <Text fw={600} mb={4}>
          Onay zinciri
        </Text>
        <Text size="sm" c="dimmed">
          Dilekçe gönderildiğinde onay zinciri burada görünür.
        </Text>
      </Card>
    );
  }

  const activeIdx = p.status === 'pending' ? (p.currentStep ?? 0) : steps.length;

  return (
    <Card>
      <Text fw={600} mb="md">
        Onay zinciri
      </Text>
      <Timeline active={Math.max(0, activeIdx - (p.status === 'pending' ? 1 : 0))} bulletSize={24} lineWidth={2}>
        {steps.map((s, i) => {
          const records = current.filter((x) => x.step === i);
          const terminal = records.find((x) => x.decision !== 'approve');
          const approved = records.filter((x) => x.decision === 'approve');
          const required = stepRequiredApprovals(s);
          const isCurrent = p.status === 'pending' && (p.currentStep ?? 0) === i;
          const completed = approved.length >= required;
          const color = terminal ? (terminal.decision === 'reject' ? 'red' : 'orange') : completed ? 'green' : isCurrent ? 'blue' : 'gray';
          const icon = terminal ? (
            terminal.decision === 'reject' ? <IconX size={14} /> : <IconArrowBackUp size={14} />
          ) : completed ? (
            <IconCheck size={14} />
          ) : (
            <IconCircleDashed size={14} />
          );
          return (
            <Timeline.Item key={i} bullet={icon} color={color} title={s.name} lineVariant={records.length ? 'solid' : 'dashed'}>
              {records.length ? (
                <Stack gap={6}>
                  {records.map((a) => {
                    const note = noteFor(allApprovals.indexOf(a));
                    return (
                      <div key={`${a.uid}-${a.roleId}-${a.at.toMillis?.() ?? ''}`}>
                        <Text size="sm"><b>{a.name}</b> — {DECISION_LABEL[a.decision]}</Text>
                        <Text size="xs" c="dimmed">
                          {a.roleName}{a.unitId !== 'branch' ? ` · ${a.unitName}` : ''} · {fmtDateTime(a.at)}
                        </Text>
                        {note && <Text size="sm" mt={4} p="xs" bg="var(--mantine-color-default-hover)" style={{ borderRadius: 8 }}>“{note}”</Text>}
                      </div>
                    );
                  })}
                  {isCurrent && !terminal && <Badge size="xs" variant="light">{approved.length}/{required} makam onayı</Badge>}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">
                  {s.roleIds.map(roleName).join(' / ')} · {unitName(stepUnitId(s, p.unitId))}
                  {isCurrent && (
                    <Badge ml={6} size="xs">
                      Bekliyor
                    </Badge>
                  )}
                </Text>
              )}
            </Timeline.Item>
          );
        })}
      </Timeline>

      {older.length > 0 && (
        <Stack gap={4} mt="md">
          <Text size="xs" fw={600} c="dimmed">
            Önceki revizyonlar
          </Text>
          {older.map((a, i) => {
            const note = noteFor(allApprovals.indexOf(a));
            return (
              <Text key={i} size="xs" c="dimmed">
                Rev {a.revision} · {a.stepName}: {a.name} — {DECISION_LABEL[a.decision]} ({fmtDateTime(a.at)})
                {note ? ` — “${note}”` : ''}
              </Text>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}

function DecisionPanel({
  petitionId,
  p,
  roleIds,
  roleName,
  unitName,
}: {
  petitionId: string;
  p: Petition;
  roleIds: string[];
  roleName: (id: string) => string;
  unitName: (id: string) => string;
}) {
  const [roleId, setRoleId] = useState(roleIds[0]);
  const [comment, setComment] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<Decision | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const pwResolver = useRef<((v: string | null) => void) | null>(null);
  const step = p.steps![p.currentStep ?? 0];
  const stepUnit = stepUnitId(step, p.unitId);
  const required = stepRequiredApprovals(step);
  const approvedCount = p.stepApprovalRoleIds?.length ?? 0;

  const askPassword = () =>
    new Promise<string | null>((resolve) => {
      pwResolver.current = resolve;
      setPw('');
      setPwOpen(true);
    });

  const roleOptions = useMemo(() => roleIds.map((r) => ({ value: r, label: roleName(r) })), [roleIds, roleName]);

  const decide = async (decision: Decision) => {
    if (decision !== 'approve' && !comment.trim()) {
      return notifyError(new Error('İade ve ret için gerekçe yazmanız gerekir.'), 'Gerekçe gerekli');
    }
    setBusy(decision);
    try {
      const ok = await ensureRecentLogin(askPassword);
      if (!ok) return;
      await decidePetition({
        petitionId,
        decision,
        roleId,
        roleName: roleName(roleId),
        unitName: unitName(stepUnit),
        comment,
      });
      notifySuccess(
        decision === 'approve' ? 'Onayınız kaydedildi.' : decision === 'reject' ? 'Dilekçe reddedildi.' : 'Dilekçe iade edildi.',
      );
      setComment('');
      setAgree(false);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ borderColor: 'var(--mantine-color-blue-5)', borderWidth: 2 }}>
      <Stack gap="sm">
        <div>
          <Text fw={700}>Kararınız bekleniyor</Text>
          <Text size="sm" c="dimmed">
            Adım: {step.name} · {unitName(stepUnit)}
          </Text>
          {required > 1 && <Badge mt={6} variant="light">{approvedCount}/{required} farklı makam onayladı</Badge>}
        </div>
        {roleOptions.length > 1 && (
          <Radio.Group label="Hangi rolünüzle karar veriyorsunuz?" value={roleId} onChange={setRoleId}>
            <Stack gap={4} mt={4}>
              {roleOptions.map((o) => (
                <Radio key={o.value} value={o.value} label={o.label} />
              ))}
            </Stack>
          </Radio.Group>
        )}
        <Textarea
          label="Not / gerekçe"
          description="İade ve ret için zorunludur. Dilekçe sahibi ve sonraki onaycılar görür."
          autosize
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Checkbox
          checked={agree}
          onChange={(e) => setAgree(e.currentTarget.checked)}
          label={`Belgenin içeriğini okudum; kararımı ${roleName(roleId)} sıfatıyla veriyorum.`}
        />
        <Group grow>
          <Button color="green" leftSection={<IconCheck size={16} />} disabled={!agree || !!busy} loading={busy === 'approve'} onClick={() => void decide('approve')}>
            Onayla
          </Button>
        </Group>
        <Group grow>
          <Button
            variant="light"
            color="orange"
            leftSection={<IconArrowBackUp size={16} />}
            disabled={!agree || !!busy}
            loading={busy === 'return'}
            onClick={() => void decide('return')}
          >
            Düzeltmeye iade
          </Button>
          <Button variant="light" color="red" leftSection={<IconX size={16} />} disabled={!agree || !!busy} loading={busy === 'reject'} onClick={() => void decide('reject')}>
            Reddet
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Güvenlik için son 15 dakika içinde giriş yapmış olmanız gerekir; gerekirse sizden şifreniz istenir. Bu onay, 5070
          sayılı Kanun kapsamında e-imza değil, rol bazlı sistem içi elektronik onaydır.
        </Text>
      </Stack>

      <Modal
        opened={pwOpen}
        onClose={() => {
          setPwOpen(false);
          pwResolver.current?.(null);
        }}
        title="Kimliğinizi doğrulayın"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPwOpen(false);
            pwResolver.current?.(pw);
          }}
        >
          <Stack>
            <Text size="sm">Onay vermeden önce şifrenizi yeniden girin.</Text>
            <PasswordInput label="Şifre" value={pw} onChange={(e) => setPw(e.currentTarget.value)} autoFocus />
            <Button type="submit">Doğrula</Button>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}
