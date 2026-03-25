import React from 'react';
import bcrypt from 'bcryptjs';
import './App.css';
import { isSupabaseEnabled, supabase, supabasePublic } from './lib/supabaseClient';
import AppHeader from './components/AppHeader';
import AppStatus from './components/AppStatus';
import DeleteInstructorModal from './components/DeleteInstructorModal';
import AvailabilityView from './components/views/AvailabilityView';
import ChildView from './components/views/ChildView';
import ChildrenView from './components/views/ChildrenView';
import HomeView from './components/views/HomeView';
import InstructorDetailView from './components/views/InstructorDetailView';
import InstructorsView from './components/views/InstructorsView';
import LoginView from './components/views/LoginView';
import ProfileView from './components/views/ProfileView';
import RegisterView from './components/views/RegisterView';
import useAvailabilityActions from './hooks/useAvailabilityActions';
import useAvailabilityCalendar from './hooks/useAvailabilityCalendar';
import useChildrenData from './hooks/useChildrenData';
import useInstructorData from './hooks/useInstructorData';
import useInstructorRegistration from './hooks/useInstructorRegistration';
import useInstructorVerification from './hooks/useInstructorVerification';

const STORAGE_KEY = 'celebkids-records-v1';
const SIGNED_IN_KEY = 'celebkids-instructor-id';
const AVAILABILITY_RULES_KEY = 'celebkids-availability-rules-v1';
const EMPTY_RECORDS = { teachers: [], children: [] };
const INSTRUCTOR_PHOTOS_BUCKET =
  process.env.REACT_APP_INSTRUCTOR_PHOTOS_BUCKET || 'instructor-photos';
const REFRESH_VIEWS = new Set(['children', 'instructors', 'instructor', 'availability']);

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

const loadLocalAvailabilityRules = () => {
  try {
    const stored = localStorage.getItem(AVAILABILITY_RULES_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
};

const normalizeAvailabilityDetails = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { date: item, occasion: '' };
      }
      if (item && typeof item === 'object') {
        return {
          date: item.date || item.value || '',
          occasion: item.occasion || item.label || '',
        };
      }
      return null;
    })
    .filter((item) => item && item.date);
};

const isTruthyFlag = (value) => value === true || value === 1 || value === 'true';

