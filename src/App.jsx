import './App.css'
import { Toaster } from "@/components/ui/toaster" // v2
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'

import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import WorkSummaryForm from './pages/WorkSummaryForm';
import WorkSummaries from './pages/WorkSummaries';
import PetiVorRecurringTasks from './pages/PetiVorRecurringTasks';
import MenuViewer from './pages/MenuViewer';
import Login from './pages/Login';
import StaffingMap from './pages/StaffingMap';
import EventAttendance from './pages/EventAttendance';
import StaffingReports from './pages/StaffingReports';
import TipsDistribution from './pages/TipsDistribution';
import StaffingSettings from './pages/StaffingSettings';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/WorkSummaries" element={
        <LayoutWrapper currentPageName="WorkSummaries">
          <WorkSummaries />
        </LayoutWrapper>
      } />
      <Route path="/PetiVorRecurringTasks" element={
        <LayoutWrapper currentPageName="PetiVorRecurringTasks">
          <PetiVorRecurringTasks />
        </LayoutWrapper>
      } />
      <Route path="/MenuViewer" element={
        <LayoutWrapper currentPageName="MenuViewer">
          <MenuViewer />
        </LayoutWrapper>
      } />
      <Route path="/StaffingMap" element={
        <LayoutWrapper currentPageName="StaffingMap">
          <StaffingMap />
        </LayoutWrapper>
      } />
      <Route path="/EventAttendance" element={
        <LayoutWrapper currentPageName="EventAttendance">
          <EventAttendance />
        </LayoutWrapper>
      } />
      <Route path="/StaffingReports" element={
        <LayoutWrapper currentPageName="StaffingReports">
          <StaffingReports />
        </LayoutWrapper>
      } />
      <Route path="/TipsDistribution" element={
        <LayoutWrapper currentPageName="TipsDistribution">
          <TipsDistribution />
        </LayoutWrapper>
      } />
      <Route path="/StaffingSettings" element={
        <LayoutWrapper currentPageName="StaffingSettings">
          <StaffingSettings />
        </LayoutWrapper>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/WorkSummaryForm" element={<WorkSummaryForm />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </AuthProvider>
      </Router>
      <Toaster />
      <SonnerToaster richColors closeButton position="top-center" dir="rtl" />
      <VisualEditAgent />
    </QueryClientProvider>
  )
}

export default App