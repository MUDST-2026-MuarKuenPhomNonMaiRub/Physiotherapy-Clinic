import { useEffect, useState } from 'react';
import { branchApi } from '../../services/api';
import type { Branch } from '../../types';
import plus from '../../assets/icons/plus.svg';
import edit from '../../assets/icons/edit.svg';

const fallback: Branch[] = [
  {
    id: 1,
    code: 'BKK',
    name: 'สาขาสุขุมวิท (Sukhumvit)',
    phone: '02-105-4421',
    address: '123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
    active: true,
  },
  {
    id: 2,
    code: 'SAL',
    name: 'สาขาศาลายา (Salaya)',
    phone: '02-441-0987',
    address: '99 ถนนศาลายา-นครชัยศรี อ.พุทธมณฑล จ.นครปฐม 73170',
    active: true,
  },
  {
    id: 3,
    code: 'CNX',
    name: 'สาขาเชียงใหม่ (Chiang Mai)',
    phone: '053-224-556',
    address: '45 ถนนนิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
    active: true,
  },
];

export function BranchesPage() {
  const [branches, setBranches] = useState(fallback);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    branchApi
      .list()
      .then(setBranches)
      .catch(() => setOffline(true));
  }, []);
  const toggle = async (branch: Branch) => {
    const active = !branch.active;
    setBranches((v) => v.map((b) => (b.id === branch.id ? { ...b, active } : b)));
    try {
      await branchApi.toggle(branch.id, active);
    } catch {
      setOffline(true);
    }
  };
  return (
    <section className="content">
      <div className="title-row">
        <div>
          <h1>Branches</h1>
          <p>Manage clinic branch locations used across HN generation, scheduling and reporting</p>
        </div>
        <button className="primary">
          <img src={plus} alt="" />
          Create Branch
        </button>
      </div>
      {offline && (
        <div className="offline">
          Preview mode — start the Spring Boot API to enable persistent changes.
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Branch Code</th>
              <th>Branch Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>{b.code}</td>
                <td className="strong">{b.name}</td>
                <td>{b.phone}</td>
                <td>{b.address}</td>
                <td>
                  <span className={`status ${b.active ? 'on' : 'off'}`}>
                    <i />
                    {b.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <button aria-label={`Edit ${b.name}`}>
                      <img src={edit} alt="" />
                    </button>
                    <button
                      className={`switch ${b.active ? 'on' : ''}`}
                      onClick={() => toggle(b)}
                      aria-label={`Toggle ${b.name}`}
                    >
                      <span />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="scrollbar">
          <i />
        </div>
      </div>
    </section>
  );
}
