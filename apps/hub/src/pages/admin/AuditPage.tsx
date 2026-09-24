import { Code, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { limit, orderBy } from 'firebase/firestore';
import { useState } from 'react';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import type { AuditEntry } from '../../lib/types';

const ACTION_LABEL: Record<string, string> = {
  'assignment.create': 'Görev atandı',
  'assignment.end': 'Görev sonlandırıldı',
  'member.active': 'Üye onaylandı / etkinleştirildi',
  'member.suspended': 'Üyelik askıya alındı',
  'member.delete': 'Başvuru silindi',
  'unit.create': 'Birim oluşturuldu',
  'unit.update': 'Birim güncellendi',
  'role.create': 'Rol oluşturuldu',
  'role.update': 'Rol güncellendi',
  'term.create': 'Dönem oluşturuldu',
  'term.update': 'Dönem güncellendi',
  'term.activate': 'Aktif dönem değişti',
  'term.close': 'Dönem kapatıldı',
  'election.create': 'Seçim oluşturuldu',
  'election.apply': 'Seçim sonuçları görevlere işlendi',
  'election.delete': 'Seçim silindi',
  'template.create': 'Şablon oluşturuldu',
  'template.update': 'Şablon güncellendi',
  'template.publish': 'Şablon sürümü yayımlandı',
  'template.rollback': 'Şablon sürümü değiştirildi',
  'settings.update': 'Kurum ayarları güncellendi',
  'superadmin.grant': 'Kurucu yönetici eklendi',
  'superadmin.revoke': 'Kurucu yönetici kaldırıldı',
};

export function AuditPage() {
  const [q, setQ] = useState('');
  const log = useCollection<AuditEntry>('auditLog', [orderBy('at', 'desc'), limit(500)], 'audit');
  const s = q.toLocaleLowerCase('tr');
  const rows = log.data.filter(
    (e) => !s || `${e.actorName} ${e.action} ${ACTION_LABEL[e.action] ?? ''} ${JSON.stringify(e.details ?? {})}`.toLocaleLowerCase('tr').includes(s),
  );

  return (
    <Stack>
      <PageHeader
        title="Denetim kaydı"
        description="Yönetim işlemlerinin kaydı. Kayıtlar yalnızca eklenebilir; değiştirilemez ve silinemez. Dilekçe onayları ayrıca her dilekçenin kendi geçmişinde tutulur."
      />
      <TextInput placeholder="Kişi, işlem, ayrıntı…" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} />
      <ErrorAlert error={log.error} />
      {log.loading ? (
        <SectionLoader />
      ) : rows.length === 0 ? (
        <EmptyState title="Kayıt yok" />
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="xs" striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={150}>Zaman</Table.Th>
                <Table.Th>Kişi</Table.Th>
                <Table.Th>İşlem</Table.Th>
                <Table.Th>Ayrıntı</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td>
                    <Text size="xs">{fmtDateTime(e.at)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{e.actorName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{ACTION_LABEL[e.action] ?? e.action}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Code fz="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {Object.entries(e.details ?? {})
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                        .join(' · ')}
                    </Code>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
