import React from 'react';
import bcrypt from 'bcryptjs';
import { QRCodeCanvas } from 'qrcode.react';
import './App.css';
import { isSupabaseEnabled, supabase, supabasePublic } from './lib/supabaseClient';

const STORAGE_KEY = 'celebkids-records-v1';
const SIGNED_IN_KEY = 'celebkids-instructor-id';
const AVAILABILITY_RULES_KEY = 'celebkids-availability-rules-v1';
const EMPTY_RECORDS = { teachers: [], children: [] };
const INSTRUCTOR_PHOTOS_BUCKET =
  process.env.REACT_APP_INSTRUCTOR_PHOTOS_BUCKET || 'instructor-photos';

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

const mapTeacherFromDb = (teacher) => ({
  id: teacher.id,
  name: teacher.name || '',
  email: teacher.email || '',
  phone: teacher.phone || '',
  role: teacher.role || 'Instructor',
  createdAt: teacher.created_at || teacher.createdAt || new Date().toISOString(),
  verified: teacher.verified === true || teacher.verified === 1 || teacher.verified === 'true',
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
  startTime: availability.start_time || availability.startTime || '',
  endTime: availability.end_time || availability.endTime || '',
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
  start_time: availability.startTime || null,
  end_time: availability.endTime || null,
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
  const attendanceActive = true;
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
  const [isUpdatingChildStatus, setIsUpdatingChildStatus] = React.useState(false);
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
    startTime: '',
    endTime: '',
    notes: '',
    changeReason: '',
  });
  const [deleteRequest, setDeleteRequest] = React.useState({
    entry: null,
    reason: '',
  });
  const [updateRequest, setUpdateRequest] = React.useState({
    entry: null,
    reason: '',
  });
  const [availabilityEditOriginalDate, setAvailabilityEditOriginalDate] = React.useState('');
  const [approvalReasons, setApprovalReasons] = React.useState({});
  const [allowedAvailabilityDates, setAllowedAvailabilityDates] = React.useState([]);
  const [allowedAvailabilityDetails, setAllowedAvailabilityDetails] = React.useState([]);
  const [availabilityRuleDate, setAvailabilityRuleDate] = React.useState('');
  const [availabilityRuleOccasion, setAvailabilityRuleOccasion] = React.useState('');
  const [isSavingAvailabilityRules, setIsSavingAvailabilityRules] = React.useState(false);
  const [availabilityEditId, setAvailabilityEditId] = React.useState(null);
  const [isSubmittingAvailability, setIsSubmittingAvailability] = React.useState(false);

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
      .order('start_time', { ascending: true });
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
        supabasePublic.from('teachers').select('*').order('created_at', { ascending: false }),
        supabasePublic.from('children').select('*').order('created_at', { ascending: false }),
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
          setView('home');
        } else {
          localStorage.removeItem(SIGNED_IN_KEY);
        }
      }
      setIsLoading(false);
    };

    fetchRecords();

    return () => {
      isActive = false;
    };
  }, []);

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

  const handleChildCheckin = async (action) => {
    if (!attendanceActive) {
      setError('Attendance session is not active. Lead instructor must start the session.');
      return;
    }
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
      signedInUserId: action === 'sign_in'
        ? currentInstructor?.id || selectedChild.signedInUserId || ''
        : '',
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
          signed_in_user_id:
            action === 'sign_in' ? currentInstructor?.id || null : null,
        })
        .eq('id', selectedChild.id);
      if (statusError) {
        setError(
          `Signed ${action === 'sign_in' ? 'in' : 'out'}, but status update failed. ${statusError.message}`
        );
        setIsUpdatingChildStatus(false);
        return;
      }
      setStatusWithActor(
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
      setError('Name is required.');
      return;
    }
    if (!teacherForm.email.trim()) {
      setError('Email is required for verification.');
      return;
    }
    const emailValue = teacherForm.email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailValue)) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!teacherForm.role) {
      setError('Please select a role.');
      return;
    }
    const phoneValue = teacherForm.phone.trim();
    if (phoneValue) {
      if (/[A-Za-z]/.test(phoneValue)) {
        setError('Phone number should not contain letters.');
        return;
      }
      const onlyDigits = phoneValue.replace(/\D/g, '');
      if (phoneValue.startsWith('+')) {
        if (onlyDigits.length <= 11) {
          setError('Phone numbers with + must include more than 11 digits.');
          return;
        }
      } else if (onlyDigits.length !== 11) {
        setError('Phone number must be 11 digits or include a + with more than 11 digits.');
        return;
      }
    }
    if (!teacherForm.password || teacherForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (teacherForm.password !== teacherForm.password2) {
      setError('Passwords do not match.');
      return;
    }
  const normalizedEmail = emailValue.toLowerCase();
    const existingInstructor = records.teachers.find(
      (teacher) => teacher.email?.toLowerCase() === normalizedEmail
    );
    if (existingInstructor) {
      setError(
        'This instructor has already been registered. Please contact your Lead Instructor for approval or sign in.'
      );
      return;
    }
    const passwordHash = await bcrypt.hash(teacherForm.password, 10);
    const newTeacher = {
      id: createId(),
      name: teacherForm.name.trim(),
  email: teacherForm.email.trim(),
      phone: teacherForm.phone.trim(),
      role: teacherForm.role,
      passwordHash,
      createdAt: new Date().toISOString(),
      verified: false,
      photoUrl: '',
    };
    if (isSupabaseEnabled) {
      setError('');
      setSupabaseStatus('');
      const { data: existingData, error: existingError } = await supabase
        .from('teachers')
        .select('id')
        .ilike('email', normalizedEmail)
        .limit(1);
      if (existingError) {
        setError(`Unable to verify instructor. ${existingError.message}`);
        return;
      }
      if (existingData && existingData.length > 0) {
        setError(
          'This instructor has already been registered. Please contact your Lead Instructor for approval or sign in.'
        );
        return;
      }
      if (teacherForm.photoFile) {
        const fileExt = teacherForm.photoFile.name.split('.').pop();
        const filePath = `instructors/${newTeacher.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(INSTRUCTOR_PHOTOS_BUCKET)
          .upload(filePath, teacherForm.photoFile, {
            upsert: true,
            contentType: teacherForm.photoFile.type,
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
        newTeacher.photoUrl = publicData?.publicUrl || '';
      }

      const { error: insertError } = await supabase
        .from('teachers')
        .insert([mapTeacherToDb(newTeacher)]);
      if (insertError) {
        setError(`Unable to save teacher. ${insertError.message}`);
        return;
      }
      setStatusWithActor('Registration submitted. Awaiting Lead Instructor email verification.');
    }
    setRecords((prev) => ({
      ...prev,
      teachers: [newTeacher, ...prev.teachers],
    }));
    setTeacherForm({
      name: '',
      email: '',
      phone: '',
      role: 'Instructor',
      password: '',
      password2: '',
      photoFile: null,
    });
    setPendingVerification(true);
    setView(currentInstructor ? 'instructors' : 'login');
  };

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
          setStatusWithActor(
            'Instructor removed locally. No matching database record was found.'
          );
        } else {
          setStatusWithActor('Instructor removed from data base.');
        }
      } else {
        setStatusWithActor('Instructor removed from data base.');
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
  };

  const handleVerifyTeacher = async (teacherId) => {
    setError('');
    setSupabaseStatus('');
    if (isSupabaseEnabled) {
      const { error: updateError } = await supabase
        .from('teachers')
        .update({ verified: true })
        .eq('id', teacherId);
      if (updateError) {
        setError(
          `Unable to verify instructor. ${updateError.message} (Check RLS update policy on public.teachers.)`
        );
        return;
      }
    }
    setRecords((prev) => ({
      ...prev,
      teachers: prev.teachers.map((t) =>
        t.id === teacherId ? { ...t, verified: true } : t
      ),
    }));
    setStatusWithActor('Instructor verified.');
  };

  const pendingTeachers = React.useMemo(
    () => records.teachers.filter((teacher) => !teacher.verified),
    [records.teachers]
  );
  const verifiedTeachers = React.useMemo(
    () =>
      records.teachers
        .filter((teacher) => teacher.verified)
        .slice()
        .sort((a, b) => {
          const aLead = a.role?.toLowerCase().includes('lead') ? 1 : 0;
          const bLead = b.role?.toLowerCase().includes('lead') ? 1 : 0;
          if (aLead !== bLead) {
            return bLead - aLead;
          }
          return (a.name || '').localeCompare(b.name || '');
        }),
    [records.teachers]
  );

  const filteredVerifiedTeachers = React.useMemo(() => {
    if (!instructorSearch.trim()) {
      return verifiedTeachers;
    }
    const query = instructorSearch.trim().toLowerCase();
    return verifiedTeachers.filter((teacher) =>
      [teacher.name, teacher.email, teacher.phone, teacher.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [verifiedTeachers, instructorSearch]);

  const filteredPendingTeachers = React.useMemo(() => {
    if (!instructorSearch.trim()) {
      return pendingTeachers;
    }
    const query = instructorSearch.trim().toLowerCase();
    return pendingTeachers.filter((teacher) =>
      [teacher.name, teacher.email, teacher.phone, teacher.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [pendingTeachers, instructorSearch]);

  const isLeadInstructor = currentInstructor?.role?.toLowerCase().includes('lead');

  const approvedAvailability = React.useMemo(
    () => availabilityEntries.filter((entry) => entry.status === 'approved'),
    [availabilityEntries]
  );
  const approvedAvailabilityCalendar = React.useMemo(() => {
    const grouped = new Map();
    approvedAvailability.forEach((entry) => {
      const dateKey = entry.date || 'unscheduled';
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey).push(entry);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => {
        if (a === 'unscheduled') return 1;
        if (b === 'unscheduled') return -1;
        return new Date(a).getTime() - new Date(b).getTime();
      })
      .map(([dateKey, entries]) => {
        const dateObject =
          dateKey && dateKey !== 'unscheduled' ? new Date(`${dateKey}T00:00:00`) : null;
        const label =
          dateObject && !Number.isNaN(dateObject.getTime())
            ? dateObject.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : 'Unscheduled';
        const sortedEntries = [...entries].sort((first, second) => {
          const timeCompare = (first.startTime || '').localeCompare(second.startTime || '');
          if (timeCompare !== 0) {
            return timeCompare;
          }
          return (first.instructorName || '').localeCompare(second.instructorName || '');
        });
        return {
          dateKey,
          label,
          entries: sortedEntries,
        };
      });
  }, [approvedAvailability]);
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
      startTime: '',
      endTime: '',
      notes: '',
      changeReason: '',
    });
    setAvailabilityEditId(null);
    setAvailabilityEditOriginalDate('');
  }, []);

  const handleAvailabilitySubmit = async (event) => {
    event.preventDefault();
    if (!currentInstructor) {
      setError('Please sign in before submitting availability.');
      return;
    }
    if (!availabilityForm.date || !availabilityForm.startTime || !availabilityForm.endTime) {
      setError('Please provide date, start time, and end time for availability.');
      return;
    }
    if (availabilityEditId && availabilityEditOriginalDate) {
      if (availabilityForm.date !== availabilityEditOriginalDate) {
        setError('You can only edit the time for the same day.');
        return;
      }
    }
    if (availabilityEditId && !availabilityForm.changeReason.trim()) {
      setError('Please provide a reason for updating this availability.');
      return;
    }
    if (
      !isSundayDate(availabilityForm.date) &&
      !allowedAvailabilityDates.includes(availabilityForm.date)
    ) {
      setError('Availability is required every Sunday. Other days must be enabled by the lead instructor.');
      return;
    }
    setIsSubmittingAvailability(true);
    setError('');
    setSupabaseStatus('');
    const isEditing = Boolean(availabilityEditId);
    const newEntry = {
      id: availabilityEditId || createId(),
      instructorId: currentInstructor.id,
      instructorName: currentInstructor.name,
      date: availabilityForm.date,
      startTime: availabilityForm.startTime,
      endTime: availabilityForm.endTime,
      notes: availabilityForm.notes,
      changeReason: availabilityForm.changeReason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    try {
      if (isSupabaseEnabled) {
        if (isEditing) {
          const { data, error: updateError } = await supabase
            .from('availability')
            .update({
              date: newEntry.date,
              start_time: newEntry.startTime,
              end_time: newEntry.endTime,
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
            .insert([mapAvailabilityToDb(newEntry)])
            .select('*')
            .maybeSingle();
          if (insertError) {
            setError(`Unable to submit availability. ${insertError.message}`);
            return;
          }
          if (data) {
            setAvailabilityEntries((prev) => [mapAvailabilityFromDb(data), ...prev]);
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
                  startTime: newEntry.startTime,
                  endTime: newEntry.endTime,
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
          setAvailabilityEntries((prev) => [newEntry, ...prev]);
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

  const handleAvailabilityEdit = (entry) => {
    setAvailabilityForm({
      date: entry.date || '',
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
      notes: entry.notes || '',
      changeReason: entry.changeReason || '',
    });
    setAvailabilityEditId(entry.id);
    setAvailabilityEditOriginalDate(entry.date || '');
    setError('');
    setSupabaseStatus('');
  };

  const handleAvailabilityRequestEdit = async (entry, reasonOverride) => {
    setError('');
    setSupabaseStatus('');
    const requestReason = reasonOverride || updateRequest.reason;
    if (!requestReason || !requestReason.trim()) {
      setError('Please provide a reason for updating.');
      return;
    }
    if (isSupabaseEnabled) {
      const { data, error: updateError } = await supabase
        .from('availability')
        .update({
          status: 'pending',
          approved_by: null,
          approved_at: null,
          change_reason: requestReason.trim(),
        })
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();
      if (updateError) {
        setError(`Unable to request edit. ${updateError.message}`);
        return;
      }
      if (data) {
        const updated = mapAvailabilityFromDb(data);
        setAvailabilityEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? updated : item))
        );
        handleAvailabilityEdit(updated);
      }
    } else {
      const updated = {
        ...entry,
        status: 'pending',
        approvedBy: '',
        approvedAt: '',
        changeReason: requestReason.trim(),
      };
      setAvailabilityEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? updated : item))
      );
      handleAvailabilityEdit(updated);
    }
    setUpdateRequest({ entry: null, reason: '' });
    setSupabaseStatus('Edit request sent for approval.');
  };

  const handleAvailabilityReset = async (entry) => {
    setError('');
    setSupabaseStatus('');
    if (isSupabaseEnabled) {
      const { data, error: updateError } = await supabase
        .from('availability')
        .update({ status: 'pending', approved_by: null, approved_at: null })
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();
      if (updateError) {
        setError(`Unable to reset availability. ${updateError.message}`);
        return;
      }
      if (data) {
        setAvailabilityEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? mapAvailabilityFromDb(data) : item))
        );
      }
    } else {
      setAvailabilityEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? { ...item, status: 'pending', approvedBy: '', approvedAt: '' }
            : item
        )
      );
    }
    setSupabaseStatus('Availability reset for approval.');
  };

  const handleAvailabilityDelete = async (entry, reasonOverride) => {
    setError('');
    setSupabaseStatus('');
    if (entry.status !== 'approved' && isLeadInstructor) {
      if (isSupabaseEnabled) {
        const { data, error: deleteError } = await supabase
          .from('availability')
          .delete()
          .eq('id', entry.id)
          .select('id');
        if (deleteError) {
          setError(`Unable to delete availability. ${deleteError.message}`);
          return;
        }
        if (!data || data.length === 0) {
          setError(
            'Unable to delete availability. Check delete policy on public.availability.'
          );
          return;
        }
      }
      setAvailabilityEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setSupabaseStatus('Availability deleted.');
      return;
    }

    const deleteReason = reasonOverride || deleteRequest.reason;
    if (!deleteReason || !deleteReason.trim()) {
      setError('Delete reason is required.');
      return;
    }

    if (isSupabaseEnabled) {
      const { data, error: updateError } = await supabase
        .from('availability')
        .update({
          status: 'pending_delete',
          approved_by: null,
          approved_at: null,
          change_reason: deleteReason.trim(),
        })
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();
      if (updateError) {
        setError(`Unable to request delete. ${updateError.message}`);
        return;
      }
      if (data) {
        setAvailabilityEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? mapAvailabilityFromDb(data) : item))
        );
      }
    } else {
      setAvailabilityEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? { ...item, status: 'pending_delete', approvedBy: '', approvedAt: '' }
            : item
        )
      );
    }
    setAvailabilityEntries((prev) =>
      prev.map((item) =>
        item.id === entry.id ? { ...item, changeReason: deleteReason.trim() } : item
      )
    );
    setDeleteRequest({ entry: null, reason: '' });
    setSupabaseStatus('Delete request sent for approval.');
  };

  const handleAvailabilityStatus = async (entry, action, reasonOverride) => {
    if (!isLeadInstructor) {
      setError('Only the lead instructor can approve availability.');
      return;
    }
    setError('');
    setSupabaseStatus('');
    const approvalReason = reasonOverride || approvalReasons[entry.id] || '';
    if (action === 'declined' && !approvalReason.trim()) {
      setError('Please provide a reason for declining.');
      return;
    }
    const normalizedApprovalReason = action === 'declined' ? approvalReason.trim() : '';
    const isDeleteRequest = entry.status === 'pending_delete';
    const nextStatus = action === 'approved' ? 'approved' : 'declined';
    if (isSupabaseEnabled) {
      if (isDeleteRequest && action === 'approved') {
        const { data, error: deleteError } = await supabase
          .from('availability')
          .delete()
          .eq('id', entry.id)
          .select('id');
        if (deleteError) {
          setError(`Unable to delete availability. ${deleteError.message}`);
          return;
        }
        if (!data || data.length === 0) {
          setError(
            'Unable to delete availability. Check delete policy on public.availability.'
          );
          return;
        }
        setAvailabilityEntries((prev) => prev.filter((item) => item.id !== entry.id));
        setSupabaseStatus('Availability deleted.');
        return;
      }

      const { data, error: updateError } = await supabase
        .from('availability')
        .update({
          status: isDeleteRequest && action !== 'approved' ? 'approved' : nextStatus,
          approved_by: currentInstructor?.id || null,
          approved_at: new Date().toISOString(),
          approval_reason: normalizedApprovalReason || null,
        })
        .eq('id', entry.id)
        .select('*')
        .maybeSingle();
      if (updateError) {
        setError(`Unable to update availability. ${updateError.message}`);
        return;
      }
      if (data) {
        setAvailabilityEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? mapAvailabilityFromDb(data) : item))
        );
      }
    } else {
      if (isDeleteRequest && action === 'approved') {
        setAvailabilityEntries((prev) => prev.filter((item) => item.id !== entry.id));
        setSupabaseStatus('Availability deleted.');
        return;
      }
      setAvailabilityEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
              ...item,
              status: isDeleteRequest && action !== 'approved' ? 'approved' : nextStatus,
              approvedBy: currentInstructor?.id || '',
              approvedAt: new Date().toISOString(),
              approvalReason: normalizedApprovalReason,
            }
            : item
        )
      );
    }
    setApprovalReasons((prev) => {
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
    setSupabaseStatus(
      isDeleteRequest
        ? action === 'approved'
          ? 'Availability deleted.'
          : 'Delete request declined.'
        : `Availability ${nextStatus}.`
    );
  };

  const filteredChildren = React.useMemo(() => {
    if (!childSearch.trim()) {
      return records.children;
    }
    const query = childSearch.trim().toLowerCase();
    return records.children.filter((child) =>
      [child.name, child.guardianName, child.guardianContact, child.classCategory]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [records.children, childSearch]);

  const classOptions = React.useMemo(() => {
    const unique = new Set(
      records.children
        .map((child) => child.classCategory?.trim())
        .filter(Boolean)
    );
    const priority = ['TenderFoot', 'Lighttroopers', 'Tribe of Truth', 'Celeb Teens'];
    const sorted = Array.from(unique).sort((a, b) => {
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });
    return ['all', ...sorted];
  }, [records.children]);

  const classFilteredChildren = React.useMemo(() => {
    if (classFilter === 'all') {
      return filteredChildren;
    }
    return filteredChildren.filter(
      (child) => (child.classCategory?.trim() || 'Unassigned') === classFilter
    );
  }, [filteredChildren, classFilter]);

  const groupedChildren = React.useMemo(() => {
    const groups = classFilteredChildren.reduce((acc, child) => {
      const key = child.classCategory?.trim() || 'Unassigned';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(child);
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([category, children]) => ({
        category,
        children: children.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => {
        const priority = ['TenderFoot', 'Lighttroopers', 'Tribe of Truth', 'Celeb Teens'];
        const aIndex = priority.indexOf(a.category);
        const bIndex = priority.indexOf(b.category);
        if (aIndex !== -1 || bIndex !== -1) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }
        return a.category.localeCompare(b.category);
      });
  }, [classFilteredChildren]);

  const teacherLookup = React.useMemo(
    () =>
      records.teachers.reduce((acc, teacher) => {
        acc[teacher.id] = teacher.name;
        return acc;
      }, {}),
    [records.teachers]
  );

  const assignedChildren = React.useMemo(
    () =>
      selectedTeacher
        ? records.children.filter((child) => child.teacherId === selectedTeacher.id)
        : [],
    [records.children, selectedTeacher]
  );

  const qrCodeValue = selectedChild
    ? `${window.location.origin}${process.env.PUBLIC_URL || ''}/?scan=${
        selectedChild.qrCode || selectedChild.id
      }`
    : '';

  const activeView = !currentInstructor && view !== 'register' ? 'login' : view;

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

  return (
    <div className="app">
      {deletePrompt.isOpen && (
        <div className="modal__backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal__header">
              <h2>Remove instructor</h2>
            </div>
            <p className="modal__body">
              Remove {deletePrompt.teacherName}? Children assigned will become unassigned.
            </p>
            <div className="modal__actions">
              <button type="button" className="ghost" onClick={closeDeletePrompt}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={confirmDeleteTeacher}>
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="app__header">
        <button
          type="button"
          className="app__brand"
          onClick={() => setView('home')}
          aria-label="Go to home"
        >
          <img
            className="app__logo"
            src={`${process.env.PUBLIC_URL}/logo/Asset 199.svg`}
            alt="CCI logo"
          />
          <div>
            <p className="app__eyebrow">CelebKids Admin</p>
            <h1>Instructor Dashboard</h1>
            <p className="app__subtitle">In Christ For Christ With Joy</p>
          </div>
        </button>
        <div className="app__stats">
          <div>
            <span className="stat__label">Verified instructors</span>
            <span className="stat__value">{verifiedTeachers.length}</span>
          </div>
          <div>
            <span className="stat__label">Children</span>
            <span className="stat__value">{records.children.length}</span>
          </div>
        </div>
      </header>

      <div className="app__status">
        {currentInstructor && (
          <div className="banner banner--signedin">
            <div className="signedin__content">
              {renderTeacherAvatar(currentInstructor, 40)}
              <div>
                <p className="signedin__label">Signed in</p>
                <p className="signedin__name">{currentInstructor.name}</p>
                <p className="signedin__role">
                  {currentInstructor.role || 'Instructor'}
                </p>
              </div>
            </div>
            <div className="signedin__actions">
              <button
                type="button"
                className="ghost signedin__action"
                onClick={() => {
                  if (currentInstructor) {
                    setSelectedTeacher(currentInstructor);
                  }
                  setView('profile');
                }}
              >
                Update profile
              </button>
              <button type="button" className="ghost signedin__action" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </div>
        )}
        {isLoading && <p className="banner banner--info">Loading records…</p>}
        {error && <p className="banner banner--error">{error}</p>}
        {!error && supabaseStatus && <p className="banner banner--success">{supabaseStatus}</p>}
      </div>

      {activeView === 'login' ? (
        <section className="panel">
          <div className="panel__heading">
            <h2>Instructor login</h2>
          </div>
          <form className="form" onSubmit={handleLogin}>
            <div className="form__grid">
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  placeholder="instructor@email.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  placeholder="Enter your password"
                  required
                />
              </label>
            </div>
            <button type="submit" className="primary">
              Sign in
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setView('register')}
            >
              Register instructor
            </button>
          </form>
        </section>
      ) : activeView === 'home' ? (
        <section className="panel panel--home">
          <div className="panel__heading">
            <h2>Welcome</h2>
          </div>
          <div className="home__actions">
            <button
              type="button"
              className="primary home__button"
              onClick={() => setView('children')}
            >
              <span>
                <strong>Children</strong>
                <span className="home__hint">View, search, and manage child details</span>
              </span>
              <span className="home__arrow">→</span>
            </button>
            <button
              type="button"
              className="ghost home__button"
              onClick={() => setView('instructors')}
            >
              <span>
                <strong>Instructors</strong>
                <span className="home__hint">Review, verify, and register instructors</span>
              </span>
              <span className="home__arrow">→</span>
            </button>
            <button
              type="button"
              className="ghost home__button"
              onClick={() => setView('availability')}
            >
              <span>
                <strong>Availability</strong>
                <span className="home__hint">Submit and review availability</span>
              </span>
              <span className="home__arrow">→</span>
            </button>
          </div>
          <div className="attendance-controls">
            <div className="attendance-controls__dates">
              <label>
                Attendance start
                <input
                  type="date"
                  value={attendanceStartDate}
                  onChange={(event) => setAttendanceStartDate(event.target.value)}
                />
              </label>
              <label>
                Attendance end
                <input
                  type="date"
                  value={attendanceEndDate}
                  onChange={(event) => setAttendanceEndDate(event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="ghost attendance-controls__download"
              onClick={downloadRecentAttendance}
            >
              Download attendance
            </button>
          </div>
        </section>
      ) : activeView === 'availability' ? (
        <section className="panel">
          <div className="panel__heading">
            <div>
              <h2>Availability</h2>
              <p className="panel__intro">
                Submit your availability and view the approved schedule.
              </p>
            </div>
            <button type="button" className="ghost" onClick={() => setView('home')}>
              ← Back
            </button>
          </div>
          <div className="availability-rules">
            <div>
              <h3>Availability rules</h3>
              <p className="muted">
                Availability is required every Sunday for all instructors. Other days must be enabled by the lead instructor.
              </p>
            </div>
            {isLeadInstructor && (
              <div className="availability-rules__controls">
                <label>
                  Allow extra date
                  <input
                    type="date"
                    value={availabilityRuleDate}
                    onChange={(event) => setAvailabilityRuleDate(event.target.value)}
                  />
                </label>
                <label>
                  Occasion
                  <input
                    type="text"
                    value={availabilityRuleOccasion}
                    onChange={(event) => setAvailabilityRuleOccasion(event.target.value)}
                    placeholder="e.g. Special service"
                  />
                </label>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleAddAllowedDate}
                  disabled={isSavingAvailabilityRules}
                >
                  {isSavingAvailabilityRules ? 'Saving…' : 'Add date'}
                </button>
              </div>
            )}
            {sortedAllowedAvailabilityDates.length === 0 ? (
              <p className="empty">No extra dates enabled yet.</p>
            ) : (
              <div className="availability-rules__list">
                {sortedAllowedAvailabilityDates.map((dateValue) => (
                  <div key={dateValue} className="availability-rules__chip">
                    <span>
                      {formatAvailabilityDateLabel(dateValue)}
                      {(() => {
                        const occasion = allowedAvailabilityDetailsByDate.get(dateValue)?.occasion;
                        if (occasion) {
                          return ` — ${occasion}`;
                        }
                        if (isSundayDate(dateValue)) {
                          return ' — Sunday service';
                        }
                        return '';
                      })()}
                    </span>
                    {isLeadInstructor && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleRemoveAllowedDate(dateValue)}
                        disabled={isSavingAvailabilityRules}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <form className="form availability-form" onSubmit={handleAvailabilitySubmit}>
            <div className="form__grid">
              <label>
                Date
                <select
                  name="date"
                  value={availabilityForm.date}
                  onChange={handleAvailabilityFormChange}
                  disabled={Boolean(availabilityEditId)}
                  required
                >
                  <option value="">Select a day</option>
                  {selectableAvailabilityOptions.map((option) => (
                    <option key={option.date} value={option.date}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start time
                <input
                  type="time"
                  name="startTime"
                  value={availabilityForm.startTime}
                  onChange={handleAvailabilityFormChange}
                  required
                />
              </label>
              <label>
                End time
                <input
                  type="time"
                  name="endTime"
                  value={availabilityForm.endTime}
                  onChange={handleAvailabilityFormChange}
                  required
                />
              </label>
              <label className="form__full">
                Notes (optional)
                <textarea
                  name="notes"
                  value={availabilityForm.notes}
                  onChange={handleAvailabilityFormChange}
                  placeholder="Add any extra details"
                />
              </label>
              {availabilityEditId && (
                <label className="form__full">
                  Update reason
                  <textarea
                    name="changeReason"
                    value={availabilityForm.changeReason}
                    onChange={handleAvailabilityFormChange}
                    placeholder="Why are you updating this availability?"
                    required
                  />
                </label>
              )}
            </div>
            <div className="panel__actions">
              <button type="submit" className="primary" disabled={isSubmittingAvailability}>
                {isSubmittingAvailability
                  ? 'Submitting…'
                  : availabilityEditId
                    ? 'Update availability'
                    : 'Submit availability'}
              </button>
              {availabilityEditId && (
                <button type="button" className="ghost" onClick={resetAvailabilityForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <div className="availability-section">
            <h3>My submissions</h3>
            {myAvailability.length === 0 ? (
              <p className="empty">No availability submitted yet.</p>
            ) : (
              <div className="list">
                {myAvailability.map((entry) => (
                  <div key={entry.id} className="card availability-card">
                    <div>
                      <div className="availability-card__title">
                        <strong>{entry.date}</strong>
                        <span
                          className={`availability-status availability-status--${entry.status}`}
                        >
                          {formatAvailabilityStatus(entry.status)}
                        </span>
                      </div>
                      <p className="muted">
                        {entry.startTime} - {entry.endTime}
                      </p>
                      {entry.approvalReason && (
                        <p className="muted">Disapproval reason: {entry.approvalReason}</p>
                      )}
                      {entry.changeReason && (
                        <p className="muted">Update reason: {entry.changeReason}</p>
                      )}
                      {entry.notes && <p className="muted">{entry.notes}</p>}
                    </div>
                    <div className="panel__actions availability-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          entry.status === 'approved' && !isLeadInstructor
                            ? setUpdateRequest({ entry, reason: entry.changeReason || '' })
                            : handleAvailabilityEdit(entry)
                        }
                        disabled={entry.status === 'pending_delete'}
                      >
                        {entry.status === 'approved' && !isLeadInstructor ? 'Request edit' : 'Edit'}
                      </button>
                      {entry.status === 'pending' && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => handleAvailabilityReset(entry)}
                        >
                          Reset approval
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          entry.status !== 'approved' && isLeadInstructor
                            ? handleAvailabilityDelete(entry, 'Lead deletion')
                            : setDeleteRequest({ entry, reason: entry.changeReason || '' })
                        }
                      >
                        {entry.status === 'approved' || !isLeadInstructor
                          ? 'Request delete'
                          : 'Delete'}
                      </button>
                    </div>
                    {deleteRequest.entry?.id === entry.id && (
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
                    )}
                    {updateRequest.entry?.id === entry.id && (
                      <div className="availability-update">
                        <label>
                          Update reason
                          <textarea
                            value={updateRequest.reason}
                            onChange={(event) =>
                              setUpdateRequest((prev) => ({
                                ...prev,
                                reason: event.target.value,
                              }))
                            }
                            placeholder="Why should this availability be updated?"
                            required
                          />
                        </label>
                        <div className="panel__actions">
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setUpdateRequest({ entry: null, reason: '' })}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="primary"
                            onClick={() =>
                              handleAvailabilityRequestEdit(entry, updateRequest.reason)
                            }
                          >
                            Submit update request
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isLeadInstructor && (
            <div className="availability-section">
              <h3>Pending approvals</h3>
              {pendingAvailability.length === 0 ? (
                <p className="empty">No pending availability.</p>
              ) : (
                <div className="list">
                  {pendingAvailability.map((entry) => (
                    <div key={entry.id} className="card availability-card">
                      <div>
                        <div className="availability-card__title">
                          <strong>{entry.instructorName || 'Instructor'}</strong>
                          <span
                            className={`availability-status availability-status--${entry.status}`}
                          >
                            {formatAvailabilityStatus(entry.status)}
                          </span>
                        </div>
                        <p className="muted">
                          {entry.date} · {entry.startTime} - {entry.endTime}
                        </p>
                        {entry.approvalReason && (
                          <p className="muted">Disapproval reason: {entry.approvalReason}</p>
                        )}
                        {entry.changeReason && (
                          <p className="muted">Update reason: {entry.changeReason}</p>
                        )}
                        {entry.notes && <p className="muted">{entry.notes}</p>}
                      </div>
                      <div className="availability-approval">
                        <label>
                          Disapproval reason (required to decline)
                          <textarea
                            value={approvalReasons[entry.id] || ''}
                            onChange={(event) =>
                              setApprovalReasons((prev) => ({
                                ...prev,
                                [entry.id]: event.target.value,
                              }))
                            }
                            placeholder="Why are you declining this availability?"
                            required
                          />
                        </label>
                      </div>
                      <div className="panel__actions">
                        {entry.status === 'pending_delete' ? (
                          <>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() =>
                                handleAvailabilityStatus(entry, 'approved', approvalReasons[entry.id])
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() =>
                                handleAvailabilityStatus(entry, 'declined', approvalReasons[entry.id])
                              }
                            >
                              Deny
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() =>
                                handleAvailabilityStatus(entry, 'approved', approvalReasons[entry.id])
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() =>
                                handleAvailabilityStatus(entry, 'declined', approvalReasons[entry.id])
                              }
                            >
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="availability-section">
            <h3>Approved availability calendar</h3>
            {approvedAvailability.length === 0 ? (
              <p className="empty">No approved availability yet.</p>
            ) : (
              <div className="availability-calendar">
                {approvedAvailabilityCalendar.map((day) => (
                  <div key={day.dateKey} className="availability-day">
                    <div className="availability-day__header">
                      <strong>{day.label}</strong>
                      {day.dateKey !== 'unscheduled' && (
                        <span className="muted">{day.dateKey}</span>
                      )}
                    </div>
                    <div className="availability-day__slots">
                      {day.entries.map((entry) => (
                        <div key={entry.id} className="availability-slot">
                          <div>
                            <div className="availability-slot__name">
                              {entry.instructorName || 'Instructor'}
                            </div>
                            <div className="availability-slot__time">
                              {entry.startTime && entry.endTime
                                ? `${entry.startTime} - ${entry.endTime}`
                                : 'Time not set'}
                            </div>
                          </div>
                          {entry.notes && (
                            <div className="availability-slot__notes">{entry.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : activeView === 'register' ? (
        <section className="panel panel--register">
          <div className="panel__heading">
            <div>
              <h2>Register instructor</h2>
              <p className="panel__intro">
                Provide instructor details and a secure password to create the account.
              </p>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={currentInstructor ? handleBackToInstructors : () => setView('login')}
            >
              {currentInstructor ? 'Back to instructors' : 'Back to login'}
            </button>
          </div>
          {registerInstructorForm}
        </section>
      ) : activeView === 'instructor' && selectedTeacher ? (
        <section className="panel">
          <div className="panel__heading">
            <h2>{selectedTeacher.name}</h2>
            <div className="panel__actions">
              <button type="button" className="ghost" onClick={handleBackToInstructors}>
                Back to instructors
              </button>
              {!selectedTeacher.verified && isLeadInstructor && (
                <>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleVerifyTeacher(selectedTeacher.id)}
                  >
                    Verify instructor
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => handleDeleteTeacher(selectedTeacher.id)}
                  >
                    Deny registration
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="card card--stack">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {renderTeacherAvatar(selectedTeacher, 56)}
              <div>
                <h3>{selectedTeacher.role}</h3>
                <p className="muted">
                  {selectedTeacher.verified ? 'Verified instructor' : 'Pending verification'}
                </p>
              </div>
            </div>
            <div className="meta">
              <span>Email: {selectedTeacher.email || 'No email provided'}</span>
              <span>Phone: {selectedTeacher.phone || 'No phone provided'}</span>
              <span>
                Joined:{' '}
                {selectedTeacher.createdAt
                  ? new Date(selectedTeacher.createdAt).toLocaleDateString()
                  : 'Unknown'}
              </span>
            </div>
          </div>
          <div className="panel__sublist">
            <h3>Assigned children</h3>
            {assignedChildren.length === 0 ? (
              <p className="empty">No children assigned to this instructor yet.</p>
            ) : (
              assignedChildren.map((child) => (
                <article
                  key={child.id}
                  className="card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openChild(child)}
                  onKeyDown={(event) => handleCardKeyDown(event, () => openChild(child))}
                >
                  <div>
                    <h4>{child.name}</h4>
                    <p className="muted">Class: {child.classCategory || 'Unassigned'}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : activeView === 'profile' && selectedTeacher && currentInstructor?.id === selectedTeacher.id ? (
        <section className="panel panel--register">
          <div className="panel__heading">
            <div>
              <h2>Update profile</h2>
              <p className="panel__intro">Edit your contact details, role, or photo.</p>
            </div>
            <button type="button" className="ghost" onClick={handleBackToInstructorDetails}>
              Back to details
            </button>
          </div>
          <div className="panel__sublist">
            <form className="form" onSubmit={handleProfileUpdate}>
              <div className="form__grid">
                <label>
                  Name*
                  <input
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileFormChange}
                    required
                  />
                </label>
                <label>
                  Role
                  <select
                    name="role"
                    value={profileForm.role}
                    onChange={handleProfileFormChange}
                    disabled={isLeadInstructor}
                  >
                    <option>Lead Instructor</option>
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
                    value={profileForm.email}
                    onChange={handleProfileFormChange}
                    required
                  />
                </label>
                <label>
                  Phone
                  <input
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileFormChange}
                  />
                </label>
                <label className="form__full">
                  Update photo (optional)
                  <input
                    name="photoFile"
                    type="file"
                    accept="image/*"
                    onChange={handleProfileFormChange}
                  />
                </label>
              </div>
              <button type="submit" className="primary">
                Save profile changes
              </button>
            </form>
          </div>
          <div className="panel__sublist">
            <h3>Change password</h3>
            <form className="form" onSubmit={handlePasswordUpdate}>
              <div className="form__grid">
                <label>
                  Current password
                  <input
                    name="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordFormChange}
                    required
                  />
                </label>
                <label>
                  New password
                  <input
                    name="nextPassword"
                    type="password"
                    value={passwordForm.nextPassword}
                    onChange={handlePasswordFormChange}
                    required
                    minLength={6}
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    name="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFormChange}
                    required
                    minLength={6}
                  />
                </label>
              </div>
              <button type="submit" className="primary">
                Update password
              </button>
            </form>
          </div>
        </section>
      ) : activeView === 'child' && selectedChild ? (
        <section className="panel">
          <div className="panel__heading">
            <h2>{selectedChild.name}</h2>
            <div className="panel__actions">
              <button type="button" className="ghost" onClick={handleBackToChildren}>
                Back to children
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
            <div>
              <div className="meta">
                <span>Class: {selectedChild.classCategory || 'Unassigned'}</span>
                <span>Guardian: {selectedChild.guardianName || 'No guardian listed'}</span>
                <span>Contact: {selectedChild.guardianContact || 'No contact listed'}</span>
                <span>Assigned: {teacherLookup[selectedChild.teacherId] || 'Unassigned'}</span>
              </div>
              <p className="muted">Last status: {selectedChild.lastStatus || 'No activity yet'}</p>
            </div>
            <div className="qr-code">
              <QRCodeCanvas value={qrCodeValue} size={180} includeMargin />
              <p className="muted">Scan to open child record.</p>
            </div>
          </div>
        </section>
      ) : activeView === 'instructors' ? (
        <div className="app__main">
          <section className="panel">
            <div className="panel__heading">
              <h2>Instructors</h2>
              <div className="panel__actions">
                <input
                  type="search"
                  value={instructorSearch}
                  onChange={(event) => setInstructorSearch(event.target.value)}
                  placeholder="Search instructors"
                  aria-label="Search instructors"
                />
                <button type="button" className="ghost" onClick={handleBackToHome} aria-label="Back">
                  ←
                </button>
              </div>
            </div>
            <div className="list">
              {filteredVerifiedTeachers.length === 0 ? (
                <p className="empty">No verified instructors yet. Add your first instructor above.</p>
              ) : (
                filteredVerifiedTeachers.map((teacher) => (
                  <article
                    key={teacher.id}
                    className="card"
                    role="button"
                    tabIndex={0}
                    onClick={() => openInstructor(teacher)}
                    onKeyDown={(event) => handleCardKeyDown(event, () => openInstructor(teacher))}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {renderTeacherAvatar(teacher)}
                        <div>
                          <h3>{teacher.name}</h3>
                          <p className="muted">{teacher.role}</p>
                        </div>
                      </div>
                      <div className="meta">
                        <span>{teacher.email || 'No email'}</span>
                        <span>{teacher.phone || 'No phone'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isLeadInstructor &&
                        !teacher.role?.toLowerCase().includes('lead') && (
                          <button
                            type="button"
                            className="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteTeacher(teacher.id);
                            }}
                          >
                            Remove
                          </button>
                        )}
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="panel__sublist">
              <h3>Pending Instructor Verifications</h3>
              {filteredPendingTeachers.length === 0 ? (
                <p className="empty">No pending verifications.</p>
              ) : (
                filteredPendingTeachers.map((teacher) => (
                  <article
                    key={teacher.id}
                    className="card"
                    role="button"
                    tabIndex={0}
                    onClick={() => openInstructor(teacher)}
                    onKeyDown={(event) => handleCardKeyDown(event, () => openInstructor(teacher))}
                  >
                    <div>
                      <h4>{teacher.name}</h4>
                      <p className="muted">{teacher.role}</p>
                      <span>{teacher.email}</span>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {isLeadInstructor && (
                          <>
                            <button
                              type="button"
                              className="primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleVerifyTeacher(teacher.id);
                              }}
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteTeacher(teacher.id);
                              }}
                            >
                              Deny
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : activeView === 'children' ? (
        <section className="panel">
          <div className="panel__heading">
            <h2>Celebkids / Teens</h2>
            <div className="panel__actions">
              <button type="button" className="ghost" onClick={handleBackToHome} aria-label="Back">
                ←
              </button>
              <select
                className="search"
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                aria-label="Filter by class"
              >
                {classOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All classes' : option}
                  </option>
                ))}
              </select>
              <input
                className="search"
                type="search"
                placeholder="Search children"
                value={childSearch}
                onChange={(event) => setChildSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="list">
            {groupedChildren.length === 0 ? (
              <p className="empty">No children found.</p>
            ) : (
              groupedChildren.map((group) => (
                <div key={group.category} className="list-section">
                  <h3 className="list-section__title">{group.category}</h3>
                  <div className="list">
                    {group.children.map((child) => (
                      <article
                        key={child.id}
                        className={`card${child.signedIn ? ' card--signedin' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openChild(child)}
                        onKeyDown={(event) => handleCardKeyDown(event, () => openChild(child))}
                      >
                        <div>
                          <div className="card__title">
                            <h4>{child.name}</h4>
                            {child.signedIn && (
                              <span className="badge badge--signedin">Signed in</span>
                            )}
                          </div>
                          <div className="meta">
                            <span>Age: {child.age || 'Not provided'}</span>
                            <span>Guardian: {child.guardianName || 'No guardian listed'}</span>
                            <span>Contact: {child.guardianContact || 'No contact listed'}</span>
                            <span>Assigned: {teacherLookup[child.teacherId] || 'Unassigned'}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default App;
