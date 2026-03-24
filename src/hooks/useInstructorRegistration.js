import { useCallback } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const useInstructorRegistration = ({
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
}) =>
  useCallback(
    async (event) => {
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
      if (!EMAIL_PATTERN.test(emailValue)) {
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

      const hashedPassword = await bcrypt.hash(teacherForm.password, 10);

      const newTeacher = {
        id: createId(),
        name: teacherForm.name.trim(),
        email: emailValue.trim(),
        phone: teacherForm.phone.trim(),
        role: teacherForm.role,
        passwordHash: hashedPassword,
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
    },
    [
      teacherForm,
      currentInstructor,
      records.teachers,
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
    ]
  );

export default useInstructorRegistration;
