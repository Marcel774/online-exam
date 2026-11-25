import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Avatar } from '../components/Avatar';
import type { UserRole } from '../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student'] },
  { label: 'Exams', path: '/exams', icon: ClipboardList, roles: ['admin', 'teacher'] },
  { label: 'Available Exams', path: '/student/exams/available', icon: ClipboardList, roles: ['student'] },
  { label: 'Upcoming Exams', path: '/student/exams/upcoming', icon: CalendarClock, roles: ['student'] },
  { label: 'Exam History', path: '/student/history', icon: History, roles: ['student'] },
  { label: 'Question Bank', path: '/questions', icon: FileQuestion, roles: ['admin', 'teacher'] },
  { label: 'Classes', path: '/classes', icon: Layers, roles: ['admin', 'teacher'] },
  { label: 'Subjects', path: '/subjects', icon: BookOpen, roles: ['admin', 'teacher'] },
  { label: 'Students', path: '/students', icon: Users, roles: ['admin'] },
  { label: 'Teachers', path: '/teachers', icon: UserCheck, roles: ['admin'] },
  { label: 'Results', path: '/results', icon: Award, roles: ['admin', 'teacher', 'student'] },
  { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin', 'teacher'] },
  { label: 'Profile', path: '/profile', icon: UserCircle, roles: ['student'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
];

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  exams: 'Examinations',
  create: 'Create Examination',
  edit: 'Edit Examination',
  questions: 'Question Bank',
  classes: 'Classes',
  subjects: 'Subjects',
  students: 'Students',
  teachers: 'Teachers',
  users: 'Users',
  results: 'Results',
  grade: 'Grade Submission',
  reports: 'Reports & Analytics',
  settings: 'System Settings',
  profile: 'Profile',
  student: 'Student Portal',
  available: 'Available Exams',
  upcoming: 'Upcoming Exams',
  history: 'Examination History',
  instructions: 'Exam Instructions',
};

interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  path: string;
}

interface NotificationHit {
  id: string;
  title: string;
  detail: string;
  path: string;
  time: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationHit[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const allowedNav = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get<{ notifications: NotificationHit[] }>('/notifications')
      .then((res) => {
        if (active) setNotifications(res.data.notifications || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<{ results: SearchHit[] }>('/search', {
          params: { q: trimmed },
        });
        setSearchResults(data.results || []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    await logout();
    showToast('Signed out of EXAMPRO.', 'info');
    navigate('/login');
  };

  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments
    .filter((seg) => !/^[a-f0-9]{24}$/i.test(seg))
    .map((seg, idx, arr) => ({
      label: BREADCRUMB_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
      isLast: idx === arr.length - 1,
    }));

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5 text-white whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">EXAMPRO</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
        {allowedNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 border-r border-slate-800">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              <Link to="/dashboard" className="text-slate-500 hover:text-slate-900 whitespace-nowrap">
                Home
              </Link>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span
                    className={`truncate ${
                      crumb.isLast ? 'font-semibold text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {crumb.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Search */}
            <div ref={searchRef} className="relative hidden md:block w-64 lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchOpen(true);
                }}
                placeholder="Search exams, questions..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              {searchOpen && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-40">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-2 text-xs text-slate-500">No matching records found.</p>
                  ) : (
                    searchResults.map((hit) => (
                      <button
                        key={hit.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          navigate(hit.path);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 flex flex-col gap-0.5"
                      >
                        <span className="text-sm font-medium text-slate-900 truncate">{hit.title}</span>
                        <span className="text-xs text-slate-500 truncate">{hit.subtitle}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-40">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Notifications</span>
                    <span className="text-xs text-slate-500 tabular-nums">{notifications.length}</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-slate-500 text-center">
                        You are all caught up.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(n.path);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex flex-col gap-0.5"
                        >
                          <span className="text-xs font-semibold text-slate-900 line-clamp-1">
                            {n.title}
                          </span>
                          <span className="text-xs text-slate-500 line-clamp-1">
                            {n.detail} · {n.time}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2.5 py-1 pl-1 pr-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Avatar src={user?.profileImage} name={user?.name || 'User'} size="sm" />
                <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-xs font-semibold text-slate-900 leading-tight max-w-[130px] truncate">
                    {user?.name}
                  </span>
                  <span className="text-[11px] text-slate-500 capitalize leading-tight">
                    {user?.role}
                  </span>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserCircle className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>
                  {user?.role === 'admin' && (
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>System Settings</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
