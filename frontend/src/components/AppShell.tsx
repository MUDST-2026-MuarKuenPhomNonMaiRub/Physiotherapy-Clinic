import type { ReactNode } from 'react';
import activity from '../assets/icons/activity.svg';
import bell from '../assets/icons/bell.svg';
import logout from '../assets/icons/logout.svg';
import building from '../assets/icons/building.svg';
import users from '../assets/icons/users.svg';
import clipboard from '../assets/icons/clipboard.svg';
import wallet from '../assets/icons/wallet.svg';
export type Role = 'admin' | 'manager' | 'frontdesk' | 'physio';
export type NavItem = { path: string; label: string; group?: string };
export const roleNames: Record<Role, string> = {
  admin: 'System Admin',
  manager: 'Manager',
  frontdesk: 'Front Desk',
  physio: 'Physiotherapist',
};
const names: Record<Role, string> = {
  admin: 'พิริยะ ทาระธรรม',
  manager: 'ธนกร บริหารงาน',
  frontdesk: 'นภัสสร ต้อนรับดี',
  physio: 'สุพจน์ กายภาพเก่ง',
};
export const menus: Record<Role, NavItem[]> = {
  admin: [
    { path: 'dashboard', label: 'Dashboard' },
    { path: 'branches', label: 'Branches', group: 'ORGANIZATION' },
    { path: 'rooms', label: 'Rooms / Resources' },
    { path: 'users', label: 'Users & Roles', group: 'PEOPLE & ACCESS' },
    { path: 'staff', label: 'Staff / Physiotherapists' },
    { path: 'services', label: 'Services / Courses', group: 'BUSINESS CONFIGURATION' },
    { path: 'payments', label: 'Payment Methods' },
    { path: 'commission-rules', label: 'Commission Rules' },
    { path: 'customer-groups', label: 'Master Data', group: 'DATA' },
    { path: 'referrals', label: 'Referral Channels' },
    { path: 'insurers', label: 'Insurance Companies' },
  ],
  manager: [
    { path: 'dashboard', label: 'Dashboard' },
    { path: 'appointments', label: 'Calendar' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'revenue', label: 'Revenue', group: 'REPORTS' },
    { path: 'course-balance', label: 'Course Balance' },
    { path: 'course-transfer', label: 'Course Transfer' },
    { path: 'staff-sales', label: 'Staff Sales' },
    { path: 'commission', label: 'Commission' },
  ],
  frontdesk: [
    { path: 'patients', label: 'Patients' },
    { path: 'appointments', label: 'Appointments & Visits' },
    { path: 'checkout', label: 'Checkout' },
    { path: 'patient-courses-front', label: 'Patient Courses' },
    { path: 'front-transactions', label: 'Transactions' },
  ],
  physio: [
    { path: 'my-appointments', label: 'My Appointments' },
    { path: 'physio-patients', label: 'Patients' },
    { path: 'my-commission', label: 'My Commission' },
  ],
};
const icons = [building, users, clipboard, wallet];
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
    current = menu.find((x) => x.path === path)?.label ?? 'Dashboard';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <img src={activity} alt="" />
          </span>
          <span>
            <strong>PhysioCare Clinic</strong>
            <small>Clinic Management System</small>
          </span>
        </div>
        <nav>
          {menu.map((item, i) => (
            <span key={item.path}>
              {item.group && <small className="nav-group">{item.group}</small>}
              <button
                className={`nav-item ${path === item.path ? 'active' : ''}`}
                onClick={() => onNavigate(item.path)}
              >
                <img src={icons[i % icons.length]} alt="" />
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
            <strong>{current}</strong>
          </div>
          <div className="header-tools">
            <label className="global-search">
              ⌕ <input placeholder="Search HN, name, phone..." />
            </label>
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
