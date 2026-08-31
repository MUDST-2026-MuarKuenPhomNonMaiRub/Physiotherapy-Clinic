import { useEffect, useState } from 'react';

const clinicStoreEvent = 'physiocare-store-change';

export function writeClinicValue<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(clinicStoreEvent));
}

export function useClinicStoreVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion((value) => value + 1);
    window.addEventListener(clinicStoreEvent, update);
    return () => window.removeEventListener(clinicStoreEvent, update);
  }, []);
  return version;
}
