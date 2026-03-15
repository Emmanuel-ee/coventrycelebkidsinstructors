import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import './App.css';
import { isSupabaseEnabled, supabase } from './lib/supabaseClient';

const STORAGE_KEY = 'celebkids-records-v1';
const EMPTY_RECORDS = { teachers: [], children: [] };

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const loadLocalRecords = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return EMPTY_RECORDS;
    }
    const parsed = JSON.parse(stored);
    return {
      teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
      children: Array.isArray(parsed.children) ? parsed.children : [],
    };
  } catch (error) {
    return EMPTY_RECORDS;
  }
};

const mapTeacherFromDb = (teacher) => ({
  id: teacher.id,
  name: teacher.name || '',
  email: teacher.email || '',
  phone: teacher.phone || '',
  role: teacher.role || 'Lead Teacher',
  createdAt: teacher.created_at || teacher.createdAt || new Date().toISOString(),
});

const mapChildFromDb = (child) => ({
  id: child.id,
  name: child.name || '',
  age: child.age || '',
  dateOfBirth: child.date_of_birth || child.dateOfBirth || '',
  sex: child.sex || child.gender || '',
  guardianName: child.guardian_name || child.guardianName || child.guardian || '',
  guardianContact: child.guardian_contact || child.guardianContact || '',
  allergies: child.allergies || '',
  classCategory: child.class_category || child.classCategory || '',
  teacherId: child.teacher_id || child.teacherId || '',
  lastStatus: child.last_status || child.lastStatus || '',
  lastActionAt: child.last_action_at || child.lastActionAt || '',
  signedIn: typeof child.signed_in === 'boolean' ? child.signed_in : child.signedIn || false,
  signedInUserId: child.signed_in_user_id || child.signedInUserId || '',
  allowPhotos:
    typeof child.allow_photos === 'boolean'
      ? child.allow_photos
      : child.allowPhotos || false,
  qrCode: child.qr_code || child.qrCode || '',
  notes: child.notes || '',
  createdAt: child.created_at || child.createdAt || new Date().toISOString(),
});

const mapTeacherToDb = (teacher) => ({
  id: teacher.id,
  name: teacher.name,
  email: teacher.email || null,
  phone: teacher.phone || null,
  role: teacher.role,
  created_at: teacher.createdAt,
});

