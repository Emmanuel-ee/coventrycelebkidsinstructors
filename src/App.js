import React from 'react';
import bcrypt from 'bcryptjs';
import { QRCodeCanvas } from 'qrcode.react';
import './App.css';
import { isSupabaseEnabled, supabase } from './lib/supabaseClient';

const STORAGE_KEY = 'celebkids-records-v1';
const SIGNED_IN_KEY = 'celebkids-instructor-id';
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
  const [deletePrompt, setDeletePrompt] = React.useState({
    isOpen: false,
    teacherId: '',
    teacherName: '',
  });

  React.useEffect(() => {
    if (!isSupabaseEnabled) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }
  }, [records]);

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
      const { data, error: fetchError } = await supabase
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
    if (!teacherForm.password || teacherForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (teacherForm.password !== teacherForm.password2) {
      setError('Passwords do not match.');
      return;
    }
    const normalizedEmail = teacherForm.email.trim().toLowerCase();
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

      const resolveDeleteEmail = async () => {
        if (!teacherToRemove?.email) {
          setError('Unable to remove teacher. Missing instructor email.');
          return null;
        }
        const normalizedEmail = teacherToRemove.email.trim().toLowerCase();
        let matchResponse = await supabase
          .from('teachers')
          .select('email')
          .ilike('email', normalizedEmail)
          .limit(1);
        if (matchResponse.error) {
          setError(
            `Unable to remove teacher (${normalizedEmail}). ${matchResponse.error.message}`
          );
          return null;
        }
        if (!matchResponse.data || matchResponse.data.length === 0) {
          matchResponse = await supabase
            .from('teachers')
            .select('email')
            .ilike('email', `${normalizedEmail}%`)
            .limit(1);
        }
        const matchEmail = matchResponse.data?.[0]?.email;
        if (!matchEmail) {
          const { data: emailList } = await supabase
            .from('teachers')
            .select('email')
            .limit(5);
          const sampleEmails = (emailList || [])
            .map((item) => item.email)
            .filter(Boolean)
            .join(', ');
          setError(
            `Unable to remove teacher (${normalizedEmail}). No database record matched that email.${
              sampleEmails ? ` Sample emails: ${sampleEmails}` : ''
            }`
          );
          return null;
        }
        return matchEmail;
      };

      const clearedChildren = await clearChildAssignments();
      if (!clearedChildren) {
        return;
      }
      const removedPhoto = await removeInstructorPhoto();
      if (!removedPhoto) {
        return;
      }
      const matchEmail = await resolveDeleteEmail();
      if (!matchEmail) {
        return;
      }
      const deleteResponse = await supabase
        .from('teachers')
        .delete()
        .eq('email', matchEmail)
        .select('email');
      if (deleteResponse.error) {
        setError(
          `Unable to remove teacher (${matchEmail}). ${deleteResponse.error.message}`
        );
        return;
      }
      if ((deleteResponse.data || []).length === 0) {
        setError(
          `Unable to remove teacher (${matchEmail}). No database record matched that email.`
        );
        return;
      }
      setStatusWithActor('Instructor removed from Supabase.');
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

  const isLeadInstructor = currentInstructor?.role?.toLowerCase().includes('lead');

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
                <article key={child.id} className="card">
                  <div>
                    <h4>{child.name}</h4>
                    <p className="muted">Class: {child.classCategory || 'Unassigned'}</p>
                  </div>
                  <button type="button" className="ghost" onClick={() => openChild(child)}>
                    View child
                  </button>
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
                <button type="button" className="ghost" onClick={handleBackToHome} aria-label="Back">
                  ←
                </button>
              </div>
            </div>
            <div className="list">
              {verifiedTeachers.length === 0 ? (
                <p className="empty">No verified instructors yet. Add your first instructor above.</p>
              ) : (
                verifiedTeachers.map((teacher) => (
                  <article key={teacher.id} className="card">
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
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => openInstructor(teacher)}
                      >
                        View details
                      </button>
                      {isLeadInstructor &&
                        !teacher.role?.toLowerCase().includes('lead') && (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => handleDeleteTeacher(teacher.id)}
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
              {pendingTeachers.length === 0 ? (
                <p className="empty">No pending verifications.</p>
              ) : (
                pendingTeachers.map((teacher) => (
                  <article key={teacher.id} className="card">
                    <div>
                      <h4>{teacher.name}</h4>
                      <p className="muted">{teacher.role}</p>
                      <span>{teacher.email}</span>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => openInstructor(teacher)}
                        >
                          View details
                        </button>
                        {isLeadInstructor && (
                          <>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => handleVerifyTeacher(teacher.id)}
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => handleDeleteTeacher(teacher.id)}
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
            <h2>Children</h2>
            <div className="panel__actions">
              <button type="button" className="ghost" onClick={handleBackToHome} aria-label="Back">
                ←
              </button>
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
            {filteredChildren.length === 0 ? (
              <p className="empty">No children found.</p>
            ) : (
              filteredChildren.map((child) => (
                <article key={child.id} className="card">
                  <div>
                    <h3>{child.name}</h3>
                    <p className="muted">Class: {child.classCategory || 'Unassigned'}</p>
                    <div className="meta">
                      <span>Guardian: {child.guardianName || 'No guardian listed'}</span>
                      <span>Contact: {child.guardianContact || 'No contact listed'}</span>
                      <span>Assigned: {teacherLookup[child.teacherId] || 'Unassigned'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => openChild(child)}
                  >
                    View details
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default App;
