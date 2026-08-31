import { useState } from 'react';
import { BranchesPage } from './features/branches/BranchesPage';
import { branchHnCodes, patientDirectory, rows, type PatientDirectoryRecord } from './data';
import { DataTable, Filters, FormCard, Page, Stat } from './components/PageKit';
import branch from './assets/icons/branch.svg';
import users from './assets/icons/users.svg';
import stethoscope from './assets/icons/stethoscope.svg';
import door from './assets/icons/door.svg';
import clipboard from './assets/icons/clipboard.svg';
import wallet from './assets/icons/wallet.svg';
import percent from './assets/icons/percent.svg';
import database from './assets/icons/database.svg';
import calendarPlus from './assets/icons/calendar-plus.svg';
import cart from './assets/icons/cart.svg';
import { useClinicStoreVersion, writeClinicValue } from './services/clinic-store';
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
const patientStorageKey = 'physiocare-patients';
const patientDetailsStorageKey = 'physiocare-patient-details';
const patientCoursesStorageKey = 'physiocare-patient-courses';
type PatientRow = string[];
type PatientCourse = {
  id: string;
  patientHn: string;
  patientName: string;
  branch: string;
  course: string;
  purchased: number;
  bonus: number;
  used: number;
  expiry: string;
};
type AppointmentRecord = { id: string; date: string; time: string; patient: string; service: string; physiotherapist: string; branch: string; status: string; resource?: string };
type TransactionRecord = { id: string; date: string; patient: string; item: string; amount: number; method: string; status: 'Paid' | 'Voided'; voidReason?: string };
type TransferRecord = { id: string; from: string; to: string; course: string; amount: number; date: string };
const appointmentStorageKey = 'physiocare-appointments';
const transactionStorageKey = 'physiocare-transactions';
const transferStorageKey = 'physiocare-course-transfers';
const pendingPatientKey = 'physiocare-pending-patient';
const pendingCoursePurchaseKey = 'physiocare-pending-course-purchase';

function readPatients(): PatientRow[] {
  try {
    const saved = localStorage.getItem(patientStorageKey);
    return saved ? JSON.parse(saved) as PatientRow[] : rows.patients;
  } catch {
    return rows.patients;
  }
}

function writePatients(patients: PatientRow[]) {
  writeClinicValue(patientStorageKey, patients);
}

function readPatientCourses(): PatientCourse[] {
  try {
    const saved = localStorage.getItem(patientCoursesStorageKey);
    if (saved) return JSON.parse(saved) as PatientCourse[];
  } catch {
    // Use generated preview data when local storage is unavailable.
  }
  const branches = ['BKK', 'SAL', 'CNX'];
  const today = new Date();
  return Array.from({ length: 10 }, (_, index) => {
    const patient = rows.patients[index % rows.patients.length];
    const course = rows.courses[index % rows.courses.length];
    const purchased = Number.parseInt(course[2], 10) || 5;
    const bonus = index % 4;
    const total = purchased + bonus;
    return {
      id: `PC-${index + 1}`,
      patientHn: patient[0],
      patientName: patient[1],
      branch: branches[index % branches.length],
      course: course[1],
      purchased,
      bonus,
      used: (index * 3) % (total + 1),
      expiry: new Date(today.getFullYear(), today.getMonth() + index - 3, 28).toISOString().slice(0, 10),
    };
  });
}

function writePatientCourses(value: PatientCourse[]) { writeClinicValue(patientCoursesStorageKey, value); }

function readAppointments(): AppointmentRecord[] {
  try {
    const saved = localStorage.getItem(appointmentStorageKey);
    if (saved) return JSON.parse(saved) as AppointmentRecord[];
  } catch { /* use preview data */ }
  return rows.appointments.map((item, index) => {
    const [date, time] = item[0].split(' ');
    return { id: `APT-${index + 1}`, date: '2026-08-31', time: time ?? '10:00', patient: item[1], service: item[2], physiotherapist: item[3], branch: index ? 'SAL' : 'BKK', status: item[4] };
  });
}

function writeAppointments(value: AppointmentRecord[]) { writeClinicValue(appointmentStorageKey, value); }

function readTransactions(): TransactionRecord[] {
  try {
    const saved = localStorage.getItem(transactionStorageKey);
    if (saved) return JSON.parse(saved) as TransactionRecord[];
  } catch { /* use preview data */ }
  return rows.transactions.map((item) => ({ id: item[0], date: item[1], patient: item[2], item: item[3], amount: Number(item[4].replace(/[^0-9.]/g, '')) || 0, method: 'Cash', status: item[5] === 'Paid' ? 'Paid' : 'Voided' }));
}

function writeTransactions(value: TransactionRecord[]) { writeClinicValue(transactionStorageKey, value); }

function readTransferHistory(): TransferRecord[] {
  try { return JSON.parse(localStorage.getItem(transferStorageKey) ?? '[]') as TransferRecord[]; } catch { return []; }
}

function writeTransferHistory(value: TransferRecord[]) { writeClinicValue(transferStorageKey, value); }

