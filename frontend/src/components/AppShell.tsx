import type { ReactNode } from 'react';
import activity from '../assets/icons/activity.svg';
import bell from '../assets/icons/bell.svg';
import logout from '../assets/icons/logout.svg';
import building from '../assets/icons/building.svg';
import users from '../assets/icons/users.svg';
import clipboard from '../assets/icons/clipboard.svg';
import wallet from '../assets/icons/wallet.svg';
import branch from '../assets/icons/branch.svg';
import door from '../assets/icons/door.svg';
import stethoscope from '../assets/icons/stethoscope.svg';
import percent from '../assets/icons/percent.svg';
import database from '../assets/icons/database.svg';
export type Role = 'admin' | 'physio';
export type NavItem = { path: string; label: string; group?: string };
export const roleNames: Record<Role, string> = {
  admin: 'ADMIN (Owner)',
  physio: 'PHYSIO',
};
const names: Record<Role, string> = {
  admin: 'พิริยะ ทาระธรรม',
  physio: 'สุพจน์ กายภาพเก่ง',
};
export const menus: Record<Role, NavItem[]> = {
  admin: [
    { path: 'calendar', label: 'Calendar' },
    { path: 'patients', label: 'Patients', group: 'PATIENTS' },
    { path: 'appointments', label: 'Appointment & Visits' },
    { path: 'patient-courses', label: 'Patient Courses' },
    { path: 'course-transfer', label: 'Course Transfer' },
    { path: 'checkout', label: 'Checkout', group: 'FINANCE' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'revenue', label: 'Revenue', group: 'REPORTS' },
    { path: 'course-balance', label: 'Course Balance' },
    { path: 'staff-sales', label: 'Staff Sales' },
    { path: 'commission', label: 'Commission' },
    { path: 'branches', label: 'Branches', group: 'ADMINISTRATION' },
    { path: 'rooms', label: 'Rooms & Resources' },
    { path: 'staff', label: 'Staff & Access' },
    { path: 'services', label: 'Treatments & Course' },
    { path: 'payments', label: 'Payment Methods' },
    { path: 'commission-rules', label: 'Commission Rules' },
    { path: 'customer-groups', label: 'Master Data' },
  ],
  physio: [
    { path: 'calendar', label: 'Calendar' },
    { path: 'patients', label: 'Patient', group: 'PATIENTS' },
    { path: 'appointments', label: 'Appointment & Visits' },
    { path: 'patient-courses', label: 'Patient Courses' },
    { path: 'course-transfer', label: 'Course Transfer' },
    { path: 'checkout', label: 'Checkout', group: 'FINANCE' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'commission', label: 'Commission', group: 'REPORTS' },
  ],
};
const navIcons: Record<string, string> = {
  dashboard: clipboard,
  calendar: activity,
  appointments: clipboard,
  patients: users,
  'patient-courses': clipboard,
  'course-transfer': branch,
  checkout: wallet,
  transactions: wallet,
  revenue: activity,
  'course-balance': database,
  'staff-sales': users,
  commission: percent,
  branches: branch,
  rooms: door,
  users,
  staff: stethoscope,
  services: clipboard,
  payments: wallet,
  'commission-rules': percent,
  'customer-groups': database,
};
export function AppShell({
  role,
  path,
  onNavigate,
  onLogout,
  children,
}: {
  role: Role;
  path: string;
  onNavigate: (p: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const menu = menus[role],
    current = menu.find((x) => x.path === path)?.label ?? 'Dashboard',
    isSettings = role === 'admin' && ['branches', 'rooms', 'users', 'staff', 'services', 'payments', 'commission-rules', 'customer-groups'].includes(path);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/la-balance-logo.png" alt="LA BALANCE Physical Therapy Clinic" />
        </div>
        <nav>
          {menu.map((item, i) => (
            <span key={`${item.path}-${item.label}-${i}`}>
              {item.group && <small className="nav-group">{item.group}</small>}
              <button
                className={`nav-item ${path === item.path ? 'active' : ''}`}
                onClick={() => onNavigate(item.path)}
              >
                <img src={navIcons[item.path] ?? clipboard} alt="" />
                <span>{item.label}</span>
              </button>
            </span>
          ))}
        </nav>
        <div className="side-profile">
          <span className="avatar pale">{names[role].slice(0, 2)}</span>
          <span>
            <strong>{names[role]}</strong>
            <small>{roleNames[role]}</small>
          </span>
          <button onClick={onLogout}>
            <img src={logout} alt="Log out" />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="crumb">
            <span>PhysioCare</span>
            <b>›</b>
            {isSettings && <><span>Settings</span><b>›</b></>}
            <strong>{current}</strong>
          </div>
          <div className="header-tools">
            <button className="branch-select">
              <img src={building} alt="" />
              สาขาสุขุมวิท (Sukhumvit)<span>⌄</span>
            </button>
            <button className="bell">
              <img src={bell} alt="Notifications" />
              <i />
            </button>
            <div className="profile">
              <span className="avatar">{names[role].slice(0, 2)}</span>
              <strong>{names[role]}</strong>
              <em>{roleNames[role]}</em>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