const mapTeacherFromDb = (teacher) => ({
  id: teacher.id,
  name: teacher.name || '',
  email: teacher.email || '',
  phone: teacher.phone || '',
  role: teacher.role || 'Instructor',
  createdAt: teacher.created_at || teacher.createdAt || new Date().toISOString(),
  verified: isTruthyFlag(teacher.verified),
  passwordHash: teacher.password_hash || teacher.password || '',
  photoUrl: teacher.photo_url || teacher.photoUrl || '',
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

const mapAvailabilityFromDb = (availability) => ({
  id: availability.id,
  instructorId: availability.instructor_id || availability.instructorId || '',
  instructorName: availability.instructor_name || availability.instructorName || '',
  date: availability.date || availability.available_date || availability.availableDate || '',
  notes: availability.notes || '',
  changeReason: availability.change_reason || availability.changeReason || '',
  approvalReason: availability.approval_reason || availability.approvalReason || '',
  status: availability.status || 'pending',
  approvedBy: availability.approved_by || availability.approvedBy || '',
  approvedAt: availability.approved_at || availability.approvedAt || '',
  createdAt: availability.created_at || availability.createdAt || new Date().toISOString(),
});

const mapAvailabilityToDb = (availability) => ({
  id: availability.id,
  instructor_id: availability.instructorId,
  instructor_name: availability.instructorName,
  date: availability.date || null,
  notes: availability.notes || null,
  change_reason: availability.changeReason || null,
  approval_reason: availability.approvalReason || null,
  status: availability.status || 'pending',
  approved_by: availability.approvedBy || null,
  approved_at: availability.approvedAt || null,
  created_at: availability.createdAt || new Date().toISOString(),
});

const mapTeacherToDb = (teacher) => ({
  id: teacher.id,
  name: teacher.name,
  email: teacher.email || null,
  phone: teacher.phone || null,
  role: teacher.role,
  created_at: teacher.createdAt,
  verified: typeof teacher.verified === 'boolean' ? teacher.verified : false,
  password_hash: teacher.passwordHash || null,
  photo_url: teacher.photoUrl || null,
});

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const toCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value).replace(/\r?\n/g, ' ').trim();
  if (/[",]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const isSundayDate = (dateValue) => {
  if (!dateValue) {
    return false;
  }
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.getDay() === 0;
};

const formatLocalDateValue = (dateValue) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getUpcomingSundays = (count = 12) => {
  const results = [];
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOffset = (7 - start.getDay()) % 7;
  const firstSunday = new Date(start);
  firstSunday.setDate(start.getDate() + dayOffset);
  for (let index = 0; index < count; index += 1) {
    const nextSunday = new Date(firstSunday);
    nextSunday.setDate(firstSunday.getDate() + index * 7);
    results.push(formatLocalDateValue(nextSunday));
  }
  return results;
};

const formatAvailabilityDateLabel = (dateValue) => {
  if (!dateValue) {
    return '';
  }
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
};

const formatAvailabilityStatus = (status) => {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'declined':
      return 'Declined';
    case 'pending_delete':
      return 'Delete requested';
    case 'pending':
      return 'Pending';
    default:
      return status || 'Pending';
  }
};

function App() {
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [records, setRecords] = React.useState(() =>
    isSupabaseEnabled ? EMPTY_RECORDS : loadLocalRecords()
  );
  const [isLoading, setIsLoading] = React.useState(isSupabaseEnabled);
  const [error, setError] = React.useState('');
  const [supabaseStatus, setSupabaseStatus] = React.useState('');
  const [view, setView] = React.useState('login');
  const [currentInstructor, setCurrentInstructor] = React.useState(null);
  const [selectedChild, setSelectedChild] = React.useState(null);
  const [selectedTeacher, setSelectedTeacher] = React.useState(null);
  const [teacherForm, setTeacherForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    role: 'Instructor',
    password: '',
    password2: '',
    photoFile: null,
  });
  const [profileForm, setProfileForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    role: 'Instructor',
    photoFile: null,
  });
  const [loginForm, setLoginForm] = React.useState({
    email: '',
    password: '',
  });
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });
  const [childSearch, setChildSearch] = React.useState('');
  const [instructorSearch, setInstructorSearch] = React.useState('');
  const [classFilter, setClassFilter] = React.useState('all');
  const [deletePrompt, setDeletePrompt] = React.useState({
    isOpen: false,
    teacherId: '',
    teacherName: '',
  });
  const [attendanceStartDate, setAttendanceStartDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceEndDate, setAttendanceEndDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [availabilityEntries, setAvailabilityEntries] = React.useState([]);
  const [availabilityForm, setAvailabilityForm] = React.useState({
    date: '',
    selectedDates: [],
    notes: '',
    changeReason: '',
  });
  const [deleteRequest, setDeleteRequest] = React.useState({
    entry: null,
    reason: '',
  });
  const [approvalReasons, setApprovalReasons] = React.useState({});
  const [allowedAvailabilityDates, setAllowedAvailabilityDates] = React.useState([]);
  const [allowedAvailabilityDetails, setAllowedAvailabilityDetails] = React.useState([]);
  const [availabilityRuleDate, setAvailabilityRuleDate] = React.useState('');
  const [availabilityRuleOccasion, setAvailabilityRuleOccasion] = React.useState('');
  const [isSavingAvailabilityRules, setIsSavingAvailabilityRules] = React.useState(false);
  const [availabilityEditId, setAvailabilityEditId] = React.useState(null);
  const [isSubmittingAvailability, setIsSubmittingAvailability] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const downloadRecentAttendance = React.useCallback(async () => {
    if (!isSupabaseEnabled || !supabasePublic) {
      setError('Attendance download requires Supabase to be configured.');
      return;
    }
    setError('');
    setSupabaseStatus('');
    if (!attendanceStartDate || !attendanceEndDate) {
      setError('Please select a start and end date for attendance.');
      return;
    }
    const startOfDay = new Date(`${attendanceStartDate}T00:00:00`);
    const endOfDay = new Date(`${attendanceEndDate}T23:59:59.999`);
    if (Number.isNaN(startOfDay.getTime()) || Number.isNaN(endOfDay.getTime())) {
      setError('Please provide valid attendance dates.');
      return;
    }
    if (startOfDay > endOfDay) {
      setError('Attendance start date must be before the end date.');
      return;
    }
    const { data, error: fetchError } = await supabasePublic
      .from('checkins')
      .select('child_id, action, created_at')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(`Unable to download attendance. ${fetchError.message}`);
      return;
    }
    const latestByChild = new Map();
    (data || []).forEach((checkin) => {
      if (!latestByChild.has(checkin.child_id)) {
        latestByChild.set(checkin.child_id, {
          childId: checkin.child_id,
          signInAt: null,
          signOutAt: null,
          lastStatus: checkin.action,
          lastTimestamp: checkin.created_at,
        });
      }
      const entry = latestByChild.get(checkin.child_id);
      if (checkin.action === 'sign_in' && !entry.signInAt) {
        entry.signInAt = checkin.created_at;
      }
      if (checkin.action === 'sign_out' && !entry.signOutAt) {
        entry.signOutAt = checkin.created_at;
      }
    });
    const rows = Array.from(latestByChild.values()).map((entry) => {
      const child = records.children.find((item) => item.id === entry.childId);
      return {
        childName: child?.name || 'Unknown child',
        guardianName: child?.guardianName || '',
        guardianContact: child?.guardianContact || '',
        classCategory: child?.classCategory || '',
        signInAt: entry.signInAt || '',
        signOutAt: entry.signOutAt || '',
        status: entry.lastStatus === 'sign_in' ? 'Signed in' : 'Signed out',
        lastTimestamp: entry.lastTimestamp,
      };
    });
    const header = [
      'Child Name',
      'Guardian',
      'Contact',
      'Class',
      'Signed in at',
      'Signed out at',
      'Last status',
      'Last status time',
    ];
    const csvLines = [
      header.map(toCsvValue).join(','),
      ...rows.map((row) =>
        [
          row.childName,
          row.guardianName,
          row.guardianContact,
          row.classCategory,
          row.signInAt,
          row.signOutAt,
          row.status,
          row.lastTimestamp,
        ]
          .map(toCsvValue)
          .join(',')
      ),
    ];
    const blob = new Blob([`${csvLines.join('\n')}\n`], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
  link.download = `attendance-${attendanceStartDate}-to-${attendanceEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    if (rows.length === 0) {
      setSupabaseStatus('No attendance records were found for today.');
      return;
    }
    setSupabaseStatus('Attendance downloaded.');
  }, [attendanceEndDate, attendanceStartDate, records.children]);

  const fetchAvailability = React.useCallback(async () => {
    if (!supabasePublic) {
      return;
    }
    const { data, error: fetchError } = await supabasePublic
      .from('availability')
      .select('*')
      .order('date', { ascending: true })
  .order('created_at', { ascending: true });
    if (fetchError) {
      setError(`Unable to load availability. ${fetchError.message}`);
      return;
    }
    setAvailabilityEntries((data || []).map(mapAvailabilityFromDb));
  }, []);

  const sortedAllowedAvailabilityDates = React.useMemo(() => {
    return [...allowedAvailabilityDates].sort((a, b) => new Date(a) - new Date(b));
  }, [allowedAvailabilityDates]);

  const allowedAvailabilityDetailsByDate = React.useMemo(() => {
    const map = new Map();
    allowedAvailabilityDetails.forEach((item) => {
      if (item?.date) {
        map.set(item.date, item);
      }
    });
    return map;
  }, [allowedAvailabilityDetails]);

  const selectableAvailabilityDates = React.useMemo(() => {
    const combined = new Set(getUpcomingSundays(16));
    allowedAvailabilityDates.forEach((dateValue) => combined.add(dateValue));
    return Array.from(combined).sort((a, b) => new Date(a) - new Date(b));
  }, [allowedAvailabilityDates]);

  const selectableAvailabilityOptions = React.useMemo(() => {
    return selectableAvailabilityDates.map((dateValue) => {
      const isSunday = isSundayDate(dateValue);
      const detail = allowedAvailabilityDetailsByDate.get(dateValue);
      const occasionLabel = detail?.occasion
        ? detail.occasion
        : isSunday
          ? 'Sunday service'
          : '';
      return {
        date: dateValue,
        label: occasionLabel
          ? `${formatAvailabilityDateLabel(dateValue)} — ${occasionLabel}`
          : formatAvailabilityDateLabel(dateValue),
      };
    });
  }, [allowedAvailabilityDetailsByDate, selectableAvailabilityDates]);

  const getAvailabilityOccasionLabel = React.useCallback(
    (dateValue) => {
      const occasion = allowedAvailabilityDetailsByDate.get(dateValue)?.occasion;
      if (occasion) {
        return occasion;
      }
      if (isSundayDate(dateValue)) {
        return 'Sunday service';
      }
      return '';
    },
    [allowedAvailabilityDetailsByDate]
  );

  const formatAvailabilityRuleLabel = (dateValue) => {
    const occasion = getAvailabilityOccasionLabel(dateValue);
    const dateLabel = formatAvailabilityDateLabel(dateValue);
    return occasion ? `${dateLabel} — ${occasion}` : dateLabel;
  };

  const handleAvailabilityDeleteAction = (entry) => {
    if (entry.status !== 'approved') {
      handleAvailabilityDelete(entry);
      return;
    }
    setDeleteRequest({ entry, reason: entry.changeReason || '' });
  };

  const getAvailabilityDeleteLabel = (entry) =>
    entry.status === 'approved' ? 'Request delete' : 'Delete';

  const handleAvailabilityApproval = (entry, status) => {
    handleAvailabilityStatus(entry, status, approvalReasons[entry.id]);
  };

  const renderDeleteRequestForm = (entry) => (
    <div className="availability-delete">
      <label>
        Reason for delete
        <textarea
          name="deleteReason"
          value={deleteRequest.reason}
          onChange={(event) =>
            setDeleteRequest((prev) => ({
              ...prev,
              reason: event.target.value,
            }))
          }
          placeholder="Why should this availability be deleted?"
          required
        />
      </label>
      <div className="panel__actions">
        <button
          type="button"
          className="ghost"
          onClick={() => setDeleteRequest({ entry: null, reason: '' })}
        >
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => handleAvailabilityDelete(entry, deleteRequest.reason)}
        >
          Submit delete request
        </button>
      </div>
    </div>
  );


  const persistAvailabilityRules = React.useCallback(
    async (nextDates, nextDetails, statusMessage) => {
      setIsSavingAvailabilityRules(true);
      setAllowedAvailabilityDates(nextDates);
      setAllowedAvailabilityDetails(nextDetails);
      localStorage.setItem(AVAILABILITY_RULES_KEY, JSON.stringify(nextDetails));
      if (isSupabaseEnabled) {
        const { error: updateError } = await supabase
          .from('availability_rules')
          .upsert({
            id: 'default',
            allowed_dates: nextDates,
            allowed_date_details: nextDetails,
            updated_by: currentInstructor?.id || null,
            updated_at: new Date().toISOString(),
          });
        if (updateError) {
          if (!/availability_rules|relation/i.test(updateError.message)) {
            setError(`Unable to save availability rules. ${updateError.message}`);
          } else {
            setError('Availability rules table is missing. Create public.availability_rules.');
          }
          setIsSavingAvailabilityRules(false);
          return;
        }
      }
      if (statusMessage) {
        setSupabaseStatus(statusMessage);
      }
      setIsSavingAvailabilityRules(false);
    },
    [currentInstructor]
  );

  const handleAddAllowedDate = async () => {
    if (!availabilityRuleDate) {
      setError('Select a date to allow.');
      return;
    }
    if (isSundayDate(availabilityRuleDate)) {
      setError('Sunday availability is already required for everyone.');
      return;
    }
    if (!availabilityRuleOccasion.trim()) {
      setError('Please add the occasion for this extra date.');
      return;
    }
    if (allowedAvailabilityDates.includes(availabilityRuleDate)) {
      setError('That date is already enabled.');
      return;
    }
    const nextDetails = [
      ...allowedAvailabilityDetails,
      { date: availabilityRuleDate, occasion: availabilityRuleOccasion.trim() },
    ];
    await persistAvailabilityRules(
      [...allowedAvailabilityDates, availabilityRuleDate],
      nextDetails,
      'Availability date added.'
    );
    setAvailabilityRuleDate('');
    setAvailabilityRuleOccasion('');
  };

  const handleRemoveAllowedDate = async (dateValue) => {
    const nextDates = allowedAvailabilityDates.filter((date) => date !== dateValue);
    const nextDetails = allowedAvailabilityDetails.filter((item) => item.date !== dateValue);
    await persistAvailabilityRules(nextDates, nextDetails, 'Availability date removed.');
  };

  const handleAvailabilityFormChange = (event) => {
    const { name, value } = event.target;
    setAvailabilityForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvailabilityDateToggle = (dateValue) => {
    setAvailabilityForm((prev) => {
      if (prev.selectedDates.includes(dateValue)) {
        return {
          ...prev,
          selectedDates: prev.selectedDates.filter((date) => date !== dateValue),
        };
      }
      return {
        ...prev,
        selectedDates: [...prev.selectedDates, dateValue],
      };
    });
  };

  const handleAvailabilityDatesSet = (dates) => {
    const nextDates = Array.from(new Set(dates)).filter(Boolean);
    setAvailabilityForm((prev) => ({
      ...prev,
      selectedDates: nextDates,
    }));
  };

  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records]);

  React.useEffect(() => {
    const localRules = normalizeAvailabilityDetails(loadLocalAvailabilityRules());
    if (localRules.length) {
      setAllowedAvailabilityDetails(localRules);
      setAllowedAvailabilityDates(localRules.map((item) => item.date));
    }
    if (!isSupabaseEnabled || !supabasePublic) {
      return undefined;
    }
    let isActive = true;
    const fetchRules = async () => {
      const { data, error: fetchError } = await supabasePublic
        .from('availability_rules')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      if (!isActive) {
        return;
      }
      if (fetchError) {
        if (!/availability_rules|relation/i.test(fetchError.message)) {
          setError(`Unable to load availability rules. ${fetchError.message}`);
        }
        return;
      }
      if (data?.allowed_date_details && Array.isArray(data.allowed_date_details)) {
        const details = normalizeAvailabilityDetails(data.allowed_date_details);
        setAllowedAvailabilityDetails(details);
        setAllowedAvailabilityDates(details.map((item) => item.date));
        return;
      }
      if (data?.allowed_dates && Array.isArray(data.allowed_dates)) {
        const fallbackDetails = normalizeAvailabilityDetails(data.allowed_dates);
        setAllowedAvailabilityDetails(fallbackDetails);
        setAllowedAvailabilityDates(fallbackDetails.map((item) => item.date));
      }
    };
    fetchRules();
    return () => {
      isActive = false;
    };
  }, []);

  React.useEffect(() => {
    if (currentInstructor?.id) {
      localStorage.setItem(SIGNED_IN_KEY, currentInstructor.id);
    }
  }, [currentInstructor]);

  React.useEffect(() => {
    if (!supabaseStatus) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setSupabaseStatus('');
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [supabaseStatus]);

  React.useEffect(() => {
    if (!error) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setError('');
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  React.useEffect(() => {
    setError('');
  }, [view]);

  React.useEffect(() => {
    if (selectedTeacher && currentInstructor?.id === selectedTeacher.id) {
      setProfileForm({
        name: selectedTeacher.name || '',
        email: selectedTeacher.email || '',
        phone: selectedTeacher.phone || '',
        role: selectedTeacher.role || 'Instructor',
        photoFile: null,
      });
    }
  }, [selectedTeacher, currentInstructor]);

  const fetchRecords = React.useCallback(
    async ({ setViewOnAuth = false, showLoading = true } = {}) => {
      if (!isSupabaseEnabled) {
        return;
      }

      const finalizeLoading = () => {
        if (showLoading) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      };

      if (showLoading) {
        setIsLoading(true);
        setSupabaseStatus('');
      } else {
        setIsRefreshing(true);
      }
      setError('');

      const [teachersResponse, childrenResponse] = await Promise.all([
        supabasePublic.from('teachers').select('*').order('created_at', { ascending: false }),
        supabasePublic.from('children').select('*').order('created_at', { ascending: false }),
      ]);

      if (teachersResponse.error || childrenResponse.error) {
        const message = teachersResponse.error?.message || childrenResponse.error?.message;
        setError(
          `Unable to load records from Supabase. ${message || 'Check your connection.'}`
        );
        finalizeLoading();
        return;
      }

      const mappedTeachers = (teachersResponse.data || []).map(mapTeacherFromDb);
      const mappedChildren = (childrenResponse.data || []).map(mapChildFromDb);
      setRecords({
        teachers: mappedTeachers,
        children: mappedChildren,
      });
      const storedId = localStorage.getItem(SIGNED_IN_KEY);
      if (storedId) {
        const matched = mappedTeachers.find((teacher) => teacher.id === storedId);
        if (matched) {
          setCurrentInstructor(matched);
          if (setViewOnAuth) {
            setView('home');
          }
        } else {
          localStorage.removeItem(SIGNED_IN_KEY);
        }
      }
      finalizeLoading();
    },
    []
  );

  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      return undefined;
    }
    const load = async () => {
      await fetchRecords({ setViewOnAuth: true });
    };
    load();
    return undefined;
  }, [fetchRecords]);

  React.useEffect(() => {
    if (REFRESH_VIEWS.has(view)) {
      fetchRecords({ showLoading: false });
    }
  }, [fetchRecords, view]);

  React.useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handleTeacherChange = (event) => {
    const { name, value, files, type } = event.target;
    setTeacherForm((prev) => ({
      ...prev,
      [name]: type === 'file' ? files?.[0] || null : value,
    }));
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileFormChange = (event) => {
    const { name, value, files, type } = event.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: type === 'file' ? files?.[0] || null : value,
    }));
  };

  const setStatusWithActor = (message) => {
    if (currentInstructor?.name) {
      setSupabaseStatus(`${currentInstructor.name}: ${message}`);
    } else {
      setSupabaseStatus(message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSupabaseStatus('');
    const email = loginForm.email.trim().toLowerCase();
    if (!email || !loginForm.password) {
      setError('Email and password are required.');
      return;
    }
    let instructor = records.teachers.find(
      (teacher) => teacher.email?.toLowerCase() === email
    );
    if (!instructor && isSupabaseEnabled) {
      const { data, error: fetchError } = await supabasePublic
        .from('teachers')
        .select('*')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      if (fetchError) {
        setError(`Unable to verify instructor. ${fetchError.message}`);
        return;
      }
      if (data) {
        instructor = mapTeacherFromDb(data);
        setRecords((prev) => ({
          ...prev,
          teachers: prev.teachers.some((t) => t.id === instructor.id)
            ? prev.teachers
            : [instructor, ...prev.teachers],
        }));
      }
    }
    if (!instructor) {
      setError('No instructor found with that email.');
      return;
    }
    if (!instructor.verified) {
      setError('This instructor is pending verification.');
      return;
    }
    let passwordMatches = false;
    if (instructor.passwordHash) {
      passwordMatches = await bcrypt.compare(loginForm.password, instructor.passwordHash);
    }
    if (!passwordMatches) {
      setError('Incorrect password.');
      return;
    }
    setCurrentInstructor(instructor);
    localStorage.setItem(SIGNED_IN_KEY, instructor.id);
    setLoginForm({ email: '', password: '' });
    setView('home');
  };

  const handleSignOut = () => {
    setCurrentInstructor(null);
    localStorage.removeItem(SIGNED_IN_KEY);
    setView('login');
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    if (!currentInstructor) {
      return;
    }
    setError('');
    setSupabaseStatus('');
    if (!passwordForm.currentPassword || !passwordForm.nextPassword) {
      setError('Please enter your current and new password.');
      return;
    }
    if (passwordForm.nextPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    const storedInstructor = records.teachers.find(
      (teacher) => teacher.id === currentInstructor.id
    );
    const currentHash = storedInstructor?.passwordHash || '';
    const matches = currentHash
      ? await bcrypt.compare(passwordForm.currentPassword, currentHash)
      : false;
    if (!matches) {
      setError('Current password is incorrect.');
      return;
    }
    const nextHash = await bcrypt.hash(passwordForm.nextPassword, 10);
    if (isSupabaseEnabled) {
      const { error: updateError } = await supabase
        .from('teachers')
        .update({ password_hash: nextHash })
        .eq('id', currentInstructor.id);
      if (updateError) {
        setError(`Unable to update password. ${updateError.message}`);
        return;
      }
    }
    setRecords((prev) => ({
      ...prev,
      teachers: prev.teachers.map((teacher) =>
        teacher.id === currentInstructor.id
          ? { ...teacher, passwordHash: nextHash }
          : teacher
      ),
    }));
    setCurrentInstructor((prev) => (prev ? { ...prev, passwordHash: nextHash } : prev));
    setPasswordForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
    setStatusWithActor('Password updated.');
  };

  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    if (!currentInstructor) {
      return;
    }
    const trimmedName = profileForm.name.trim();
    const trimmedEmail = profileForm.email.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    setError('');
    setSupabaseStatus('');

    const updatedTeacher = {
      ...currentInstructor,
      name: trimmedName,
      email: trimmedEmail,
      phone: profileForm.phone.trim(),
      role: profileForm.role || currentInstructor.role,
      photoUrl: currentInstructor.photoUrl || '',
    };

    if (isSupabaseEnabled) {
      if (profileForm.photoFile) {
        const fileExt = profileForm.photoFile.name.split('.').pop();
        const filePath = `instructors/${currentInstructor.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(INSTRUCTOR_PHOTOS_BUCKET)
          .upload(filePath, profileForm.photoFile, {
            upsert: true,
            contentType: profileForm.photoFile.type,
          });
        if (uploadError) {
          setError(
            `Unable to upload photo. ${uploadError.message} (Bucket: ${INSTRUCTOR_PHOTOS_BUCKET})`
          );
          return;
        }
        const { data: publicData } = supabase
          .storage
          .from(INSTRUCTOR_PHOTOS_BUCKET)
          .getPublicUrl(filePath);
        updatedTeacher.photoUrl = publicData?.publicUrl || '';
      }

      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          name: updatedTeacher.name,
          email: updatedTeacher.email,
          phone: updatedTeacher.phone || null,
          role: updatedTeacher.role,
          photo_url: updatedTeacher.photoUrl || null,
        })
        .eq('id', currentInstructor.id);
      if (updateError) {
        setError(`Unable to update profile. ${updateError.message}`);
        return;
      }
    }

    setRecords((prev) => ({
      ...prev,
      teachers: prev.teachers.map((teacher) =>
        teacher.id === currentInstructor.id ? { ...teacher, ...updatedTeacher } : teacher
      ),
    }));
    setCurrentInstructor(updatedTeacher);
    if (selectedTeacher?.id === currentInstructor.id) {
      setSelectedTeacher(updatedTeacher);
    }
    setProfileForm((prev) => ({
      ...prev,
      photoFile: null,
    }));
    setStatusWithActor('Profile updated.');
  };

  const openChild = (child) => {
    setSelectedChild(child);
    setView('child');
  };

  const openInstructor = (teacher) => {
    setSelectedTeacher(teacher);
    setView('instructor');
  };

  const handleCardKeyDown = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };

  const renderTeacherAvatar = (teacher, size = 42) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#e0e7ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4859f0',
        fontWeight: 700,
      }}
    >
      {teacher.photoUrl ? (
        <img
          src={teacher.photoUrl}
          alt={teacher.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{teacher.name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );

  const handleBackToHome = () => {
    setSelectedChild(null);
    setSelectedTeacher(null);
    setView('home');
  };

  const handleBackToInstructors = () => {
    setSelectedTeacher(null);
    setView('instructors');
  };

  const handleBackToInstructorDetails = () => {
    setView('instructor');
  };

  const handleBackToChildren = () => {
    setSelectedChild(null);
    setView('children');
  };

  const handleAddTeacher = useInstructorRegistration({
    teacherForm,
    currentInstructor,
    records,
    bcrypt,
    isSupabaseEnabled,
    supabase,
    INSTRUCTOR_PHOTOS_BUCKET,
    createId,
    mapTeacherToDb,
    setError,
    setSupabaseStatus,
    setStatusWithActor,
    setRecords,
    setTeacherForm,
    setPendingVerification,
    setView,
  });

  const handleDeleteTeacher = async (teacherId) => {
    if (!isLeadInstructor) {
      setError('Only Lead Instructors can remove instructors.');
      return;
    }
    const teacher = records.teachers.find((item) => item.id === teacherId);
    setDeletePrompt({
      isOpen: true,
      teacherId,
      teacherName: teacher?.name || 'this instructor',
    });
  };

  const closeDeletePrompt = () => {
    setDeletePrompt({ isOpen: false, teacherId: '', teacherName: '' });
  };

  const confirmDeleteTeacher = async () => {
    const teacherId = deletePrompt.teacherId;
    if (!teacherId) {
      closeDeletePrompt();
      return;
    }
    closeDeletePrompt();
    let didSetDeleteStatus = false;
    const setDeleteStatus = (message) => {
      setStatusWithActor(message);
      didSetDeleteStatus = true;
    };
    if (isSupabaseEnabled) {
      setError('');
      setSupabaseStatus('');
      const teacherToRemove =
        records.teachers.find((teacher) => teacher.id === teacherId) ||
        (selectedTeacher?.id === teacherId ? selectedTeacher : null);
      const clearChildAssignments = async () => {
        if (isUuid(teacherId)) {
          const { error: childUpdateError } = await supabase
            .from('children')
            .update({ teacher_id: null })
            .eq('teacher_id', teacherId);
          if (childUpdateError) {
            const message = childUpdateError.message || '';
            if (!message.includes('teacher_id')) {
              setError(
                `Unable to update children for this teacher. ${childUpdateError.message}`
              );
              return false;
            }
          }
        }

        const { error: camelCaseError } = await supabase
          .from('children')
          .update({ teacherId: null })
          .eq('teacherId', teacherId);
        if (camelCaseError) {
          const camelMessage = camelCaseError.message || '';
          if (camelMessage.includes('teacherid')) {
            const { error: lowerCaseError } = await supabase
              .from('children')
              .update({ teacherid: null })
              .eq('teacherid', teacherId);
            if (lowerCaseError) {
              setError(
                `Unable to update children for this teacher. ${lowerCaseError.message}`
              );
              return false;
            }
          } else if (!camelMessage.includes('teacherId')) {
            setError(
              `Unable to update children for this teacher. ${camelCaseError.message}`
            );
            return false;
          }
        }

        if (teacherToRemove?.email) {
          const { error: emailChildError } = await supabase
            .from('children')
            .update({ teacher_email: null })
            .eq('teacher_email', teacherToRemove.email);
          if (emailChildError) {
            const emailMessage = emailChildError.message || '';
            if (!emailMessage.includes('teacher_email')) {
              const { error: camelEmailError } = await supabase
                .from('children')
                .update({ teacherEmail: null })
                .eq('teacherEmail', teacherToRemove.email);
              if (camelEmailError) {
                const camelEmailMessage = camelEmailError.message || '';
                if (camelEmailMessage.includes('teacheremail')) {
                  const { error: lowerEmailError } = await supabase
                    .from('children')
                    .update({ teacheremail: null })
                    .eq('teacheremail', teacherToRemove.email);
                  if (lowerEmailError) {
                    setError(
                      `Unable to update children for this teacher. ${lowerEmailError.message}`
                    );
                    return false;
                  }
                } else if (!camelEmailMessage.includes('teacherEmail')) {
                  setError(
                    `Unable to update children for this teacher. ${camelEmailError.message}`
                  );
                  return false;
                }
              }
            }
          }
        }

        return true;
      };

      const removeInstructorPhoto = async () => {
        if (!teacherToRemove?.photoUrl) {
          return true;
        }
        const pathMatch = teacherToRemove.photoUrl.match(/\/instructors\/[^?]+/);
        const storagePath = pathMatch ? pathMatch[0].replace('/instructors/', '') : null;
        if (!storagePath) {
          return true;
        }
        const { error: photoDeleteError } = await supabase
          .storage
          .from(INSTRUCTOR_PHOTOS_BUCKET)
          .remove([`instructors/${storagePath}`]);
        if (photoDeleteError) {
          setError(`Unable to remove instructor photo. ${photoDeleteError.message}`);
          return false;
        }
        return true;
      };

      const clearedChildren = await clearChildAssignments();
      if (!clearedChildren) {
        return;
      }
      const removedPhoto = await removeInstructorPhoto();
      if (!removedPhoto) {
        return;
      }
      const deleteResponse = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId)
        .select('id, email');
      if (deleteResponse.error) {
        setError(`Unable to remove teacher. ${deleteResponse.error.message}`);
        return;
      }
      if ((deleteResponse.data || []).length === 0 && teacherToRemove?.email) {
        const normalizedEmail = teacherToRemove.email.trim().toLowerCase();
        const emailDelete = await supabase
          .from('teachers')
          .delete()
          .ilike('email', normalizedEmail)
          .select('id, email');
        if (emailDelete.error) {
          setError(
            `Unable to remove teacher (${normalizedEmail}). ${emailDelete.error.message}`
          );
          return;
        }
        if ((emailDelete.data || []).length === 0) {
          setDeleteStatus(
            'Instructor removed locally. No matching database record was found.'
          );
        } else {
          setDeleteStatus('Instructor removed from data base.');
        }
      } else {
        setDeleteStatus('Instructor removed from data base.');
      }
    }
    setRecords((prev) => ({
      ...prev,
      teachers: prev.teachers.filter((teacher) => teacher.id !== teacherId),
      children: prev.children.map((child) =>
        child.teacherId === teacherId ? { ...child, teacherId: '' } : child
      ),
    }));
    if (selectedTeacher?.id === teacherId) {
      setSelectedTeacher(null);
      setView('instructors');
    }
    if (currentInstructor?.id === teacherId) {
      setCurrentInstructor(null);
      setView('login');
    }
    if (!didSetDeleteStatus) {
      setDeleteStatus('Instructor removed.');
    }
  };

  const handleVerifyTeacher = useInstructorVerification({
    isSupabaseEnabled,
    supabase,
    setError,
    setSupabaseStatus,
    setRecords,
    setStatusWithActor,
  });

  const pendingAvailability = React.useMemo(
    () =>
      availabilityEntries.filter((entry) =>
        ['pending', 'pending_delete'].includes(entry.status)
      ),
    [availabilityEntries]
  );
  const myAvailability = React.useMemo(
    () =>
      availabilityEntries.filter((entry) => entry.instructorId === currentInstructor?.id),
    [availabilityEntries, currentInstructor]
  );

  const resetAvailabilityForm = React.useCallback(() => {
    setAvailabilityForm({
      date: '',
      selectedDates: [],
      notes: '',
      changeReason: '',
    });
    setAvailabilityEditId(null);
  }, []);

  const handleAvailabilitySubmit = async (event) => {
    event.preventDefault();
    if (!currentInstructor) {
      setError('Please sign in before submitting availability.');
      return;
    }
    const selectedDates = availabilityEditId
      ? availabilityForm.date
        ? [availabilityForm.date]
        : []
      : availabilityForm.selectedDates;
    if (selectedDates.length === 0) {
      setError(
        availabilityEditId
          ? 'Please provide a date for availability.'
          : 'Please select at least one availability date.'
      );
      return;
    }
    if (availabilityEditId && !availabilityForm.changeReason.trim()) {
      setError('Please provide a reason for updating this availability.');
      return;
    }
    if (
      selectedDates.some(
        (dateValue) =>
          !isSundayDate(dateValue) && !allowedAvailabilityDates.includes(dateValue)
      )
    ) {
      setError('Availability is required every Sunday. Other days must be enabled by the lead instructor.');
      return;
    }
    setIsSubmittingAvailability(true);
    setError('');
    setSupabaseStatus('');
    const isEditing = Boolean(availabilityEditId);
    const entriesToSave = selectedDates.map((dateValue) => ({
      id: availabilityEditId || createId(),
      instructorId: currentInstructor.id,
      instructorName: currentInstructor.name,
      date: dateValue,
      notes: availabilityForm.notes,
      changeReason: availabilityForm.changeReason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));
    const newEntry = entriesToSave[0];
    try {
      if (isSupabaseEnabled) {
        if (isEditing) {
          const { data, error: updateError } = await supabase
            .from('availability')
            .update({
              date: newEntry.date,
              notes: newEntry.notes || null,
              change_reason: newEntry.changeReason || null,
              status: 'pending',
              approved_by: null,
              approved_at: null,
            })
            .eq('id', newEntry.id)
            .select('*')
            .maybeSingle();
          if (updateError) {
            setError(`Unable to update availability. ${updateError.message}`);
            return;
          }
          if (data) {
            setAvailabilityEntries((prev) =>
              prev.map((entry) =>
                entry.id === newEntry.id ? mapAvailabilityFromDb(data) : entry
              )
            );
          }
        } else {
          const { data, error: insertError } = await supabase
            .from('availability')
            .insert(entriesToSave.map(mapAvailabilityToDb))
            .select('*');
          if (insertError) {
            setError(`Unable to submit availability. ${insertError.message}`);
            return;
          }
          if (data && data.length) {
            const mappedEntries = Array.isArray(data)
              ? data.map(mapAvailabilityFromDb)
              : [mapAvailabilityFromDb(data)];
            setAvailabilityEntries((prev) => [...mappedEntries, ...prev]);
          } else {
            setAvailabilityEntries((prev) => [...entriesToSave, ...prev]);
            if (supabasePublic) {
              await fetchAvailability();
            }
          }
        }
      } else {
        if (isEditing) {
          setAvailabilityEntries((prev) =>
            prev.map((entry) =>
              entry.id === newEntry.id
                ? {
                  ...entry,
                  date: newEntry.date,
                  notes: newEntry.notes,
                  changeReason: newEntry.changeReason,
                  status: 'pending',
                  approvedBy: '',
                  approvedAt: '',
                }
                : entry
            )
          );
        } else {
          setAvailabilityEntries((prev) => [...entriesToSave, ...prev]);
        }
      }
      resetAvailabilityForm();
      setSupabaseStatus(
        isEditing ? 'Availability update submitted for review.' : 'Availability submitted for review.'
      );
    } finally {
      setIsSubmittingAvailability(false);
    }
  };

  const {
    verifiedTeachers,
    filteredVerifiedTeachers,
    filteredPendingTeachers,
    isLeadInstructor,
  } = useInstructorData({
    teachers: records.teachers,
    instructorSearch,
    currentInstructor,
  });

  const {
    deleteAvailability: handleAvailabilityDelete,
    updateStatus: handleAvailabilityStatus,
  } = useAvailabilityActions({
    isLeadInstructor,
    isSupabaseEnabled,
    supabase,
    currentInstructor,
    approvalReasons,
    deleteRequest,
    mapAvailabilityFromDb,
    setAvailabilityEntries,
    setError,
    setSupabaseStatus,
    setDeleteRequest,
    setApprovalReasons,
  });

  const {
    classOptions,
    groupedChildren,
    teacherLookup,
    assignedChildren,
  } = useChildrenData({
    teachers: records.teachers,
    children: records.children,
    childSearch,
    classFilter,
    selectedTeacher,
  });

  const { approvedAvailability, approvedAvailabilityCalendar } = useAvailabilityCalendar(
    availabilityEntries
  );

  const qrCodeValue = selectedChild
    ? `${window.location.origin}${process.env.PUBLIC_URL || ''}/?scan=${
        selectedChild.qrCode || selectedChild.id
      }`
    : '';

  const activeView = !currentInstructor && view !== 'register' ? 'login' : view;

  const handleProfileOpen = () => {
    if (currentInstructor) {
      setSelectedTeacher(currentInstructor);
    }
    setView('profile');
  };

  const handleApproveAvailabilityEntry = (entry) =>
    handleAvailabilityApproval(entry, 'approved');
  const handleDeclineAvailabilityEntry = (entry) =>
    handleAvailabilityApproval(entry, 'declined');

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
            <option>Instructor</option>
            <option>Support</option>
            <option>Volunteer</option>
          </select>
        </label>
        <label>
          Email*
          <input
            name="email"
            type="email"
            value={teacherForm.email}
            onChange={handleTeacherChange}
            placeholder="teacher@email.com"
            required
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
        <label className="form__full">
          Photo (optional)
          <input
            name="photoFile"
            type="file"
            accept="image/*"
            onChange={handleTeacherChange}
          />
        </label>
        <label>
          Password*
          <input
            name="password"
            type="password"
            value={teacherForm.password}
            onChange={handleTeacherChange}
            placeholder="Create a password"
            required
            minLength={6}
          />
        </label>
        <label>
          Confirm Password*
          <input
            name="password2"
            type="password"
            value={teacherForm.password2}
            onChange={handleTeacherChange}
            placeholder="Re-enter your password"
            required
            minLength={6}
          />
        </label>
      </div>
      <button type="submit" className="primary">
        Register instructor
      </button>
      {pendingVerification && (
        <p className="muted">Registration submitted. Awaiting Lead Instructor email verification.</p>
      )}
    </form>
  );

  const instructorsView = (
    <InstructorsView
      instructorSearch={instructorSearch}
      onSearchChange={(event) => setInstructorSearch(event.target.value)}
      onBack={handleBackToHome}
      filteredVerifiedTeachers={filteredVerifiedTeachers}
      filteredPendingTeachers={filteredPendingTeachers}
      isLeadInstructor={isLeadInstructor}
      onOpenInstructor={openInstructor}
      onCardKeyDown={handleCardKeyDown}
      renderTeacherAvatar={renderTeacherAvatar}
      onRemoveInstructor={handleDeleteTeacher}
      onVerifyInstructor={handleVerifyTeacher}
      onDenyInstructor={handleDeleteTeacher}
    />
  );

  const childrenView = (
    <ChildrenView
      classFilter={classFilter}
      onClassFilterChange={(event) => setClassFilter(event.target.value)}
      classOptions={classOptions}
      childSearch={childSearch}
      onSearchChange={(event) => setChildSearch(event.target.value)}
      groupedChildren={groupedChildren}
      teacherLookup={teacherLookup}
      onBack={handleBackToHome}
      onOpenChild={openChild}
      onCardKeyDown={handleCardKeyDown}
    />
  );

  let viewContent = null;
  switch (activeView) {
    case 'login':
      viewContent = (
        <LoginView
          loginForm={loginForm}
          onChange={handleLoginChange}
          onSubmit={handleLogin}
          onRegister={() => setView('register')}
        />
      );
      break;
    case 'home':
      viewContent = (
        <HomeView
          onChildren={() => setView('children')}
          onInstructors={() => setView('instructors')}
          onAvailability={() => setView('availability')}
          attendanceStartDate={attendanceStartDate}
          attendanceEndDate={attendanceEndDate}
          onAttendanceStart={(event) => setAttendanceStartDate(event.target.value)}
          onAttendanceEnd={(event) => setAttendanceEndDate(event.target.value)}
          onDownloadAttendance={downloadRecentAttendance}
        />
      );
      break;
    case 'availability':
      viewContent = (
        <AvailabilityView
          isLeadInstructor={isLeadInstructor}
          availabilityRuleDate={availabilityRuleDate}
          availabilityRuleOccasion={availabilityRuleOccasion}
          onRuleDateChange={(event) => setAvailabilityRuleDate(event.target.value)}
          onRuleOccasionChange={(event) => setAvailabilityRuleOccasion(event.target.value)}
          onAddAllowedDate={handleAddAllowedDate}
          isSavingAvailabilityRules={isSavingAvailabilityRules}
          sortedAllowedAvailabilityDates={sortedAllowedAvailabilityDates}
          formatAvailabilityRuleLabel={formatAvailabilityRuleLabel}
          onRemoveAllowedDate={handleRemoveAllowedDate}
          availabilityForm={availabilityForm}
          onAvailabilityFormChange={handleAvailabilityFormChange}
          onAvailabilityDateToggle={handleAvailabilityDateToggle}
          onAvailabilityDatesSet={handleAvailabilityDatesSet}
          availabilityEditId={availabilityEditId}
          onSubmitAvailability={handleAvailabilitySubmit}
          isSubmittingAvailability={isSubmittingAvailability}
          onResetAvailabilityForm={resetAvailabilityForm}
          selectableAvailabilityOptions={selectableAvailabilityOptions}
          myAvailability={myAvailability}
          formatAvailabilityStatus={formatAvailabilityStatus}
          onDeleteAvailability={handleAvailabilityDeleteAction}
          getDeleteLabel={getAvailabilityDeleteLabel}
          deleteRequest={deleteRequest}
          renderDeleteRequestForm={renderDeleteRequestForm}
          pendingAvailability={pendingAvailability}
          approvalReasons={approvalReasons}
          onApprovalReasonChange={(entryId, value) =>
            setApprovalReasons((prev) => ({ ...prev, [entryId]: value }))
          }
          onApproveAvailability={handleApproveAvailabilityEntry}
          onDeclineAvailability={handleDeclineAvailabilityEntry}
          approvedAvailability={approvedAvailability}
          approvedAvailabilityCalendar={approvedAvailabilityCalendar}
          onBack={() => setView('home')}
        />
      );
      break;
    case 'register':
      viewContent = (
        <RegisterView
          isSignedIn={Boolean(currentInstructor)}
          onBack={() => setView(currentInstructor ? 'instructors' : 'login')}
          registerInstructorForm={registerInstructorForm}
        />
      );
      break;
    case 'instructors':
      viewContent = instructorsView;
      break;
    case 'instructor':
      viewContent = selectedTeacher ? (
        <InstructorDetailView
          selectedTeacher={selectedTeacher}
          assignedChildren={assignedChildren}
          isLeadInstructor={isLeadInstructor}
          onBack={handleBackToInstructors}
          onVerify={handleVerifyTeacher}
          onDeny={handleDeleteTeacher}
          onOpenChild={openChild}
          onCardKeyDown={handleCardKeyDown}
          renderTeacherAvatar={renderTeacherAvatar}
        />
      ) : (
        instructorsView
      );
      break;
    case 'profile':
      viewContent = (
        <ProfileView
          profileForm={profileForm}
          passwordForm={passwordForm}
          isLeadInstructor={isLeadInstructor}
          onBack={handleBackToInstructorDetails}
          onProfileChange={handleProfileFormChange}
          onPasswordChange={handlePasswordFormChange}
          onProfileSubmit={handleProfileUpdate}
          onPasswordSubmit={handlePasswordUpdate}
        />
      );
      break;
    case 'children':
      viewContent = childrenView;
      break;
    case 'child':
      viewContent = selectedChild ? (
        <ChildView
          selectedChild={selectedChild}
          teacherLookup={teacherLookup}
          qrCodeValue={qrCodeValue}
          onBack={handleBackToChildren}
        />
      ) : (
        childrenView
      );
      break;
    default:
      viewContent = (
        <HomeView
          onChildren={() => setView('children')}
          onInstructors={() => setView('instructors')}
          onAvailability={() => setView('availability')}
          attendanceStartDate={attendanceStartDate}
          attendanceEndDate={attendanceEndDate}
          onAttendanceStart={(event) => setAttendanceStartDate(event.target.value)}
          onAttendanceEnd={(event) => setAttendanceEndDate(event.target.value)}
          onDownloadAttendance={downloadRecentAttendance}
        />
      );
      break;
  }

  return (
    <div className="app">
      <AppHeader
        verifiedCount={verifiedTeachers.length}
        childrenCount={records.children.length}
        onHome={() => setView(currentInstructor ? 'home' : 'login')}
        isRefreshing={isRefreshing}
      />
      <AppStatus
        currentInstructor={currentInstructor}
        isLoading={isLoading}
        error={error}
        supabaseStatus={supabaseStatus}
        onProfile={handleProfileOpen}
        onSignOut={handleSignOut}
        renderTeacherAvatar={renderTeacherAvatar}
      />
      {viewContent}
      <DeleteInstructorModal
        isOpen={deletePrompt.isOpen}
        teacherName={deletePrompt.teacherName}
        onCancel={closeDeletePrompt}
        onConfirm={confirmDeleteTeacher}
      />
    </div>
  );
}

export default App;
