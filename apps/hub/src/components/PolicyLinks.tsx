import { Anchor, Group } from '@mantine/core';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { policyByKind } from '../lib/privacy';
import type { PolicyKind } from '../lib/types';

/** Yalnız yürürlükte sürümü olan politikalar için alt bilgi bağlantıları. */
export function PolicyLinks({ kinds, size = 'xs' }: { kinds: PolicyKind[]; size?: 'xs' | 'sm' }) {
  const { publicSettings } = useAuth();
  const links = kinds.map(policyByKind).filter((policy) => publicSettings[policy.field]);
  if (!links.length) return null;
  return (
    <Group gap="md" wrap="wrap">
      {links.map((policy) => (
        <Anchor key={policy.kind} component={Link} to={`/politika/${policy.slug}`} size={size}>
          {policy.defaultTitle.replace(/ — .*/, '')}
          {policy.kind === 'recruitment' ? ' (Başvurular)' : policy.kind === 'members' ? ' (Üyeler)' : ''}
        </Anchor>
      ))}
    </Group>
  );
}
