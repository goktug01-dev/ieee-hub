import { Group, Modal, NavLink, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { searchHubNavigation, type HubNavSection } from '../lib/navigation';

export function NavigationSearch({ sections, opened, onClose }: { sections: HubNavSection[]; opened: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  useEffect(() => { if (opened) setQuery(''); }, [opened]);
  const matches = searchHubNavigation(sections, query);
  const count = matches.reduce((sum, section) => sum + section.items.length, 0);
  return (
    <Modal opened={opened} onClose={onClose} title="Ne yapmak istiyorsunuz?" size="lg">
      <Stack>
        <TextInput
          data-autofocus
          aria-label="İşlem ara"
          placeholder="Örn. üye onayla, görev ata, puan, oda…"
          leftSection={<IconSearch size={18} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]?.items[0]) {
              event.preventDefault();
              navigate(matches[0].items[0].to);
              onClose();
            }
          }}
        />
        <Group justify="space-between"><Text size="sm" c="dimmed" role="status">{count ? `${count} işlem` : 'Eşleşen işlem bulunamadı.'}</Text><Text size="xs" c="dimmed">Ctrl / ⌘ + K</Text></Group>
        <ScrollArea.Autosize mah="60vh">
          {matches.map((section) => (
            <div key={section.id}>
              <Text size="sm" fw={600} mt="sm" mb={4}>{section.label}</Text>
              {section.items.map((item) => (
                <NavLink
                  key={item.to} component={Link} to={item.to} label={item.label}
                  description={item.description} leftSection={<item.icon size={20} />}
                  onClick={onClose} style={{ borderRadius: 'var(--mantine-radius-md)' }}
                />
              ))}
            </div>
          ))}
          {!count && <Text size="sm" c="dimmed">Başka bir kelime deneyin. Yalnızca hesabınızın erişebildiği işlemler listelenir.</Text>}
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}
