import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { StreamProvider } from './context/StreamContext.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { AdminSidebar, AdminTab } from './components/AdminSidebar.tsx';
import { TopNavbar } from './components/TopNavbar.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { VideoLibraryPage } from './pages/VideoLibraryPage.tsx';
import { PlaylistPage } from './pages/PlaylistPage.tsx';
import { StartStreamPage } from './pages/StartStreamPage.tsx';
import { ActiveStreamPage } from './pages/ActiveStreamPage.tsx';
import { StreamHistoryPage } from './pages/StreamHistoryPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SignUpPage } from './pages/SignUpPage.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { SupabaseSetupPage } from './pages/SupabaseSetupPage.tsx';
import { VideoUploadModal } from './components/VideoUploadModal.tsx';
import { VideoMetadata, User } from './types/index.ts';

// Admin Panel Pages
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.tsx';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.tsx';
import { AdminStreamsPage } from './pages/admin/AdminStreamsPage.tsx';
import { AdminStoragePage } from './pages/admin/AdminStoragePage.tsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.tsx';
import { AdminSystemPage } from './pages/admin/AdminSystemPage.tsx';
import { AdminLogsPage } from './pages/admin/AdminLogsPage.tsx';
import { AdminSecurityPage } from './pages/admin/AdminSecurityPage.tsx';

function parseRouteFromPath(path: string): { isAdminRoute: boolean; adminTab: AdminTab; userTab: NavTab } {
  const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';

  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    const sub = cleanPath.replace('/admin', '').replace(/^\//, '');
    let adminTab: AdminTab = 'overview';
    if (sub === 'users') adminTab = 'users';
    else if (sub === 'streams') adminTab = 'streams';
    else if (sub === 'storage') adminTab = 'storage';
    else if (sub === 'settings') adminTab = 'settings';
    else if (sub === 'system') adminTab = 'system';
    else if (sub === 'logs') adminTab = 'logs';
    else if (sub === 'security') adminTab = 'security';
    else adminTab = 'overview';

    return { isAdminRoute: true, adminTab, userTab: 'dashboard' };
  }

  let userTab: NavTab = 'dashboard';
  if (cleanPath === '/videos' || cleanPath === '/library') userTab = 'library';
  else if (cleanPath === '/playlist') userTab = 'playlist';
  else if (cleanPath === '/stream' || cleanPath === '/start-stream') userTab = 'start-stream';
  else if (cleanPath === '/active-stream') userTab = 'active-stream';
  else if (cleanPath === '/history') userTab = 'history';
  else userTab = 'dashboard';

  return { isAdminRoute: false, adminTab: 'overview', userTab };
}

