import { Button, Container, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { useDoc } from '../../lib/hooks';
import type { StatutoryPolicy } from '../../lib/statutoryTypes';
import { StatutoryCasePanel } from '../../components/StatutoryCasePanel';
import { ErrorAlert, SectionLoader } from '../../components/ui';

export function StatutoryPersonalPage() {
  const {user}=useAuth();
  const pointer=useDoc<{policyId:string}>(user?'settings/statutory':null);
  const policy=useDoc<StatutoryPolicy>(pointer.data?`statutoryPolicies/${pointer.data.policyId}`:null);
  return <Container size="lg" py="xl"><Stack><Button component={Link} to="/" variant="light">Hub’a dön</Button><Text fw={700} size="xl">Yazılı savunma ve itiraz</Text><Text>Hub erişimi tedbiren kapatıldığında kendi dosyalarınıza erişim ve yazılı başvuru hakkınız korunur.</Text><ErrorAlert error={pointer.error||policy.error}/>{pointer.loading||policy.loading?<SectionLoader/>:user&&policy.data?<StatutoryCasePanel policy={policy.data} policyId={pointer.data!.policyId} oversight={false}/>:<Text>{user?'Süreç politikası henüz yayımlanmadı.':'Önce kendi hesabınızla giriş yapın.'}</Text>}</Stack></Container>;
}
