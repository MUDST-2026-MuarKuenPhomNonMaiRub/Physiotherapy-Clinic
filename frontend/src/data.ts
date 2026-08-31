export const rows = {
  users: [
    ['admin', 'พิริยะ ทาระธรรม', 'System Admin', 'BKK, SAL, CNX', 'Active', '12 Aug 2026 23:28'],
    ['frontdesk', 'นภัสสร ต้อนรับดี', 'Front Desk', 'BKK, SAL', 'Active', '12 Aug 2026 08:45'],
    ['physio', 'สุพจน์ กายภาพเก่ง', 'Physiotherapist', 'BKK', 'Active', '12 Aug 2026 23:17'],
  ],
  staff: [
    ['PT001', 'อรรถพล ฟื้นฟูชีพ', 'BKK', 'Musculoskeletal', 'Active'],
    ['PT002', 'สุพจน์ กายภาพเก่ง', 'SAL', 'Neurological', 'Active'],
  ],
  services: [
    ['SV001', 'Office Syndrome Treatment', '60 min', '฿1,200', 'Active'],
    ['SV002', 'Sports Rehabilitation', '90 min', '฿1,800', 'Active'],
  ],
  courses: [
    ['CRS001', 'Office Syndrome Package', '5 visits', '฿5,500', 'Active'],
    ['CRS002', 'Post-op Recovery', '10 visits', '฿14,000', 'Active'],
  ],
  payments: [
    ['PM01', 'Cash', 'In-store payment', 'Active'],
    ['PM02', 'Bank Transfer', 'Manual verification', 'Active'],
    ['PM03', 'Credit Card', 'Payment gateway', 'Active'],
  ],
  rooms: [
    ['R101', 'Treatment Room 1', 'BKK', 'Treatment room', 'Available'],
    ['R102', 'Exercise Studio', 'BKK', 'Shared resource', 'Available'],
  ],
  rules: [
    ['Standard PT', 'Physiotherapist', 'Service', '10%', 'Active'],
    ['Course Sale', 'Sales staff', 'Course', '5%', 'Active'],
  ],
  groups: [
    ['CG01', 'General Patient', '0%', 'Active'],
    ['CG02', 'Corporate', '10%', 'Active'],
  ],
  transactions: [
    ['TX-20260812-001', '12 Aug 2026', 'HN000145', 'Office Syndrome', '฿1,200', 'Paid'],
    ['TX-20260812-002', '12 Aug 2026', 'HN000203', 'Course Package', '฿5,500', 'Paid'],
  ],
  appointments: [
    [
      '14 Aug 2026 10:00',
      'HN000145 สรวิชญ์ ใจยินดี',
      'Office Syndrome',
      'อรรถพล ฟื้นฟูชีพ',
      'Completed',
    ],
    [
      '14 Aug 2026 11:00',
      'HN000203 วิภา สุขใจ',
      'Sports Rehabilitation',
      'สุพจน์ กายภาพเก่ง',
      'Waiting',
    ],
  ],
  patients: [
    ['HN000145', 'สรวิชญ์ ใจยินดี', '081-234-5678', 'General Patient', '12 Aug 2026'],
    ['HN000203', 'วิภา สุขใจ', '089-555-0142', 'Corporate', '11 Aug 2026'],
  ],
};

export type PatientDirectoryRecord = {
  hn: string;
  name: string;
  nameEn: string;
  nickname: string;
  idCard: string;
  gender: string;
  phone: string;
  customerGroup: string;
  branch: string;
  activeCourses: number;
  latestVisit: string;
  dateCreated: string;
};

export const branchHnCodes: Record<string, string> = { BKK: '01', SAL: '02', CNX: '03' };

const patientDirectorySeed: [string, string, string, string, string, string, string, string, string, number, string][] = [
  ['2602070007', 'นางอรุณี กำหนดหัน', 'Arunee Kaona', 'อรุณี', '1101700000001', 'Female', '086-372-1496', 'Walk-in', 'SAL', 0, '01 Jul 2026'],
  ['2601070005', 'นายสุรชัย ธรรมชาติ', 'Surachai Thammachat', 'ชัย', '1101700000002', 'Male', '089-253-1279', 'Member', 'BKK', 0, '01 Jul 2026'],
  ['2601060007', 'นายศักดิ์ชัย ทวีสิน', 'Sakchai Thaweesin', 'ศักดิ์', '1101700000003', 'Male', '085-355-1465', 'Corporate', 'BKK', 0, '30 Jun 2026'],
  ['2602060009', 'นางปิยมณฑ์ สุขเจริญ', 'Piyamun Sukkhaoren', 'ปิยมณฑ์', '1101700000004', 'Female', '082-474-1682', 'VIP', 'SAL', 0, '30 Jun 2026'],
  ['2602050011', 'นางวรรณภา เจริญสุข', 'Waraporn Charoensuk', 'วรรณ', '1101700000005', 'Female', '088-576-1868', 'Walk-in', 'SAL', 0, '29 Jun 2026'],
  ['2602050004', 'นายประเสริฐ รุ่งเรือง', 'Prasert Rungruang', 'เสริฐ', '1101700000006', 'Male', '087-219-1217', 'Corporate', 'SAL', 1, '29 Jun 2026'],
  ['2601050009', 'นายกิตติศักดิ์ ไพบูลย์', 'Kittisak Paiboon', 'กิตติ์', '1101700000007', 'Male', '081-457-1651', 'Member', 'BKK', 0, '28 Jun 2026'],
  ['2602040006', 'นายชูเกียรติ อยู่ดี', 'Chukiat Yoodee', 'ชู', '1101700000008', 'Male', '083-321-1403', 'Member', 'SAL', 0, '28 Jun 2026'],
  ['2601040011', 'นายชัยวัฒน์ รักษ์สุขภาพ', 'Chaiwat Raksukkhaphap', 'วัฒน์', '1101700000009', 'Male', '087-559-1837', 'Corporate', 'BKK', 0, '27 Jun 2026'],
  ['2601040004', 'นางกัลยา ทองสุข', 'Kanlaya Thongsuk', 'กัลยา', '1101700000010', 'Female', '086-202-1186', 'VIP', 'BKK', 1, '27 Jun 2026'],
];

export const patientDirectory: PatientDirectoryRecord[] = patientDirectorySeed.map(([hn, name, nameEn, nickname, idCard, gender, phone, customerGroup, branch, activeCourses, dateCreated]) => ({
  hn, name, nameEn, nickname, idCard, gender, phone, customerGroup, branch, activeCourses, latestVisit: '—', dateCreated,
}));
