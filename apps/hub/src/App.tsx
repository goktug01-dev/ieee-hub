import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './components/AppLayout';
import { FullPageLoader } from './components/ui';
import { OrgProvider } from './lib/org';
import type { PermissionId } from './lib/permissions';
import { LoginPage } from './pages/public/LoginPage';
import { PendingPage } from './pages/public/PendingPage';

// Sayfalar tembel yüklenir: Word motoru ve yönetim ekranları yalnızca açıldığında iner.
const AssignmentsPage = lazy(() => import('./pages/admin/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const AuditPage = lazy(() => import('./pages/admin/AuditPage').then((m) => ({ default: m.AuditPage })));
const ElectionDetailPage = lazy(() => import('./pages/admin/ElectionDetailPage').then((m) => ({ default: m.ElectionDetailPage })));
const ElectionsPage = lazy(() => import('./pages/admin/ElectionsPage').then((m) => ({ default: m.ElectionsPage })));
const MembersPage = lazy(() => import('./pages/admin/MembersPage').then((m) => ({ default: m.MembersPage })));
const RolesPage = lazy(() => import('./pages/admin/RolesPage').then((m) => ({ default: m.RolesPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const TemplateEditorPage = lazy(() => import('./pages/admin/TemplateEditorPage').then((m) => ({ default: m.TemplateEditorPage })));
const TemplatesPage = lazy(() => import('./pages/admin/TemplatesPage').then((m) => ({ default: m.TemplatesPage })));
const TermsPage = lazy(() => import('./pages/admin/TermsPage').then((m) => ({ default: m.TermsPage })));
const UnitsPage = lazy(() => import('./pages/admin/UnitsPage').then((m) => ({ default: m.UnitsPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const OrgChartPage = lazy(() => import('./pages/OrgChartPage').then((m) => ({ default: m.OrgChartPage })));
const InboxPage = lazy(() => import('./pages/petitions/InboxPage').then((m) => ({ default: m.InboxPage })));
const NewPetitionPage = lazy(() => import('./pages/petitions/NewPetitionPage').then((m) => ({ default: m.NewPetitionPage })));
const PetitionDetailPage = lazy(() => import('./pages/petitions/PetitionDetailPage').then((m) => ({ default: m.PetitionDetailPage })));
const PetitionsPage = lazy(() => import('./pages/petitions/PetitionsPage').then((m) => ({ default: m.PetitionsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SetupPage = lazy(() => import('./pages/public/SetupPage').then((m) => ({ default: m.SetupPage })));
const VerifyPage = lazy(() => import('./pages/public/VerifyPage').then((m) => ({ default: m.VerifyPage })));
const TasksPage = lazy(() => import('./pages/work/TasksPage').then((m) => ({ default: m.TasksPage })));
const VolunteerPage = lazy(() => import('./pages/work/VolunteerPage').then((m) => ({ default: m.VolunteerPage })));
const EventsPage = lazy(() => import('./pages/events/EventsPage').then((m) => ({ default: m.EventsPage })));
const EventDetailPage = lazy(() => import('./pages/events/EventDetailPage').then((m) => ({ default: m.EventDetailPage })));
const ContentPage = lazy(() => import('./pages/content/ContentPage').then((m) => ({ default: m.ContentPage })));
const SponsorsPage = lazy(() => import('./pages/finance/SponsorsPage').then((m) => ({ default: m.SponsorsPage })));
const BudgetsPage = lazy(() => import('./pages/finance/BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const HandoverPage = lazy(() => import('./pages/HandoverPage').then((m) => ({ default: m.HandoverPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));

function RequirePerm({ perm, children }: { perm: PermissionId; children: React.ReactElement }) {
  const { can } = useAuth();
  return can(perm) ? children : <Navigate to="/" replace />;
}

function RequireAny({ perms, children }: { perms: PermissionId[]; children: React.ReactElement }) {
  const { can } = useAuth();
  return perms.some(can) ? children : <Navigate to="/" replace />;
}

export function App() {
  const { phase } = useAuth();

  return (
    <Routes>
      {/* Herkese açık doğrulama sayfası: giriş gerektirmez */}
      <Route path="/dogrula" element={<Suspense fallback={<FullPageLoader />}><VerifyPage /></Suspense>} />
      <Route path="/dogrula/:code" element={<Suspense fallback={<FullPageLoader />}><VerifyPage /></Suspense>} />
      <Route path="*" element={<Gate phase={phase} />} />
    </Routes>
  );
}

function Gate({ phase }: { phase: ReturnType<typeof useAuth>['phase'] }) {
  switch (phase) {
    case 'loading':
      return <FullPageLoader />;
    case 'signedOut':
      return <LoginPage />;
    case 'needsFounder':
    case 'needsSeed':
      return (
        <Suspense fallback={<FullPageLoader />}>
          <SetupPage />
        </Suspense>
      );
    case 'pending':
    case 'suspended':
      return <PendingPage />;
    default:
      return (
        <OrgProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="onaylar" element={<InboxPage />} />
              <Route path="dilekceler" element={<PetitionsPage />} />
              <Route path="dilekceler/yeni" element={<NewPetitionPage />} />
              <Route path="dilekceler/:id" element={<PetitionDetailPage />} />
              <Route path="organizasyon" element={<OrgChartPage />} />
              <Route path="profil" element={<ProfilePage />} />
              <Route path="gorevler" element={<TasksPage />} />
              <Route path="gonulluluk" element={<VolunteerPage />} />
              <Route path="etkinlikler" element={<EventsPage />} />
              <Route path="etkinlikler/:id" element={<EventDetailPage />} />
              <Route path="iletisim" element={<ContentPage />} />
              <Route path="sponsorluk" element={<SponsorsPage />} />
              <Route path="butceler" element={<BudgetsPage />} />
              <Route path="devir" element={<HandoverPage />} />
              <Route path="yardim" element={<HelpPage />} />
              <Route path="raporlar" element={<RequireAny perms={['reports.read', 'reports.approve']}><ReportsPage /></RequireAny>} />
              <Route path="yonetim/envanter" element={<RequirePerm perm="inventory.manage"><InventoryPage /></RequirePerm>} />
              <Route path="yonetim/uyeler" element={<RequirePerm perm="members.manage"><MembersPage /></RequirePerm>} />
              <Route path="yonetim/atamalar" element={<RequirePerm perm="assignments.manage"><AssignmentsPage /></RequirePerm>} />
              <Route path="yonetim/secimler" element={<RequirePerm perm="elections.manage"><ElectionsPage /></RequirePerm>} />
              <Route path="yonetim/secimler/:id" element={<RequirePerm perm="elections.manage"><ElectionDetailPage /></RequirePerm>} />
              <Route path="yonetim/birimler" element={<RequirePerm perm="org.manage"><UnitsPage /></RequirePerm>} />
              <Route path="yonetim/roller" element={<RequirePerm perm="org.manage"><RolesPage /></RequirePerm>} />
              <Route path="yonetim/donemler" element={<RequirePerm perm="org.manage"><TermsPage /></RequirePerm>} />
              <Route path="yonetim/sablonlar" element={<RequirePerm perm="templates.manage"><TemplatesPage /></RequirePerm>} />
              <Route path="yonetim/sablonlar/:id" element={<RequirePerm perm="templates.manage"><TemplateEditorPage /></RequirePerm>} />
              <Route path="yonetim/ayarlar" element={<RequirePerm perm="org.manage"><SettingsPage /></RequirePerm>} />
              <Route path="yonetim/denetim" element={<RequirePerm perm="audit.read"><AuditPage /></RequirePerm>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </OrgProvider>
      );
  }
}