const AppContent: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading, logout, refreshUser } = useAuth();
  
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState<boolean>(() => {
    const metaEnv = (import.meta as any).env || {};
    const url = localStorage.getItem('streamloop_supabase_url') || metaEnv.VITE_SUPABASE_URL || '';
    return Boolean(url && !url.includes('placeholder'));
  });
  
  // Current route state parsed from window.location.pathname
  const [isAdminPath, setIsAdminPath] = useState<boolean>(() => {
    return window.location.pathname.toLowerCase().startsWith('/admin');
  });

  const [userTab, setUserTabState] = useState<NavTab>(() => {
    return parseRouteFromPath(window.location.pathname).userTab;
  });

  const [adminTab, setAdminTabState] = useState<AdminTab>(() => {
    return parseRouteFromPath(window.location.pathname).adminTab;
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [preselectedVideo, setPreselectedVideo] = useState<VideoMetadata | null>(null);
  const [preselectedPlaylist, setPreselectedPlaylist] = useState<VideoMetadata[] | null>(null);
  const [authView, setAuthView] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Sync state when browser navigation occurs (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromPath(window.location.pathname);
      setIsAdminPath(parsed.isAdminRoute);
      if (parsed.isAdminRoute) {
        setAdminTabState(parsed.adminTab);
      } else {
        setUserTabState(parsed.userTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update user tab & URL
  const setUserTab = useCallback((tab: NavTab) => {
    setUserTabState(tab);
    setIsAdminPath(false);
    let targetPath = '/dashboard';
    if (tab === 'library') targetPath = '/videos';
    else if (tab === 'playlist') targetPath = '/playlist';
    else if (tab === 'start-stream') targetPath = '/stream';
    else if (tab === 'active-stream') targetPath = '/active-stream';
    else if (tab === 'history') targetPath = '/history';

    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, []);

  // Update admin tab & URL
  const setAdminTab = useCallback((tab: AdminTab) => {
    setAdminTabState(tab);
    setIsAdminPath(true);
    let targetPath = '/admin/dashboard';
    if (tab === 'users') targetPath = '/admin/users';
    else if (tab === 'streams') targetPath = '/admin/streams';
    else if (tab === 'storage') targetPath = '/admin/storage';
    else if (tab === 'settings') targetPath = '/admin/settings';
    else if (tab === 'system') targetPath = '/admin/system';
    else if (tab === 'logs') targetPath = '/admin/logs';
    else if (tab === 'security') targetPath = '/admin/security';
    else targetPath = '/admin/dashboard';

    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, []);

  if (!isSupabaseConfigured) {
    return <SupabaseSetupPage onConfigured={() => setIsSupabaseConfigured(true)} />;
  }

  const handleAdminAuthenticated = (adminUser: User, token: string) => {
    refreshUser();
    setIsAdminPath(true);
    setAdminTab('overview');
  };

  const handleAdminLogout = async () => {
    await logout();
    setIsAdminPath(true);
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
  };

  const handleSelectVideoForStream = (video: VideoMetadata) => {
    setPreselectedVideo(video);
    setPreselectedPlaylist([video]);
    setUserTab('start-stream');
  };

  const handleSelectPlaylistForStream = (playlist: VideoMetadata[]) => {
    setPreselectedPlaylist(playlist);
    if (playlist.length > 0) {
      setPreselectedVideo(playlist[0]);
    }
    setUserTab('start-stream');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080B12] text-slate-400">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-300">
            Connecting to StreamLoop Engine...
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================================
     1. ADMIN ROUTE LOGIC (/admin and /admin/*)
     ========================================================================= */
  if (isAdminPath) {
    // If not authenticated as the authorized Light Gaming 4M admin, display the private Admin Login Page
    if (!isAuthenticated || !isAdmin) {
      return <AdminLoginPage onAdminAuthenticated={handleAdminAuthenticated} />;
    }

    // If verified as Light Gaming 4M Admin, display the full Admin Panel
    return (
      <div className="min-h-screen bg-[#080B12] text-slate-100 antialiased font-sans">
        <AdminSidebar
          currentTab={adminTab}
          onSelectTab={setAdminTab}
          onExitAdmin={() => setUserTab('dashboard')}
          onAdminLogout={handleAdminLogout}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex flex-1 flex-col transition-all lg:pl-72">
          {/* Admin Header Bar */}
          <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-indigo-500/20 bg-[#080B12]/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden cursor-pointer"
              >
                <span className="sr-only">Open Menu</span>
                <div className="w-5 h-0.5 bg-slate-400 mb-1" />
                <div className="w-5 h-0.5 bg-slate-400 mb-1" />
                <div className="w-5 h-0.5 bg-slate-400" />
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
                  ADMIN PANEL
                </span>
                <h1 className="text-base font-bold text-white hidden sm:block">
                  Server Administration & Fleet Control
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline-block text-xs font-medium text-amber-400/90 bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-500/20">
                Authorized Identity: Light Gaming 4M
              </span>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {adminTab === 'overview' && <AdminOverviewPage onNavigateTab={(t) => setAdminTab(t as AdminTab)} />}
            {adminTab === 'users' && <AdminUsersPage />}
            {adminTab === 'streams' && <AdminStreamsPage />}
            {adminTab === 'storage' && <AdminStoragePage />}
            {adminTab === 'settings' && <AdminSettingsPage />}
            {adminTab === 'system' && <AdminSystemPage />}
            {adminTab === 'logs' && <AdminLogsPage />}
            {adminTab === 'security' && <AdminSecurityPage />}
          </main>
        </div>
      </div>
    );
  }

  /* =========================================================================
     2. NORMAL USER ROUTE LOGIC (/, /dashboard, /videos, /playlist, /stream, /history)
     ========================================================================= */
  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <SignUpPage onSwitchToLogin={() => setAuthView('signin')} />;
    }
    if (authView === 'forgot') {
      return <ForgotPasswordPage onBackToLogin={() => setAuthView('signin')} />;
    }
    return (
      <LoginPage
        onSwitchToSignUp={() => setAuthView('signup')}
        onSwitchToForgotPassword={() => setAuthView('forgot')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100 antialiased font-sans">
      <Sidebar
        currentTab={userTab}
        onSelectTab={setUserTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col transition-all lg:pl-72">
        <TopNavbar
          currentTab={userTab}
          onOpenMobile={() => setIsMobileSidebarOpen(true)}
          onNavigate={setUserTab}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {userTab === 'dashboard' && (
            <DashboardPage
              onNavigate={setUserTab}
              onOpenUpload={() => setIsUploadModalOpen(true)}
            />
          )}

          {userTab === 'playlist' && (
            <PlaylistPage
              onNavigate={setUserTab}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onStreamPlaylist={handleSelectPlaylistForStream}
            />
          )}

          {userTab === 'library' && (
            <VideoLibraryPage
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onSelectForStream={handleSelectVideoForStream}
              onSelectPlaylistForStream={handleSelectPlaylistForStream}
              onNavigate={setUserTab}
            />
          )}

          {userTab === 'start-stream' && (
            <StartStreamPage
              selectedVideo={preselectedVideo}
              selectedPlaylist={preselectedPlaylist}
              onNavigate={setUserTab}
              onOpenUpload={() => setIsUploadModalOpen(true)}
            />
          )}

          {userTab === 'active-stream' && (
            <ActiveStreamPage onNavigate={setUserTab} />
          )}

          {userTab === 'history' && <StreamHistoryPage />}
        </main>
      </div>

      <VideoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={(newVideo) => {
          setPreselectedVideo(newVideo);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StreamProvider>
        <AppContent />
      </StreamProvider>
    </AuthProvider>
  );
}