function PatientCoursesPage() {
  useClinicStoreVersion();
  const [courses, setCourses] = useState<PatientCourse[]>(readPatientCourses);
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [courseName, setCourseName] = useState('all');
  const [status, setStatus] = useState('all');
  const pendingPatient = localStorage.getItem(pendingPatientKey) ?? rows.patients[0][0];
  const [purchaseOpen, setPurchaseOpen] = useState(() => localStorage.getItem(pendingCoursePurchaseKey) === 'true');
  const [purchase, setPurchase] = useState({ patientHn: pendingPatient, course: rows.courses[0][1], branch: 'BKK', purchased: 5, bonus: 0 });
  const today = new Date();
  const getStatus = (item: PatientCourse) => {
    if (new Date(`${item.expiry}T23:59:59`) < today) return 'Expired';
    if (item.purchased + item.bonus - item.used <= 0) return 'Used Up';
    return 'Active';
  };
  const visible = courses.filter((item) => {
    const matchesQuery = `${item.patientHn} ${item.patientName} ${item.course}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (branch === 'all' || item.branch === branch) && (courseName === 'all' || item.course === courseName) && (status === 'all' || getStatus(item) === status);
  });
  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const useVisit = (id: string) => setCourses((current) => { const next = current.map((item) => item.id === id && item.used < item.purchased + item.bonus ? { ...item, used: item.used + 1 } : item); writePatientCourses(next); return next; });
  const addPurchase = () => { const patient = readPatients().find((item) => item[0] === purchase.patientHn) ?? rows.patients[0]; const next = [{ id: `PC-${Date.now()}`, patientHn: patient[0], patientName: patient[1], branch: purchase.branch, course: purchase.course, purchased: purchase.purchased, bonus: purchase.bonus, used: 0, expiry: new Date(new Date().getFullYear(), new Date().getMonth() + 12, 28).toISOString().slice(0, 10) }, ...courses]; setCourses(next); writePatientCourses(next); localStorage.removeItem(pendingPatientKey); localStorage.removeItem(pendingCoursePurchaseKey); setPurchaseOpen(false); };
  return (
    <Page title="Patient Courses" subtitle="Track course balances, usage and expiry across all patients">
      <div className="course-page-actions"><button className="primary" onClick={() => setPurchaseOpen((value) => !value)}>＋ Purchase Course</button></div>
      {purchaseOpen && <div className="inline-form"><select value={purchase.patientHn} onChange={(event) => setPurchase((current) => ({ ...current, patientHn: event.target.value }))}>{readPatients().map((item) => <option key={item[0]} value={item[0]}>{item[0]} {item[1]}</option>)}</select><select value={purchase.course} onChange={(event) => setPurchase((current) => ({ ...current, course: event.target.value }))}>{rows.courses.map((item) => <option key={item[0]}>{item[1]}</option>)}</select><input type="number" min="1" value={purchase.purchased} onChange={(event) => setPurchase((current) => ({ ...current, purchased: Number(event.target.value) }))} /><input type="number" min="0" value={purchase.bonus} onChange={(event) => setPurchase((current) => ({ ...current, bonus: Number(event.target.value) }))} /><button className="primary" onClick={addPurchase}>Save Purchase</button></div>}
      <div className="course-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or HN..." aria-label="Search patient courses" />
        <select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="all">All Branches</option>{['BKK', 'SAL', 'CNX'].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={courseName} onChange={(event) => setCourseName(event.target.value)}><option value="all">All Courses</option>{Array.from(new Set(courses.map((item) => item.course))).map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Statuses</option><option>Active</option><option>Used Up</option><option>Expired</option></select>
        <span>{visible.length} courses</span>
      </div>
      <div className="course-table-wrap"><table className="course-table"><thead><tr><th>Patient</th><th>Course</th><th>Purchased</th><th>Bonus</th><th>Used</th><th>Balance</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((item) => {
        const balance = item.purchased + item.bonus - item.used;
        const total = item.purchased + item.bonus;
        const itemStatus = getStatus(item);
        const balanceTone = itemStatus === 'Expired' ? 'expired' : balance <= 0 ? 'empty' : balance / total <= 0.35 ? 'warning' : 'healthy';
        return <tr key={item.id}><td><strong>{item.patientName}</strong><small>{item.patientHn}</small></td><td>{item.course}</td><td>{item.purchased}</td><td>{item.bonus}</td><td>{item.used}</td><td><strong>{Math.max(balance, 0)} / {total}</strong><div className={`balance-bar ${balanceTone}`}><i style={{ width: `${Math.max(0, Math.min(100, (balance / total) * 100))}%` }} /></div></td><td>{formatDate(item.expiry)}</td><td><span className={`course-status ${itemStatus.toLowerCase().replace(' ', '-')}`}>• {itemStatus}</span></td><td><button className="text-action" disabled={balance <= 0 || itemStatus === 'Expired'} onClick={() => useVisit(item.id)}>Use 1</button></td></tr>;
      })}</tbody></table></div>
    </Page>
  );
}

function PatientListPage() {
  const [patients] = useState<PatientDirectoryRecord[]>(() => {
    const stored = readPatients();
    const known = new Set(patientDirectory.map((patient) => patient.hn));
    const extra = stored.filter((patient) => !known.has(patient[0])).map((patient) => ({
      hn: patient[0], name: patient[1], nameEn: '', nickname: '—', idCard: '—', gender: '—', phone: patient[2], customerGroup: patient[3], branch: 'BKK', activeCourses: 0, latestVisit: patient[4], dateCreated: patient[4],
    }));
    return [...patientDirectory, ...extra];
  });
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<PatientDirectoryRecord | null>(null);
  const pageSize = 10;
  const filtered = patients.filter((patient) => `${patient.hn} ${patient.name} ${patient.nameEn} ${patient.nickname} ${patient.idCard} ${patient.phone} ${patient.customerGroup}`.toLowerCase().includes(query.trim().toLowerCase()) && (branch === 'all' || patient.branch === branch));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Page title="Patients" subtitle={`${patients.length} registered patients`} action="Register Patient">
      <div className="patient-toolbar">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by HN, name, phone, national ID..." aria-label="Search patients" />
        <select value={branch} onChange={(event) => { setBranch(event.target.value); setPage(1); }}><option value="all">All Branches</option><option value="BKK">สาขาสุขุมวิท (Sukhumvit)</option><option value="SAL">สาขาศาลายา (Salaya)</option><option value="CNX">สาขาเชียงใหม่ (Chiang Mai)</option></select>
        <span>{filtered.length} results</span>
      </div>
      <div className="patient-table-wrap"><table className="patient-table"><thead><tr><th>HN</th><th>Name</th><th>NickName</th><th>ID CARD</th><th>SEX</th><th>Phone No.</th><th>Group</th><th>Date Created</th><th>Actions</th></tr></thead><tbody>{pageRows.map((patient) => <tr key={patient.hn}><td><button className="patient-link" onClick={() => setSelectedPatient(patient)}>{patient.hn}</button></td><td><button className="patient-name patient-name-link" onClick={() => setSelectedPatient(patient)}><strong>{patient.name}<small>{patient.nameEn}</small></strong></button></td><td>{patient.nickname}</td><td>{patient.idCard}</td><td><span className="gender-pill">{patient.gender}</span></td><td>{patient.phone}</td><td>{patient.customerGroup}</td><td>{patient.dateCreated}</td><td><div className="patient-actions"><button aria-label={`Book appointment for ${patient.name}`} onClick={() => { localStorage.setItem(pendingPatientKey, patient.hn); location.hash = `${location.hash.slice(1).split('/')[0] || 'admin'}/new-appointment`; }}><img src={calendarPlus} alt="" /></button><button aria-label={`Purchase course for ${patient.name}`} onClick={() => { localStorage.setItem(pendingPatientKey, patient.hn); localStorage.setItem(pendingCoursePurchaseKey, 'true'); location.hash = `${location.hash.slice(1).split('/')[0] || 'admin'}/patient-courses`; }}><img src={cart} alt="" /></button></div></td></tr>)}</tbody></table><div className="patient-table-footer"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 3).map((value) => <button className={value === page ? 'active' : ''} key={value} onClick={() => setPage(value)}>{value}</button>)}<button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>›</button></div></div></div>
      {selectedPatient && (() => {
        let saved: Record<string, string> = {};
        try { saved = JSON.parse(localStorage.getItem(patientDetailsStorageKey) ?? '{}')[selectedPatient.hn] ?? {}; } catch { /* no optional details saved */ }
        const value = (field: string, fallback = '—') => saved[field] || fallback;
        return <div className="modal-backdrop" role="presentation" onClick={() => setSelectedPatient(null)}><section className="patient-modal" role="dialog" aria-modal="true" aria-labelledby="patient-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close patient details" onClick={() => setSelectedPatient(null)}>×</button><div className="patient-modal-heading"><span>{selectedPatient.name.slice(0, 2)}</span><div><h2 id="patient-modal-title">{selectedPatient.name}</h2><p>{selectedPatient.nameEn || 'Patient profile'} · HN {selectedPatient.hn}</p></div></div><div className="patient-detail-grid"><div><small>Patient Type</small><strong>{value('patientType')}</strong></div><div><small>Title</small><strong>{value('title')}</strong></div><div><small>First Name</small><strong>{value('firstName', selectedPatient.name.split(' ')[0])}</strong></div><div><small>Last Name</small><strong>{value('lastName', selectedPatient.name.split(' ').slice(1).join(' '))}</strong></div><div><small>Nickname</small><strong>{value('nickname', selectedPatient.nickname)}</strong></div><div><small>Gender</small><strong>{value('gender', selectedPatient.gender)}</strong></div><div><small>Phone</small><strong>{value('phone', selectedPatient.phone)}</strong></div><div><small>Date of Birth</small><strong>{value('birthDate')}</strong></div><div><small>National ID</small><strong>{value('nationalId', selectedPatient.idCard)}</strong></div><div><small>Passport No.</small><strong>{value('passport')}</strong></div><div><small>Blood Group</small><strong>{value('bloodGroup')}</strong></div><div><small>Nationality</small><strong>{value('nationality')}</strong></div><div className="detail-wide"><small>Address</small><strong>{value('address')}</strong></div><div><small>Customer Group</small><strong>{value('group', selectedPatient.customerGroup)}</strong></div><div><small>Referral Channel</small><strong>{value('referral')}</strong></div><div><small>Registration Branch</small><strong>{selectedPatient.branch}</strong></div><div><small>Date Created</small><strong>{selectedPatient.dateCreated}</strong></div><div><small>Insurance Type</small><strong>{value('insuranceType')}</strong></div><div><small>Insurance Company</small><strong>{value('insuranceCompany')}</strong></div><div className="detail-wide"><small>Note</small><strong>{value('note')}</strong></div></div></section></div>;
      })()}
      <span className="data-note">Mock patient records are loaded from the data store. New registrations are saved in this browser until the patient API is connected.</span>
    </Page>
  );
}
function Dashboard() {
  useClinicStoreVersion();
  const transactions = readTransactions().filter((item) => item.status === 'Paid');
  const revenue = transactions.reduce((sum, item) => sum + item.amount, 0);
  return (
    <Page title="Dashboard" subtitle="Live clinic overview from recorded transactions">
      <div className="admin-stats">
        <Stat label="Registered Patients" value={String(readPatients().length)} icon={users} />
        <Stat label="Visits Recorded" value={String(readAppointments().length)} icon={stethoscope} />
        <Stat label="Paid Transactions" value={String(transactions.length)} tone="green" icon={wallet} />
        <Stat label="Total Revenue" value={`฿${revenue.toLocaleString()}`} tone="orange" icon={clipboard} />
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
  useClinicStoreVersion();
  const map: Record<string, string> = {
    revenue: 'Revenue Report',
    'course-balance': 'Course Balance Report',
    'course-transfer': 'Course Transfer Report',
    'staff-sales': 'Staff Sales Report',
    commission: 'Commission Report',
    'my-commission': 'My Commission',
  };
  const transactions = readTransactions();
  const paid = transactions.filter((item) => item.status === 'Paid');
  const revenue = paid.reduce((sum, item) => sum + item.amount, 0);
  const reportRows = path === 'course-balance'
    ? readPatientCourses().map((item) => [item.patientHn, item.patientName, item.course, `${Math.max(item.purchased + item.bonus - item.used, 0)} / ${item.purchased + item.bonus}`, item.expiry])
    : transactions.map((item) => [item.date, item.id, item.item, 'BKK', `฿${item.amount.toLocaleString()}`]);
  const commission = Math.round(revenue * 0.05);
  return (
    <Page title={map[path]} subtitle="Analyze clinic performance with date and branch filters">
      <Filters />
      <div className="stats">
        <Stat label="Total Revenue" value={`฿${revenue.toLocaleString()}`} />
        <Stat label="Transactions" value={String(transactions.length)} />
        <Stat label="Average Value" value={`฿${paid.length ? Math.round(revenue / paid.length).toLocaleString() : '0'}`} />
        <Stat label={path === 'commission' ? 'Estimated Commission' : 'Paid Revenue'} value={path === 'commission' ? `฿${commission.toLocaleString()}` : `฿${revenue.toLocaleString()}`} tone="green" />
      </div>
      <DataTable
        headers={path === 'course-balance' ? ['HN', 'Patient', 'Course', 'Balance', 'Expiry'] : ['Date', 'Reference', 'Description', 'Branch', 'Amount']}
        rows={reportRows}
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

function CalendarPage() {
  useClinicStoreVersion();
  const [view, setView] = useState<'today' | 'month' | 'upcoming' | 'completed'>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);
  const today = new Date();
  const physiotherapist = 'สุพจน์ กายภาพเก่ง';
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);
  const isToday = (day: number) => monthOffset === 0 && day === today.getDate();
  const localIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayIso = localIso(today);
  const appointments = readAppointments().filter((item) => item.physiotherapist === physiotherapist && !['Cancelled', 'No Show'].includes(item.status)).filter((item) => {
    if (view === 'today') return item.date === todayIso;
    if (view === 'upcoming') return item.date > todayIso && item.status !== 'Completed';
    if (view === 'completed') return item.status === 'Completed';
    return true;
  }).filter((item) => {
    const eventDate = new Date(`${item.date}T00:00:00`);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });
  const byDay = appointments.reduce<Record<number, AppointmentRecord[]>>((result, item) => {
    const day = Number(item.date.slice(-2));
    (result[day] ??= []).push(item);
    return result;
  }, {});
  const todayAppointments = readAppointments().filter((item) => item.physiotherapist === physiotherapist && item.date === todayIso && !['Cancelled', 'No Show'].includes(item.status));
  const nextAppointment = todayAppointments.filter((item) => item.status !== 'Completed').sort((a, b) => a.time.localeCompare(b.time))[0];
  const monthLabel = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Page title="My Appointments" subtitle="Appointments assigned to you">
      <div className="calendar-summary">
        <div className="calendar-summary-icon">▣</div>
        <div><strong>{todayLabel}</strong><span>{todayAppointments.length} appointments today · {todayAppointments.filter((item) => item.status !== 'Completed').length} remaining</span></div>
        {nextAppointment && <div className="next-appointment"><b>NEXT · {nextAppointment.time}</b><strong>{nextAppointment.patient.replace(/^\S+\s/, '')}</strong><span>{nextAppointment.service}</span></div>}
      </div>
      <div className="calendar-tabs">
        {([['today', `Today (${todayAppointments.length})`], ['month', 'Month'], ['upcoming', 'Upcoming'], ['completed', 'Completed']] as const).map(([key, label]) => (
          <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
        ))}
      </div>
      <div className="calendar-heading"><strong>{monthLabel}</strong><div><button aria-label="Previous month" onClick={() => setMonthOffset((value) => value - 1)}>‹</button><button onClick={() => setMonthOffset(0)}>Today</button><button aria-label="Next month" onClick={() => setMonthOffset((value) => value + 1)}>›</button></div></div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
        {days.map((day, index) => (
          <div className={`calendar-day ${isToday(day) ? 'selected' : ''} ${day < 1 || day > daysInMonth ? 'muted' : ''}`} key={`${day}-${index}`}>
            <span>{day}</span>
            {(byDay[day] ?? []).map((item) => <button key={item.id} onClick={() => setSelectedAppointment(item)}>{item.time} {item.patient.replace(/^\S+\s/, '')}</button>)}
          </div>
        ))}
      </div>
      {selectedAppointment && <div className="calendar-detail"><strong>{selectedAppointment.time} · {selectedAppointment.patient.replace(/^\S+\s/, '')}</strong><span>{selectedAppointment.service} · {selectedAppointment.status}{selectedAppointment.resource ? ` · ${selectedAppointment.resource}` : ''}</span><button onClick={() => setSelectedAppointment(null)}>Close</button></div>}
    </Page>
  );
}

function AdminCalendarPage() {
  useClinicStoreVersion();
  const today = new Date();
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  const todayIso = toIso(today);
  const [selectedDate, setSelectedDate] = useState(toIso(today));
  const [branch, setBranch] = useState('all');
  const [physio, setPhysio] = useState('all');
  const [service, setService] = useState('all');
  const staff = [
    { name: 'สุพจน์ กายภาพเก่ง', branch: 'BKK' },
    { name: 'วรรณิศา เคลื่อนไหวดี', branch: 'SAL' },
    { name: 'อรรถพล ฟื้นฟูชีพ', branch: 'BKK' },
    { name: 'ชนกานต์ ยืดเหยียดดี', branch: 'CNX' },
    { name: 'ปกรณ์ กล้ามเนื้อเก่ง', branch: 'BKK' },
    { name: 'อรอนงค์ กำลังดี', branch: 'SAL' },
  ];
  const mockEvents = [
    { date: todayIso, staff: 'สุพจน์ กายภาพเก่ง', branch: 'BKK', service: 'Lower Back Pain Therapy', start: 9, end: 10, color: 'blue', text: 'นายวิชัย สรีรสวัสดิ์' },
    { date: todayIso, staff: 'สุพจน์ กายภาพเก่ง', branch: 'BKK', service: 'Office Syndrome Treatment', start: 10, end: 11, color: 'green', text: 'นายสายใจ ใจดี' },
    { date: todayIso, staff: 'อรรถพล ฟื้นฟูชีพ', branch: 'BKK', service: 'Sports Rehabilitation', start: 11, end: 12, color: 'green', text: 'นางสาวพรชนก อุ่นใจ' },
    { date: todayIso, staff: 'วรรณิศา เคลื่อนไหวดี', branch: 'SAL', service: 'Lower Back Pain Therapy', start: 13, end: 14, color: 'orange', text: 'นายสมชาย ใจดี' },
    { date: todayIso, staff: 'ชนกานต์ ยืดเหยียดดี', branch: 'CNX', service: 'Post-Operative Rehabilitation', start: 14, end: 15, color: 'orange', text: 'นายธีรวัฒน์ บุญมี' },
    { date: todayIso, staff: 'ชนกานต์ ยืดเหยียดดี', branch: 'CNX', service: 'Assessment', start: 15, end: 16, color: 'blue', text: 'นายกฤษณะ ประเสริฐสุข' },
    { date: todayIso, staff: 'ปกรณ์ กล้ามเนื้อเก่ง', branch: 'BKK', service: 'Post-Operative Rehabilitation', start: 16, end: 17, color: 'green', text: 'นายอดิศร ทองสุข' },
  ];
  const events = [...mockEvents, ...readAppointments().map((item) => {
    const start = Number(item.time.split(':')[0]) || 9;
    const staffName = item.physiotherapist === 'วรรณิศา ฟื้นฟูชีพ' ? 'วรรณิศา เคลื่อนไหวดี' : item.physiotherapist;
    return { date: item.date, staff: staffName, branch: item.branch, service: item.service, start, end: start + 1, color: item.status === 'Completed' ? 'green' : item.status === 'Cancelled' ? 'orange' : 'blue', text: item.patient };
  })];
  const visibleStaff = staff.filter((item) => (branch === 'all' || item.branch === branch) && (physio === 'all' || item.name === physio));
  const visibleEvents = events.filter((item) => item.date === selectedDate && (branch === 'all' || item.branch === branch) && (physio === 'all' || item.staff === physio) && (service === 'all' || item.service === service));
  const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-GB');
  return (
    <Page title="Appointments & Visits" subtitle="Manage bookings, check-ins and treatment progress">
      <div className="admin-calendar-toolbar">
        <div><button onClick={() => window.alert('List view is available from Appointment & Visits')}>☷ List</button><button className="active">▣ Calendar</button><input aria-label="Calendar date" className="calendar-date-input" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /><button onClick={() => setSelectedDate(todayIso)}>Today</button></div>
        <strong>{visibleEvents.length} appointments · {dateLabel}</strong>
      </div>
      <div className="admin-calendar-filters"><select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="all">All Branches</option><option value="BKK">Sukhumvit (BKK)</option><option value="SAL">Salaya (SAL)</option><option value="CNX">Chiang Mai (CNX)</option></select><select value={physio} onChange={(event) => setPhysio(event.target.value)}><option value="all">All Physiotherapists</option>{staff.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><select value={service} onChange={(event) => setService(event.target.value)}><option value="all">All Services</option>{Array.from(new Set(events.map((item) => item.service))).map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="staff-calendar">
        <div className="staff-calendar-head" style={{ gridTemplateColumns: `56px repeat(${visibleStaff.length}, minmax(140px, 1fr))` }}><span>TIME</span>{visibleStaff.map((item) => <strong key={item.name}>• {item.name}</strong>)}</div>
        {Array.from({ length: 10 }, (_, index) => 8 + index).map((hour) => (
          <div className="staff-calendar-row" style={{ gridTemplateColumns: `56px repeat(${visibleStaff.length}, minmax(140px, 1fr))` }} key={hour}>
            <span>{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</span>
            {visibleStaff.map((item) => {
              const cellEvents = visibleEvents.filter((entry) => entry.staff === item.name && entry.start === hour);
              return <div className="staff-calendar-cell" key={item.name}>{cellEvents.map((event, eventIndex) => <button className={`staff-event ${event.color}`} key={`${event.text}-${event.service}-${eventIndex}`} onClick={() => window.alert(`${event.text} · ${event.start}:00-${event.end}:00 · ${event.service}`)}><b>{event.start}:00–{event.end}:00</b><strong>{event.text}</strong><small>{event.service} · Treatment</small></button>)}</div>;
            })}
          </div>
        ))}
      </div>
    </Page>
  );
}

const appointmentStatuses = ['Confirmed', 'Arrived', 'In Service', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'];

function AppointmentPage() {
  useClinicStoreVersion();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(readAppointments);
  const [date, setDate] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState('all');
  const filtered = appointments.filter((item) => (!date || item.date === date) && item.patient.toLowerCase().includes(patientQuery.trim().toLowerCase()) && (branch === 'all' || item.branch === branch) && (status === 'all' || item.status === status));
  const cycleStatus = (id: string) => setAppointments((current) => { const next = current.map((item) => { if (item.id !== id) return item; const index = appointmentStatuses.indexOf(item.status); return { ...item, status: appointmentStatuses[(index + 1) % appointmentStatuses.length] }; }); writeAppointments(next); return next; });
  return <Page title="Appointments & Visits" subtitle="Manage bookings, check-ins and treatment progress" action="New Appointment">
    <div className="workflow-filters"><input className="appointment-search" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Search HN, patient name or phone..." aria-label="Search appointments" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="all">All Branches</option><option value="BKK">BKK</option><option value="SAL">SAL</option><option value="CNX">CNX</option></select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All Statuses</option>{appointmentStatuses.map((value) => <option key={value}>{value}</option>)}</select><span>{filtered.length} appointments</span></div>
    <div className="table-wrap generic"><table><thead><tr>{['Date & Time', 'Patient', 'Service', 'Physiotherapist', 'Branch', 'Status', 'Actions'].map((value) => <th key={value}>{value}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{item.date} {item.time}</td><td>{item.patient}</td><td>{item.service}</td><td>{item.physiotherapist}</td><td>{item.branch}</td><td><span className={`status status-${item.status.toLowerCase().replaceAll(' ', '-')}`}><i />{item.status}</span></td><td><button className="text-action" onClick={() => cycleStatus(item.id)}>Next status</button></td></tr>)}</tbody></table></div>
  </Page>;
}

function NewAppointmentForm() {
  const pendingHn = localStorage.getItem(pendingPatientKey) ?? rows.patients[0][0];
  const patients = readPatients();
  const pendingPatient = patients.find((item) => item[0] === pendingHn) ?? rows.patients[0];
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), time: '09:00', patient: pendingPatient[0] + ' ' + pendingPatient[1], service: rows.services[0][1], physiotherapist: 'สุพจน์ กายภาพเก่ง', branch: 'BKK', resource: 'Treatment Room 1' });
  const [error, setError] = useState('');
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = () => { const matched = patients.find((item) => `${item[0]} ${item[1]}` === form.patient || item[0] === form.patient); if (!matched) { setError('กรุณาเลือกคนไข้จากผลการค้นหา'); return; } const hasConflict = readAppointments().some((item) => item.date === form.date && item.time === form.time && item.physiotherapist === form.physiotherapist && !['Cancelled', 'No Show'].includes(item.status)); if (hasConflict) { setError('หมอคนนี้มีนัดในช่วงเวลานี้แล้ว กรุณาเลือกเวลาอื่น'); return; } const next = [...readAppointments(), { id: `APT-${Date.now()}`, ...form, patient: `${matched[0]} ${matched[1]}`, status: 'Confirmed' }]; writeAppointments(next); localStorage.removeItem(pendingPatientKey); location.hash = `${location.hash.slice(1).split('/')[0] || 'admin'}/appointments`; };
  return <Page title="New Appointment" subtitle="Schedule a new patient visit"><div className="form-stack"><FormCard title="Appointment Details"><div className="field-grid"><label>Search patient *<input list="appointment-patients" value={form.patient} onChange={(event) => update('patient', event.target.value)} placeholder="Type HN, name or phone..." /><datalist id="appointment-patients">{patients.map((item) => <option key={item[0]} value={`${item[0]} ${item[1]}`}>{item[2]}</option>)}</datalist><small className="field-hint">พิมพ์อย่างน้อยบางส่วนของ HN หรือชื่อเพื่อเลือกคนไข้</small></label><label>Date<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label><label>Time<input type="time" value={form.time} onChange={(event) => update('time', event.target.value)} /></label><label>Branch<select value={form.branch} onChange={(event) => update('branch', event.target.value)}><option value="BKK">BKK</option><option value="SAL">SAL</option><option value="CNX">CNX</option></select></label><label>Service<select value={form.service} onChange={(event) => update('service', event.target.value)}>{rows.services.map((item) => <option key={item[0]}>{item[1]}</option>)}</select></label><label>Physiotherapist<select value={form.physiotherapist} onChange={(event) => update('physiotherapist', event.target.value)}><option>สุพจน์ กายภาพเก่ง</option><option>วรรณิศา เคลื่อนไหวดี</option><option>อรรถพล ฟื้นฟูชีพ</option><option>ชนกานต์ ยืดเหยียดดี</option><option>ปกรณ์ กล้ามเนื้อเก่ง</option><option>อรอนงค์ กำลังดี</option></select></label><label>Room / Resource<select value={form.resource} onChange={(event) => update('resource', event.target.value)}><option>Treatment Room 1</option><option>Treatment Room 2</option><option>Exercise Area</option><option>Running Lab</option></select></label></div></FormCard>{error && <div className="form-error">{error}</div>}<div className="form-actions"><button onClick={() => (location.hash = `${location.hash.slice(1).split('/')[0] || 'admin'}/appointments`)}>Cancel</button><button className="primary" onClick={submit}>Create Appointment</button></div></div></Page>;
}

function CourseTransferPage() {
  const [courses, setCourses] = useState<PatientCourse[]>(readPatientCourses);
  const patients = readPatients();
  const [history, setHistory] = useState<TransferRecord[]>(readTransferHistory);
  const [fromInput, setFromInput] = useState(`${courses[0]?.patientHn ?? patients[0][0]} ${courses[0]?.patientName ?? patients[0][1]}`);
  const [toInput, setToInput] = useState(`${patients[1]?.[0] ?? patients[0][0]} ${patients[1]?.[1] ?? patients[0][1]}`);
  const [course, setCourse] = useState(courses[0]?.course ?? rows.courses[0][1]);
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState('');
  const resolvePatient = (input: string) => patients.find((item) => `${item[0]} ${item[1]}` === input || item[0] === input);
  const sourcePatient = resolvePatient(fromInput);
  const recipientPatient = resolvePatient(toInput);
  const sourceCourses = sourcePatient ? courses.filter((item) => item.patientHn === sourcePatient[0]) : [];
  const sourceCourse = sourceCourses.find((item) => item.course === course);
  const available = sourceCourse ? sourceCourse.purchased + sourceCourse.bonus - sourceCourse.used : 0;
  const submit = () => {
    if (!sourcePatient || !recipientPatient || !sourceCourse || sourcePatient[0] === recipientPatient[0] || amount < 1 || amount > available) { setMessage('ตรวจสอบผู้โอน ผู้รับ คอร์ส และจำนวนสิทธิ์คงเหลืออีกครั้ง'); return; }
    const next = courses.map((item) => item.id === sourceCourse.id ? { ...item, used: item.used + amount } : item);
    next.unshift({ id: `PC-${Date.now()}`, patientHn: recipientPatient[0], patientName: recipientPatient[1], branch: sourceCourse.branch, course: sourceCourse.course, purchased: amount, bonus: 0, used: 0, expiry: sourceCourse.expiry });
    const transfer: TransferRecord = { id: `TR-${Date.now()}`, from: sourcePatient[0], to: recipientPatient[0], course: sourceCourse.course, amount, date: new Date().toISOString() };
    setCourses(next); writePatientCourses(next); setHistory((current) => { const nextHistory = [transfer, ...current]; writeTransferHistory(nextHistory); return nextHistory; }); setMessage('โอนสิทธิ์สำเร็จและบันทึกประวัติแล้ว');
  };
  return <Page title="Course Transfer" subtitle="Transfer remaining course visits between patients"><div className="form-stack"><FormCard title="Transfer Details"><div className="field-grid"><label>From Patient *<input list="transfer-patients" value={fromInput} onChange={(event) => setFromInput(event.target.value)} placeholder="Search HN or patient name..." /></label><label>To Patient *<input list="transfer-patients" value={toInput} onChange={(event) => setToInput(event.target.value)} placeholder="Search HN or patient name..." /></label><datalist id="transfer-patients">{patients.map((item) => <option key={item[0]} value={`${item[0]} ${item[1]}`}>{item[2]}</option>)}</datalist><label>Course *<input list="transfer-courses" value={course} onChange={(event) => setCourse(event.target.value)} placeholder="Choose source course..." /><datalist id="transfer-courses">{sourceCourses.map((item) => <option key={item.id} value={item.course}>{Math.max(item.purchased + item.bonus - item.used, 0)} visits available</option>)}</datalist></label><label>Visits to Transfer *<input type="number" min="1" max={available} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><small className="field-hint">Available balance: {available} visits</small></label></div></FormCard>{message && <div className="form-success">{message}</div>}<div className="form-actions"><button onClick={() => { setMessage(''); setAmount(1); }}>Clear</button><button className="primary" onClick={submit}>Confirm Transfer</button></div><FormCard title="Transfer History"><div className="table-wrap generic"><table><thead><tr><th>Transfer ID</th><th>From</th><th>To</th><th>Course</th><th>Visits</th><th>Date</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.from}</td><td>{item.to}</td><td>{item.course}</td><td>{item.amount}</td><td>{new Date(item.date).toLocaleString('en-GB')}</td></tr>)}</tbody></table></div></FormCard></div></Page>;
}

function CheckoutPage() {
  useClinicStoreVersion();
  const readyVisits = readAppointments().filter((item) => item.status === 'Completed');
  const patients = readPatients();
  const [courseRecords, setCourseRecords] = useState<PatientCourse[]>(readPatientCourses);
  const [mode, setMode] = useState<'walk-in' | 'course' | 'course-use'>('walk-in');
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedVisit, setSelectedVisit] = useState('');
  const [patient, setPatient] = useState('');
  const [item, setItem] = useState(rows.services[0][1]);
  const [amount, setAmount] = useState(900);
  const [method, setMethod] = useState('Cash');
  const [usePurchasedToday, setUsePurchasedToday] = useState(false);
  const [message, setMessage] = useState('');
  const selectedPatientHn = patient.split(' ')[0];
  const patientMatches = patientQuery.trim() ? patients.filter((value) => value.join(' ').toLowerCase().includes(patientQuery.trim().toLowerCase())).slice(0, 6) : [];
  const usableCourses = courseRecords.filter((value) => value.patientHn === selectedPatientHn && value.purchased + value.bonus - value.used > 0 && new Date(`${value.expiry}T23:59:59`) >= new Date());
  const selectPatient = (value: PatientRow, visitId = '') => { setPatient(`${value[0]} ${value[1]}`); setSelectedVisit(visitId); setPatientQuery(''); setMessage(''); };
  const submit = () => {
    if (!patient.trim()) { setMessage('กรุณาเลือกผู้ป่วยก่อนดำเนินการต่อ'); return; }
    if (!patients.some((value) => `${value[0]} ${value[1]}` === patient || value[0] === patient)) { setMessage('กรุณาเลือกผู้ป่วยจากรายการแนะนำ'); return; }
    if (mode === 'course-use') {
      const selectedCourse = usableCourses.find((value) => value.course === item);
      if (!selectedCourse) { setMessage('กรุณาเลือก Active Course ที่ยังมีสิทธิ์คงเหลือ'); return; }
      const updatedCourses = courseRecords.map((value) => value.id === selectedCourse.id ? { ...value, used: value.used + 1 } : value);
      setCourseRecords(updatedCourses); writePatientCourses(updatedCourses);
      const next = [{ id: `TX-${Date.now()}`, date: new Date().toLocaleDateString('en-GB'), patient, item: `Course Usage · ${item}`, amount: 0, method: 'Course Balance', status: 'Paid' as const }, ...readTransactions()];
      writeTransactions(next); setMessage(`ตัดคอร์สสำเร็จ เหลือ ${selectedCourse.purchased + selectedCourse.bonus - selectedCourse.used - 1} ครั้ง`); return;
    }
    if (mode === 'course') {
      const selectedCourse = rows.courses.find((value) => value[1] === item);
      if (!selectedCourse) { setMessage('กรุณาเลือกคอร์สจากรายการ'); return; }
      const purchased = Number.parseInt(selectedCourse[2], 10);
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      const courseRecord: PatientCourse = {
        id: `PC-${Date.now()}`,
        patientHn: selectedPatientHn,
        patientName: patient.replace(`${selectedPatientHn} `, ''),
        branch: selectedVisit ? (readyVisits.find((visit) => visit.id === selectedVisit)?.branch ?? 'BKK') : 'BKK',
        course: item,
        purchased: Number.isFinite(purchased) ? purchased : 1,
        bonus: 0,
        used: usePurchasedToday ? 1 : 0,
        expiry: expiry.toISOString().slice(0, 10),
      };
      const updatedCourses = [courseRecord, ...courseRecords];
      setCourseRecords(updatedCourses);
      writePatientCourses(updatedCourses);
    }
    const next = [{ id: `TX-${Date.now()}`, date: new Date().toLocaleDateString('en-GB'), patient, item: mode === 'course' && usePurchasedToday ? `${item} · 1 visit used today` : item, amount, method, status: 'Paid' as const }, ...readTransactions()]; writeTransactions(next); setMessage(mode === 'course' ? `ซื้อคอร์สสำเร็จ${usePurchasedToday ? ' และตัดสิทธิ์ใช้วันนี้ 1 ครั้ง' : ''}` : 'บันทึกการชำระเงินแล้ว');
  };

  if (!patient) return <Page title="Checkout" subtitle="Bill services, courses and record payment"><div className="checkout-layout checkout-select-layout"><FormCard title="Select Patient"><div className="checkout-search"><span>⌕</span><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Search HN, name or phone..." autoFocus /></div>{patientMatches.length > 0 && <div className="patient-match-list">{patientMatches.map((value) => <button key={value[0]} onClick={() => selectPatient(value)}><span><b>{value[1]}</b><small>{value[2]}</small></span><em>{value[0]}</em></button>)}</div>} {!patientQuery && <div className="checkout-ready"><strong><span>◷</span> READY FOR CHECKOUT TODAY</strong>{readyVisits.length ? readyVisits.map((visit) => { const visitPatient = patients.find((value) => value[0] === visit.patient.split(' ')[0]); return <button className="checkout-visit" key={visit.id} onClick={() => visitPatient && selectPatient(visitPatient, visit.id)}><span><b>{visit.patient}</b><small>{visit.service} · {visit.time}</small></span><em>Completed</em></button>; }) : <div className="checkout-empty">No completed visits waiting for checkout yet.</div>}</div>}</FormCard><FormCard title="How Checkout Works"><ol className="checkout-steps"><li><i>1</i><span><b>Select Patient</b><small>Search or pick from today's completed visits</small></span></li><li><i>2</i><span><b>Choose Service or Course</b><small>Single visit, existing course, or new package</small></span></li><li><i>3</i><span><b>Confirm Payment</b><small>Record the payment method to finish</small></span></li></ol></FormCard></div></Page>;

  return (
    <Page title="Checkout" subtitle="Bill services, courses and record payment">
      <div className="checkout-layout">
        <div className="checkout-workflow"><div className="checkout-patient-summary"><span><b>{patient.replace(`${selectedPatientHn} `, '')}</b><small>{selectedPatientHn}{selectedVisit ? ' · Linked completed visit' : ''}</small></span><button onClick={() => { setPatient(''); setSelectedVisit(''); setMessage(''); }}>Change</button></div><div className="checkout-mode"><button className={mode === 'walk-in' ? 'active' : ''} onClick={() => { setMode('walk-in'); setItem(rows.services[0][1]); setAmount(Number(rows.services[0][3].replace(/[^0-9]/g, '')) || 0); }}>Assessment / Single Visit</button><button className={mode !== 'walk-in' ? 'active' : ''} onClick={() => { setMode('course-use'); setItem(usableCourses[0]?.course ?? ''); setAmount(0); }}>Course / Package</button></div>{mode === 'walk-in' ? <FormCard title="Select Service"><div className="checkout-choice-grid">{rows.services.map((value) => <button className={item === value[1] ? 'selected' : ''} key={value[0]} onClick={() => { setItem(value[1]); setAmount(Number(value[3].replace(/[^0-9]/g, '')) || 0); }}><b>{value[1]}</b><small>{value[2]}</small><strong>{value[3]}</strong></button>)}</div></FormCard> : <><div className="checkout-submode"><button className={mode === 'course-use' ? 'active' : ''} onClick={() => { setMode('course-use'); setItem(usableCourses[0]?.course ?? ''); }}>Use Existing Course</button><button className={mode === 'course' ? 'active' : ''} onClick={() => { setMode('course'); setItem(rows.courses[0][1]); setAmount(Number(rows.courses[0][3].replace(/[^0-9]/g, '')) || 0); }}>Purchase New Course</button></div><FormCard title={mode === 'course-use' ? 'Use Course Balance' : 'Select Course Package'}>{mode === 'course-use' ? <div className="checkout-choice-grid">{usableCourses.length ? usableCourses.map((value) => <button className={item === value.course ? 'selected' : ''} key={value.id} onClick={() => setItem(value.course)}><b>{value.course}</b><small>Expires {value.expiry}</small><strong>{value.purchased + value.bonus - value.used} visits left</strong></button>) : <div className="checkout-empty">No active course balance for this patient.</div>}</div> : <><div className="checkout-choice-grid">{rows.courses.map((value) => <button className={item === value[1] ? 'selected' : ''} key={value[0]} onClick={() => { setItem(value[1]); setAmount(Number(value[3].replace(/[^0-9]/g, '')) || 0); }}><b>{value[1]}</b><small>{value[2]}</small><strong>{value[3]}</strong></button>)}</div><label className="checkout-checkbox"><input type="checkbox" checked={usePurchasedToday} onChange={(event) => setUsePurchasedToday(event.target.checked)} /> Use one session from this newly purchased course today</label></>}</FormCard></>}</div>
        <FormCard title="How Checkout Works">
          <div className="checkout-payment"><span><b>{mode === 'course-use' ? 'Course Usage' : item}</b><small>{mode === 'course-use' ? 'No payment required' : 'Choose payment method'}</small></span>{mode !== 'course-use' && <select value={method} onChange={(event) => setMethod(event.target.value)}>{rows.payments.map((value) => <option key={value[0]}>{value[1]}</option>)}</select>}</div>{message && <div className="form-success">{message}</div>}<button className="primary checkout-confirm" onClick={submit}>{mode === 'course-use' ? 'Confirm Course Usage' : 'Confirm Payment'}</button>
        </FormCard>
      </div>
    </Page>
  );
}

function TransactionsPage() {
  useClinicStoreVersion();
  const [transactions, setTransactions] = useState<TransactionRecord[]>(readTransactions);
  const [audit, setAudit] = useState('');
  const voidTransaction = (id: string) => { const reason = window.prompt('Reason for void'); if (!reason?.trim()) return; const next = transactions.map((item) => item.id === id ? { ...item, status: 'Voided' as const, voidReason: reason } : item); setTransactions(next); writeTransactions(next); setAudit(`${id} voided: ${reason}`); };
  return <Page title="Transactions" subtitle="Review sales, payments and audit history"><div className="table-wrap generic"><table><thead><tr>{['Transaction', 'Date', 'Patient', 'Item', 'Amount', 'Method', 'Status', 'Actions'].map((value) => <th key={value}>{value}</th>)}</tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.date}</td><td>{item.patient}</td><td>{item.item}</td><td>฿{item.amount.toLocaleString()}</td><td>{item.method}</td><td><span className={`status ${item.status === 'Paid' ? 'on' : 'off'}`}><i />{item.status}</span></td><td>{item.status === 'Paid' ? <button className="text-action" onClick={() => voidTransaction(item.id)}>Void</button> : <small>{item.voidReason}</small>}</td></tr>)}</tbody></table></div>{audit && <div className="form-success">Audit history: {audit}</div>}</Page>;
}

function StaffAccessPage() {
  const [tab, setTab] = useState<'staff' | 'permissions'>('staff');
  const [staff, setStaff] = useState(() => configs.staff[3].map((row) => ({ name: row[1], position: row[2], branch: row[3], active: row[4] === 'Active', role: row[2] === 'System Admin' ? 'ADMIN (Owner)' : 'PHYSIO' })));
  return <Page title="Staff & Access" subtitle="Manage staff, roles and branch permissions"><div className="settings-tabs"><button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>Staff</button><button className={tab === 'permissions' ? 'active' : ''} onClick={() => setTab('permissions')}>Roles & Permissions</button></div>{tab === 'staff' ? <div className="table-wrap generic"><table><thead><tr>{['Name', 'Role', 'Branch Access', 'Status', 'Actions'].map((value) => <th key={value}>{value}</th>)}</tr></thead><tbody>{staff.map((item, index) => <tr key={item.name}><td>{item.name}</td><td><select value={item.role} onChange={(event) => setStaff((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, role: event.target.value } : row))}><option>PHYSIO</option><option>ADMIN (Owner)</option></select></td><td>{item.branch}</td><td><span className={`status ${item.active ? 'on' : 'off'}`}><i />{item.active ? 'Active' : 'Inactive'}</span></td><td><button className="text-action" onClick={() => setStaff((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, active: !row.active } : row))}>{item.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div> : <div className="permission-grid">{['Calendar & Visits', 'Patients', 'Patient Courses', 'Checkout & Transactions', 'Reports', 'Administration'].map((permission) => <div className="permission-card" key={permission}><strong>{permission}</strong><label><input type="checkbox" defaultChecked /> PHYSIO</label><label><input type="checkbox" defaultChecked /> ADMIN (Owner)</label></div>)}</div>}</Page>;
}

function NewPatientForm() {
  const [form, setForm] = useState({
    patientType: 'Thai',
    title: '',
    firstName: '',
    lastName: '',
    nickname: '',
    phone: '',
    gender: '',
    nationalId: '',
    passport: '',
    birthDate: '',
    bloodGroup: '',
    nationality: '',
    address: '',
    branch: 'BKK',
    group: 'General Patient',
    referral: '',
    insuranceType: '',
    insuranceCompany: '',
    note: '',
  });
  const [error, setError] = useState('');
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const registrationDate = new Date();
  const hnPrefix = `${String(registrationDate.getFullYear()).slice(-2)}${branchHnCodes[form.branch]}${String(registrationDate.getMonth() + 1).padStart(2, '0')}`;
  const nextHn = `${hnPrefix}${String(readPatients().filter((patient) => patient[0].startsWith(hnPrefix)).length + 1).padStart(4, '0')}`;
  const submit = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.gender) {
      setError('กรุณากรอกชื่อ นามสกุล เบอร์โทรศัพท์ และเพศให้ครบ');
      return;
    }
    const patient: PatientRow = [nextHn, `${form.firstName.trim()} ${form.lastName.trim()}`, form.phone.trim(), form.group, '—'];
    writePatients([patient, ...readPatients()]);
    const details = JSON.parse(localStorage.getItem(patientDetailsStorageKey) ?? '{}');
    details[nextHn] = form;
    writeClinicValue(patientDetailsStorageKey, details);
    location.hash = `${location.hash.slice(1).split('/')[0] || 'admin'}/patients`;
  };
  return (
    <Page title="New Patient" subtitle="Create a patient profile and contact record">
      <div className="form-stack">
        <FormCard title="Personal Information">
          <div className="field-grid">
            <label>HN (Auto-generated)<input value={nextHn} readOnly /><small className="field-hint">Format: YY + BB + MM + NNNN</small></label>
            <label>Patient Type<select value={form.patientType} onChange={(event) => update('patientType', event.target.value)}><option>Thai</option><option>Foreigner</option></select></label>
            <label>Gender<select value={form.gender} onChange={(event) => update('gender', event.target.value)}><option value="">Select gender *</option><option>Male</option><option>Female</option><option>Other</option></select></label>
            <label>Title <span className="optional">(optional)</span><select value={form.title} onChange={(event) => update('title', event.target.value)}><option value="">Select title</option><option>ด.ช.</option><option>ด.ญ.</option><option>นาย</option><option>นาง</option><option>นางสาว</option></select></label>
            <label>First Name *<input value={form.firstName} onChange={(event) => update('firstName', event.target.value)} placeholder="First name" /></label>
            <label>Last Name *<input value={form.lastName} onChange={(event) => update('lastName', event.target.value)} placeholder="Last name" /></label>
            <label>Nickname <span className="optional">(optional)</span><input value={form.nickname} onChange={(event) => update('nickname', event.target.value)} placeholder="Nickname" /></label>
            <label>Phone *<input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="08x-xxx-xxxx" /></label>
            <label>National ID <span className="optional">(optional)</span><input value={form.nationalId} onChange={(event) => update('nationalId', event.target.value)} placeholder="เลขบัตรประชาชน" /></label>
            <label>Passport No. <span className="optional">(optional)</span><input value={form.passport} onChange={(event) => update('passport', event.target.value)} placeholder="Passport number" /></label>
            <label>Date of Birth <span className="optional">(optional)</span><input type="date" value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></label>
            <label>Blood Group <span className="optional">(optional)</span><select value={form.bloodGroup} onChange={(event) => update('bloodGroup', event.target.value)}><option value="">Select blood group</option><option>A</option><option>B</option><option>AB</option><option>O</option></select></label>
            <label>Nationality <span className="optional">(optional)</span><input value={form.nationality} onChange={(event) => update('nationality', event.target.value)} placeholder="Nationality" /></label>
          </div>
        </FormCard>
        <FormCard title="Contact & Clinic Information">
          <div className="field-grid">
            <label className="wide">Address <span className="optional">(optional)</span><textarea value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Address" /></label>
            <label>Branch<select value={form.branch} onChange={(event) => update('branch', event.target.value)}><option value="BKK">สาขาสุขุมวิท (BKK)</option><option value="SAL">สาขาศาลายา (SAL)</option><option value="CNX">สาขาเชียงใหม่ (CNX)</option></select></label>
            <label>Customer Group<select value={form.group} onChange={(event) => update('group', event.target.value)}><option>General Patient</option><option>Walk-in</option><option>Member</option><option>VIP</option><option>Corporate</option></select></label>
            <label>Referral Channel<select value={form.referral} onChange={(event) => update('referral', event.target.value)}><option value="">Select option</option><option>Walk-in</option><option>Facebook</option><option>Friend referral</option></select></label>
            <label>Insurance Type <span className="optional">(optional)</span><select value={form.insuranceType} onChange={(event) => update('insuranceType', event.target.value)}><option value="">Select insurance type</option><option>None</option><option>Private Insurance</option><option>Company Benefit</option><option>Social Security</option></select></label>
            <label>Insurance Company <span className="optional">(optional)</span><input value={form.insuranceCompany} onChange={(event) => update('insuranceCompany', event.target.value)} placeholder="Insurance company" /></label>
            <label className="wide">Note<textarea value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Optional note" /></label>
          </div>
        </FormCard>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions"><button onClick={() => (location.hash = `${location.hash.slice(1).split('/')[0] || 'admin'}/patients`)}>Cancel</button><button className="primary" onClick={submit}>Create Patient</button></div>
      </div>
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
  if (!appointment && !profile) return <NewPatientForm />;
  if (appointment) return <NewAppointmentForm />;
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
export function PageRouter({ path, role }: { path: string; role?: 'admin' | 'physio' }) {
  if (path === 'calendar') return role === 'admin' ? <AdminCalendarPage /> : <CalendarPage />;
  if (path === 'branches') return <BranchesPage />;
  if (path === 'appointments') return <AppointmentPage />;
  if (path === 'course-transfer') return <CourseTransferPage />;
  if (path === 'checkout') return <CheckoutPage />;
  if (path === 'transactions') return <TransactionsPage />;
  if (path === 'staff') return <StaffAccessPage />;
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
  if (path === 'patients') return <PatientListPage />;
  if (path === 'new-patient') return <NewForm />;
  if (path === 'new-appointment') return <NewForm appointment />;
  if (path === 'profile') return <NewForm profile />;
  if (path === 'patient-courses') return <PatientCoursesPage />;
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
