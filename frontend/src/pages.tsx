import { BranchesPage } from './features/branches/BranchesPage';
import { rows } from './data';
import { DataTable, Filters, FormCard, Page, Stat } from './components/PageKit';
import branch from './assets/icons/branch.svg';
import users from './assets/icons/users.svg';
import stethoscope from './assets/icons/stethoscope.svg';
import door from './assets/icons/door.svg';
import clipboard from './assets/icons/clipboard.svg';
import wallet from './assets/icons/wallet.svg';
import percent from './assets/icons/percent.svg';
import database from './assets/icons/database.svg';
const configs: Record<string, [string, string, string[], string[][], string?]> = {
  users: [
    'Users & Roles',
    'Manage system users, role assignment and branch access',
    ['User', 'Name', 'Role', 'Branch Access', 'Status', 'Last Login'],
    [
      ['admin', 'พิริยะ ทาระธรรม', 'System Admin', 'BKK, SAL, CNX', 'Active', '12 Aug 2026 23:28'],
      ['frontdesk', 'นภัสสร ต้อนรับดี', 'Front Desk', 'BKK, SAL', 'Active', '12 Aug 2026 08:45'],
      ['physio', 'สุพจน์ กายภาพเก่ง', 'Physiotherapist', 'BKK', 'Active', '12 Aug 2026 23:17'],
      ['manager', 'ธนกร บริหารงาน', 'Manager', 'BKK, SAL, CNX', 'Active', '12 Aug 2026 07:50'],
      ['frontdesk2', 'ปิยะดา เอื้อเฟื้อ', 'Front Desk', 'CNX', 'Active', '11 Aug 2026 18:00'],
      ['physio2', 'วรรณิศา ฟื้นฟูชีพ', 'Physiotherapist', 'SAL', 'Active', '11 Aug 2026 17:20'],
    ],
    'Add User',
  ],
  staff: [
    'Staff / Physiotherapists',
    'Manage clinic staff, specialties and branch assignment',
    ['Staff ID', 'Name', 'Position', 'Branch', 'Status'],
    [
      ['stf-admin1', 'กิตติ์ ระบบดี / Kittit Raboddee', 'System Admin', 'BKK, SAL, CNX', 'Active'],
      ['stf-fd1', 'นภัสสร ต้อนรับดี / Napassorn Tonpradee', 'Front Desk', 'BKK, SAL', 'Active'],
      ['stf-fd2', 'ปิยะดา เอื้อเฟื้อ / Piyada Ueafuea', 'Front Desk', 'CNX', 'Active'],
      ['stf-mgr1', 'ธนกร บริหารงาน / Thanakorn Borihangam', 'Clinic Manager', 'BKK, SAL, CNX', 'Active'],
      ['stf-phy1', 'สุพจน์ กายภาพเก่ง / Supoj Kaiyaphapkeng', 'Physiotherapist', 'BKK', 'Active'],
      ['stf-phy2', 'วรรณิศา ฟื้นฟูชีพ / Wanwisa Kluenwaidee', 'Physiotherapist', 'BKK, SAL', 'Active'],
      ['stf-phy3', 'อรรถพล ฟื้นฟูชีพ / Atthapon Fuenfuchiep', 'Physiotherapist', 'SAL', 'Active'],
    ],
    'Add Staff',
  ],
  services: [
    'Services',
    'Manage single-visit treatments, duration and pricing',
    ['Service Name', 'Type', 'Price', 'Duration', 'Status'],
    [
      ['Physical Assessment', 'Assessment', '฿500', '30 min', 'Active'],
      ['Office Syndrome Treatment', 'Single Visit', '฿900', '45 min', 'Active'],
      ['Sports Injury Rehabilitation', 'Single Visit', '฿1,200', '60 min', 'Active'],
      ['Lower Back Pain Therapy', 'Single Visit', '฿1,000', '45 min', 'Active'],
      ['Post-Operative Rehabilitation', 'Single Visit', '฿1,400', '60 min', 'Active'],
      ['Shockwave Therapy', 'Single Visit', '฿1,600', '30 min', 'Active'],
      ['Dry Needling', 'Single Visit', '฿800', '30 min', 'Active'],
    ],
    'Create Service',
  ],
  courses: [
    'Courses',
    'Manage treatment course packages and visit entitlements',
    ['Code', 'Course Name', 'Visits', 'Price', 'Status'],
    rows.courses,
    'Create Course',
  ],
  payments: [
    'Payment Methods',
    'Configure accepted payment methods',
    ['Code', 'Method', 'Description', 'Status'],
    rows.payments,
  ],
  rooms: [
    'Rooms / Resources',
    'Manage rooms and shared clinic resources',
    ['Resource Name', 'Type', 'Branch', 'Status'],
    [
      ['Treatment Room 1', 'Treatment Room', 'สาขาสุขุมวิท (Sukhumvit)', 'Active'],
      ['Treatment Room 2', 'Treatment Room', 'สาขาสุขุมวิท (Sukhumvit)', 'Active'],
      ['Exercise Area', 'Open Area', 'สาขาสุขุมวิท (Sukhumvit)', 'Active'],
      ['Running Lab', 'Specialty Room', 'สาขาสุขุมวิท (Sukhumvit)', 'Active'],
      ['Treatment Room 1', 'Treatment Room', 'สาขาศาลายา (Salaya)', 'Active'],
      ['Exercise Area', 'Open Area', 'สาขาเชียงใหม่ (Chiang Mai)', 'Active'],
    ],
    'Add Resource',
  ],
  'commission-rules': [
    'Commission Rules',
    'Define staff commission calculation rules',
    ['Rule Name', 'Applies To', 'Target', 'Commission', 'Effective Date', 'Status'],
    [
      ['Standard Treatment Commission', 'Treatment', 'All Services / Courses', '5%', '01 Jan 2026', 'Active'],
      ['Office Syndrome Treatment Commission', 'Treatment', 'Office Syndrome Treatment', '6%', '01 Jan 2026', 'Active'],
      ['Course Sales Commission', 'Sales', 'All Courses', '8%', '01 Jan 2026', 'Active'],
      ['Single Visit Sales Commission', 'Sales', 'All Services', '฿50', '01 Jan 2026', 'Active'],
      ['Post-Op Rehab Combined Commission', 'Treatment + Sales', 'Post-Operative Rehabilitation', '7%', '01 Feb 2026', 'Active'],
    ],
    'Create Rule',
  ],
  'customer-groups': ['Master Data', 'Manage shared dropdown values used across patient registration and checkout', ['Value', 'Status'], [['Walk-in', 'Active'], ['Member', 'Active'], ['VIP', 'Active'], ['Corporate', 'Active'], ['Staff / Family', 'Inactive']], 'Add Customer Group'],
  transactions: [
    'Transactions',
    'Review clinic sales and payment transactions',
    ['Transaction', 'Date', 'Patient', 'Item', 'Amount', 'Status'],
    rows.transactions,
  ],
  'front-transactions': [
    'Transactions',
    'Receive payments, issue receipts and review daily transactions',
    ['Transaction', 'Date', 'Patient', 'Item', 'Amount', 'Status'],
    rows.transactions,
    'New Transaction',
  ],
  appointments: [
    'Appointments & Visits',
    'Manage clinic appointments and visit status',
    ['Date & Time', 'Patient', 'Service', 'Physiotherapist', 'Status'],
    rows.appointments,
    'New Appointment',
  ],
  'my-appointments': [
    'My Appointments',
    'View and manage your assigned treatment schedule',
    ['Date & Time', 'Patient', 'Service', 'Physiotherapist', 'Status'],
    rows.appointments,
  ],
  'patient-appointments': [
    'My Appointments',
    'View upcoming and previous clinic appointments',
    ['Date & Time', 'Patient', 'Service', 'Physiotherapist', 'Status'],
    rows.appointments,
  ],
  patients: [
    'Patients',
    'Search and manage clinic patient records',
    ['HN', 'Patient Name', 'Phone', 'Customer Group', 'Last Visit'],
    rows.patients,
    'New Patient',
  ],
  'physio-patients': [
    'Patients',
    'View patients assigned to your care',
    ['HN', 'Patient Name', 'Phone', 'Customer Group', 'Last Visit'],
    rows.patients,
  ],
  visits: [
    'Visits',
    'Check in patients and track treatment progress',
    ['Date & Time', 'Patient', 'Service', 'Physiotherapist', 'Status'],
    rows.appointments,
    'Walk-in Visit',
  ],
};
const quickLinks = [
  ['branches', 'Branches', 'Manage clinic locations', branch],
  ['users', 'Users & Roles', 'Manage logins and access', users],
  ['staff', 'Staff / Physiotherapists', 'Manage clinical staff', stethoscope],
  ['rooms', 'Rooms / Resources', 'Manage treatment rooms', door],
  ['services', 'Services / Courses', 'Manage pricing & packages', clipboard],
  ['payments', 'Payment Methods', 'Configure accepted payments', wallet],
  ['commission-rules', 'Commission Rules', 'Configure staff commission', percent],
  ['customer-groups', 'Master Data', 'Customer groups, referral sources', database],
];
function Dashboard() {
  return (
    <Page title="Dashboard" subtitle="System overview and setup">
      <div className="admin-stats">
        <Stat label="Active Branches" value="3/3" icon={branch} />
        <Stat label="Active Staff" value="9/11" icon={stethoscope} />
        <Stat label="Active Users" value="8/8" tone="green" icon={users} />
        <Stat label="Active Services" value="7/8" tone="orange" icon={clipboard} />
      </div>
      <h3 className="section-label">QUICK LINKS</h3>
      <div className="quick-links">
        {quickLinks.map(([path, label, desc, icon]) => (
          <button
            key={path}
            className="quick-link"
            onClick={() => (location.hash = `admin/${path}`)}
          >
            <span className="quick-icon"><img src={icon} alt="" /></span>
            <strong>{label}</strong>
            <small>{desc}</small>
          </button>
        ))}
      </div>
    </Page>
  );
}
function Tabs({ items }: { items: string[] }) {
  return (
    <div className="settings-tabs">
      {items.map((item, index) => <button className={index === 0 ? 'active' : ''} key={item}>{item}</button>)}
    </div>
  );
}
function PaymentMethods() {
  const methods = [['Cash', true], ['Transfer', true], ['QR Payment', true], ['Credit Card', false]];
  return (
    <Page title="Payment Methods" subtitle="Disabled payment methods will not appear as an option during checkout">
      <div className="payment-grid">
        {methods.map(([name, enabled]) => (
          <article className="payment-method" key={String(name)}>
            <i />
            <span><b>{name}</b><small className={enabled ? 'visible' : ''}>{enabled ? 'Visible at Checkout' : 'Hidden at Checkout'}</small></span>
            <button className={`mini-switch ${enabled ? 'on' : ''}`} aria-label={`Toggle ${name}`}><i /></button>
          </article>
        ))}
      </div>
    </Page>
  );
}
function SettingsPage({ path }: { path: string }) {
  if (path === 'payments') return <PaymentMethods />;
  const c = configs[path] ?? configs.users;
  const tabs = path === 'users' ? ['Users', 'Roles & Permissions'] : path === 'services' ? ['Services', 'Courses'] : path === 'customer-groups' ? ['Customer Group'] : null;
  return (
    <Page title={c[0]} subtitle={c[1]} action={c[4]}>
      {tabs && <Tabs items={tabs} />}
      <DataTable headers={c[2]} rows={c[3]} />
    </Page>
  );
}
function Report({ path }: { path: string }) {
  const map: Record<string, string> = {
    revenue: 'Revenue Report',
    'course-balance': 'Course Balance Report',
    'course-transfer': 'Course Transfer Report',
    'staff-sales': 'Staff Sales Report',
    commission: 'Commission Report',
    'my-commission': 'My Commission',
  };
  return (
    <Page title={map[path]} subtitle="Analyze clinic performance with date and branch filters">
      <Filters />
      <div className="stats">
        <Stat label="Total Revenue" value="฿128,450" />
        <Stat label="Transactions" value="86" />
        <Stat label="Average Value" value="฿1,494" />
        <Stat label="Growth" value="+12.8%" tone="green" />
      </div>
      <DataTable
        headers={['Date', 'Reference', 'Description', 'Branch', 'Amount']}
        rows={rows.transactions.map((r) => [r[1], r[0], r[3], 'BKK', r[4]])}
      />
    </Page>
  );
}
function PatientHome() {
  return (
    <Page title="Welcome back, สรวิชญ์" subtitle="Here’s an overview of your care with us">
      <div className="patient-grid">
        <FormCard title="Next Appointment">
          <div className="appointment-card">
            <b>14 Aug 2026 10:00</b>
            <span>Office Syndrome Treatment with อรรถพล ฟื้นฟูชีพ</span>
            <small>สาขาศาลายา (Salaya)</small>
          </div>
        </FormCard>
        <FormCard title="Quick Actions">
          <button>My Appointments</button>
          <button>My Course</button>
          <button>My Transactions</button>
        </FormCard>
      </div>
      <h3>My Active Course</h3>
      <div className="course-card">
        <b>Office Syndrome Package</b>
        <span>3 of 5 visits remaining</span>
        <progress value="2" max="5" />
      </div>
      <h3>Recent Activity</h3>
      <DataTable
        headers={['Activity', 'Date']}
        rows={[
          ['Office Syndrome Package', '06 Aug 2026'],
          ['Office Syndrome Package', '30 Jul 2026'],
        ]}
      />
    </Page>
  );
}
function NewForm({
  appointment = false,
  profile = false,
}: {
  appointment?: boolean;
  profile?: boolean;
}) {
  const title = profile ? 'My Profile' : appointment ? 'New Appointment' : 'New Patient';
  return (
    <Page
      title={title}
      subtitle={
        profile
          ? 'View and update your personal details'
          : appointment
            ? 'Schedule a new patient visit'
            : 'Create a patient profile and contact record'
      }
    >
      <div className="form-stack">
        <FormCard title={appointment ? 'Patient' : 'Personal Information'}>
          <div className="field-grid">
            <label>
              {appointment ? 'Search patient' : 'Full Name'}
              <input
                defaultValue={profile ? 'สรวิชญ์ ใจยินดี' : ''}
                placeholder={appointment ? 'Search by HN, name or phone...' : 'Patient full name'}
              />
            </label>
            <label>
              {appointment ? 'Date' : 'Phone'}
              <input
                type={appointment ? 'date' : 'tel'}
                defaultValue={profile ? '081-234-5678' : undefined}
              />
            </label>
            {!appointment && (
              <>
                <label>
                  Date of Birth
                  <input type="date" />
                </label>
                <label>
                  Gender
                  <select>
                    <option>Select gender</option>
                  </select>
                </label>
              </>
            )}
          </div>
        </FormCard>
        <FormCard title={appointment ? 'Schedule' : 'Contact & Care'}>
          <div className="field-grid">
            <label>
              Branch
              <select>
                <option>สาขาสุขุมวิท (Sukhumvit)</option>
              </select>
            </label>
            <label>
              {appointment ? 'Service' : 'Customer Group'}
              <select>
                <option>Select option</option>
              </select>
            </label>
            <label>
              {appointment ? 'Physiotherapist' : 'Email'}
              <input />
            </label>
            <label>
              {appointment ? 'Room / Resource' : 'Referral Channel'}
              <select>
                <option>Select option</option>
              </select>
            </label>
            <label className="wide">
              Note
              <textarea placeholder="Optional note" />
            </label>
          </div>
        </FormCard>
        <div className="form-actions">
          <button>Cancel</button>
          <button className="primary">
            {profile ? 'Save Changes' : appointment ? 'Create Appointment' : 'Create Patient'}
          </button>
        </div>
      </div>
    </Page>
  );
}
export function PageRouter({ path }: { path: string }) {
  if (path === 'branches') return <BranchesPage />;
  if (['dashboard', 'front-dashboard'].includes(path)) return <Dashboard />;
  if (path === 'home') return <PatientHome />;
  if (
    [
      'revenue',
      'course-balance',
      'course-transfer',
      'staff-sales',
      'commission',
      'my-commission',
    ].includes(path)
  )
    return <Report path={path} />;
  if (path === 'new-patient') return <NewForm />;
  if (path === 'new-appointment') return <NewForm appointment />;
  if (path === 'profile') return <NewForm profile />;
  if (path === 'patient-courses')
    return (
      <Page title="My Course" subtitle="Track active and completed treatment packages">
        <DataTable
          headers={['Course', 'Purchased', 'Used', 'Remaining', 'Status']}
          rows={[['Office Syndrome Package', '5 visits', '2 visits', '3 visits', 'Active']]}
        />
      </Page>
    );
  if (path === 'patient-transactions')
    return (
      <Page title="My Transactions" subtitle="Review payments and download receipts">
        <DataTable
          headers={['Transaction', 'Date', 'Item', 'Amount', 'Status']}
          rows={rows.transactions.map((r) => [r[0], r[1], r[3], r[4], r[5]])}
        />
      </Page>
    );
  return <SettingsPage path={path} />;
}