function App() {
  const [records, setRecords] = React.useState(() =>
    isSupabaseEnabled ? EMPTY_RECORDS : loadLocalRecords()
  );
  const [isLoading, setIsLoading] = React.useState(isSupabaseEnabled);
  const [error, setError] = React.useState('');
  const [supabaseStatus, setSupabaseStatus] = React.useState('');
  const [view, setView] = React.useState('list');
  const [selectedChild, setSelectedChild] = React.useState(null);
  const [isUpdatingChildStatus, setIsUpdatingChildStatus] = React.useState(false);
  const [teacherForm, setTeacherForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    role: 'Lead Teacher',
  });
  const [teacherSearch, setTeacherSearch] = React.useState('');
  const [childSearch, setChildSearch] = React.useState('');

  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records]);

  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      return undefined;
    }

    let isActive = true;

    const fetchRecords = async () => {
      setIsLoading(true);
      setError('');
      setSupabaseStatus('');
      const [teachersResponse, childrenResponse] = await Promise.all([
        supabase.from('teachers').select('*').order('created_at', { ascending: false }),
        supabase.from('children').select('*').order('created_at', { ascending: false }),
      ]);

      if (!isActive) {
        return;
      }

      if (teachersResponse.error || childrenResponse.error) {
        const message = teachersResponse.error?.message || childrenResponse.error?.message;
        setError(`Unable to load records from Supabase. ${message || 'Check your connection.'}`);
        setIsLoading(false);
        return;
      }

      setRecords({
        teachers: (teachersResponse.data || []).map(mapTeacherFromDb),
        children: (childrenResponse.data || []).map(mapChildFromDb),
      });
      setSupabaseStatus('Records synced from Supabase.');
      setIsLoading(false);
    };

    fetchRecords();

    return () => {
      isActive = false;
    };
  }, []);

  const handleTeacherChange = (event) => {
    const { name, value } = event.target;
    setTeacherForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChild = (child) => {
    setSelectedChild(child);
    setView('child');
  };

  const handleBackToList = () => {
    setSelectedChild(null);
    setView('list');
  };

  const handleChildCheckin = async (action) => {
    if (!selectedChild) {
      return;
    }
    setError('');
    setSupabaseStatus('');
    setIsUpdatingChildStatus(true);
    const actionTimestamp = new Date().toISOString();
    const updatedChild = {
      ...selectedChild,
      lastStatus: action,
      lastActionAt: actionTimestamp,
      signedIn: action === 'sign_in',
      signedInUserId: action === 'sign_in' ? selectedChild.signedInUserId || '' : '',
    };

    if (isSupabaseEnabled) {
      const { error: checkinError } = await supabase
        .from('checkins')
        .insert([
          {
            id: createId(),
            child_id: selectedChild.id,
            action,
            created_at: actionTimestamp,
          },
        ]);
      if (checkinError) {
        setError(`Unable to ${action === 'sign_in' ? 'sign in' : 'sign out'}. ${checkinError.message}`);
        setIsUpdatingChildStatus(false);
        return;
      }
      const { error: statusError } = await supabase
        .from('children')
        .update({
          last_status: action,
          last_action_at: actionTimestamp,
          signed_in: action === 'sign_in',
          signed_in_user_id: action === 'sign_in' ? selectedChild.signedInUserId || null : null,
        })
        .eq('id', selectedChild.id);
      if (statusError) {
        setError(
          `Signed ${action === 'sign_in' ? 'in' : 'out'}, but status update failed. ${statusError.message}`
        );
        setIsUpdatingChildStatus(false);
        return;
      }
      setSupabaseStatus(
        `${selectedChild.name} ${action === 'sign_in' ? 'signed in' : 'signed out'} successfully.`
      );
    }

    setRecords((prev) => ({
      ...prev,
      children: prev.children.map((child) =>
        child.id === selectedChild.id ? updatedChild : child
      ),
    }));
    setSelectedChild(updatedChild);
    setIsUpdatingChildStatus(false);
  };


  const handleAddTeacher = async (event) => {
    event.preventDefault();
    if (!teacherForm.name.trim()) {
      return;
    }
    const newTeacher = {
      id: createId(),
      name: teacherForm.name.trim(),
      email: teacherForm.email.trim(),
      phone: teacherForm.phone.trim(),
      role: teacherForm.role,
      createdAt: new Date().toISOString(),
    };
    if (isSupabaseEnabled) {
      setError('');
      setSupabaseStatus('');
      const { error: insertError } = await supabase
        .from('teachers')
        .insert([mapTeacherToDb(newTeacher)]);
      if (insertError) {
        setError(`Unable to save teacher. ${insertError.message}`);
        return;
      }
      setSupabaseStatus('Teacher saved to Supabase.');
    }

    setRecords((prev) => ({
      ...prev,
      teachers: [newTeacher, ...prev.teachers],
    }));
    setTeacherForm({ name: '', email: '', phone: '', role: 'Lead Teacher' });
    setView('list');
  };


  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm('Remove this teacher? Children assigned will become unassigned.')) {
      return;
    }
    if (isSupabaseEnabled) {
      setError('');
      setSupabaseStatus('');
      const { error: childUpdateError } = await supabase
        .from('children')
        .update({ teacher_id: null })
        .eq('teacher_id', teacherId);
      if (childUpdateError) {
        setError(`Unable to update children for this teacher. ${childUpdateError.message}`);
        return;
      }
      const { error: deleteError } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);
      if (deleteError) {
        setError(`Unable to remove teacher. ${deleteError.message}`);
        return;
      }
      setSupabaseStatus('Teacher removed from Supabase.');
    }
    setRecords((prev) => ({
      ...prev,
      teachers: prev.teachers.filter((teacher) => teacher.id !== teacherId),
      children: prev.children.map((child) =>
        child.teacherId === teacherId ? { ...child, teacherId: '' } : child
      ),
    }));
  };


  const filteredTeachers = records.teachers.filter((teacher) =>
    teacher.name.toLowerCase().includes(teacherSearch.toLowerCase())
  );
  const filteredChildren = records.children.filter((child) =>
    child.name.toLowerCase().includes(childSearch.toLowerCase())
  );

  const teacherLookup = records.teachers.reduce((acc, teacher) => {
    acc[teacher.id] = teacher.name;
    return acc;
  }, {});

  const qrCodeValue = selectedChild
    ? `${window.location.origin}${process.env.PUBLIC_URL || ''}/?scan=${selectedChild.qrCode || selectedChild.id}`
    : '';

  const registerInstructorForm = (
    <form className="form" onSubmit={handleAddTeacher}>
      <div className="form__grid">
        <label>
          Name*
          <input
            name="name"
            value={teacherForm.name}
            onChange={handleTeacherChange}
            placeholder="Instructor name"
            required
          />
        </label>
        <label>
          Role
          <select name="role" value={teacherForm.role} onChange={handleTeacherChange}>
            <option>Lead Teacher</option>
            <option>Assistant</option>
            <option>Support</option>
            <option>Volunteer</option>
          </select>
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            value={teacherForm.email}
            onChange={handleTeacherChange}
            placeholder="teacher@email.com"
          />
        </label>
        <label>
          Phone
          <input
            name="phone"
            value={teacherForm.phone}
            onChange={handleTeacherChange}
            placeholder="(555) 123-4567"
          />
        </label>
      </div>
      <button type="submit" className="primary">
        Register instructor
      </button>
    </form>
  );

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <div className="app__brand">
            <img
              src={`${process.env.PUBLIC_URL}/logo/Asset%20203.svg`}
              alt="Coventry CelebKids"
              className="app__logo"
            />
            <div>
              <h1>Coventry CelebKids Instructors</h1>
            </div>
          </div>
          <p className="app__subtitle">
            Keep track of your classroom roster, guardians, and instructor assignments.
          </p>
        </div>
        <div className="app__stats">
          <div>
            <span className="stat__label">Instructors</span>
            <span className="stat__value">{records.teachers.length}</span>
          </div>
          <div>
            <span className="stat__label">Children</span>
            <span className="stat__value">{records.children.length}</span>
          </div>
        </div>
      </header>

      <div className="app__status">
        {isLoading && <p className="banner banner--info">Syncing records…</p>}
        {supabaseStatus && <p className="banner banner--info">{supabaseStatus}</p>}
        {error && <p className="banner banner--error">{error}</p>}
      </div>

      <main className="app__main">
        {view === 'list' ? (
          <>
            <section className="panel">
              <div className="panel__heading">
                <h2>Instructors</h2>
                <div className="panel__actions">
                  <input
                    className="search"
                    type="search"
                    placeholder="Search instructors"
                    value={teacherSearch}
                    onChange={(event) => setTeacherSearch(event.target.value)}
                  />
                  <button type="button" className="ghost" onClick={() => setView('register')}>
                    Register instructor
                  </button>
                </div>
              </div>

              <div className="list">
                {filteredTeachers.length === 0 ? (
                  <p className="empty">No instructors yet. Add your first instructor above.</p>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <article key={teacher.id} className="card">
                      <div>
                        <h3>{teacher.name}</h3>
                        <p className="muted">{teacher.role}</p>
                        <div className="meta">
                          <span>{teacher.email || 'No email'}</span>
                          <span>{teacher.phone || 'No phone'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleDeleteTeacher(teacher.id)}
                      >
                        Remove
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel__heading">
                <h2>Registered children</h2>
                <input
                  className="search"
                  type="search"
                  placeholder="Search children"
                  value={childSearch}
                  onChange={(event) => setChildSearch(event.target.value)}
                />
              </div>

              <div className="list">
                {filteredChildren.length === 0 ? (
                  <p className="empty">No children yet. Register children in the main app.</p>
                ) : (
                  filteredChildren.map((child) => (
                    <article key={child.id} className="card">
                      <div>
                        <div className="card__title">
                          <h3>{child.name}</h3>
                          {child.age && <span className="badge">Age {child.age}</span>}
                        </div>
                        <p className="muted">
                          Assigned: {teacherLookup[child.teacherId] || 'Unassigned'}
                          {child.classCategory ? ` • ${child.classCategory}` : ''}
                        </p>
                        <div className="meta">
                          <span>{child.guardianName || 'No guardian listed'}</span>
                          <span>{child.guardianContact || 'No contact listed'}</span>
                          <span>{child.notes || 'No notes'}</span>
                          <span>
                            {child.lastStatus
                              ? `Last ${child.lastStatus === 'sign_in' ? 'signed in' : 'signed out'}`
                              : 'No check-ins yet'}
                          </span>
                          <span>
                            {child.lastActionAt ? new Date(child.lastActionAt).toLocaleString() : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleSelectChild(child)}
                      >
                        View details
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : view === 'child' && selectedChild ? (
          <section className="panel">
            <div className="panel__heading">
              <h2>{selectedChild.name}</h2>
              <div className="panel__actions">
                <button type="button" className="ghost" onClick={handleBackToList}>
                  Back to list
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={isUpdatingChildStatus}
                  onClick={() => handleChildCheckin('sign_in')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={isUpdatingChildStatus}
                  onClick={() => handleChildCheckin('sign_out')}
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="card card--stack">
              <div className="card__title">
                <h3>Child details</h3>
                {selectedChild.age && <span className="badge">Age {selectedChild.age}</span>}
              </div>
              <div className="meta">
                <span>Class: {selectedChild.classCategory || 'Unassigned'}</span>
                <span>Assigned: {teacherLookup[selectedChild.teacherId] || 'Unassigned'}</span>
                <span>Guardian: {selectedChild.guardianName || 'No guardian listed'}</span>
                <span>Contact: {selectedChild.guardianContact || 'No contact listed'}</span>
                <span>Sex: {selectedChild.sex || 'Not specified'}</span>
                <span>Date of birth: {selectedChild.dateOfBirth || 'Not provided'}</span>
                <span>Allergies: {selectedChild.allergies || 'None listed'}</span>
                <span>
                  Photos allowed: {selectedChild.allowPhotos ? 'Yes' : 'No'}
                </span>
                <span>Notes: {selectedChild.notes || 'No notes'}</span>
                <span>
                  Status:{' '}
                  {selectedChild.lastStatus
                    ? selectedChild.lastStatus === 'sign_in'
                      ? 'Signed in'
                      : 'Signed out'
                    : 'No check-ins yet'}
                </span>
                <span>
                  Last action:{' '}
                  {selectedChild.lastActionAt
                    ? new Date(selectedChild.lastActionAt).toLocaleString()
                    : '—'}
                </span>
              </div>
            </div>

            <div className="card card--stack">
              <div className="card__title">
                <h3>QR code</h3>
              </div>
              {qrCodeValue ? (
                <div className="qr-code">
                  <QRCodeCanvas value={qrCodeValue} size={180} includeMargin />
                  <p className="muted">Scan to open child record.</p>
                </div>
              ) : (
                <p className="muted">No QR code available.</p>
              )}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel__heading">
              <h2>Register instructor</h2>
              <button type="button" className="ghost" onClick={() => setView('list')}>
                Back to list
              </button>
            </div>
            {registerInstructorForm}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
