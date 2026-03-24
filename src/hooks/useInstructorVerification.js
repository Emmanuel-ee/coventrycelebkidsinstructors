import { useCallback } from 'react';

const useInstructorVerification = ({
  isSupabaseEnabled,
  supabase,
  setError,
  setSupabaseStatus,
  setRecords,
  setStatusWithActor,
}) =>
  useCallback(
    async (teacherId) => {
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
        teachers: prev.teachers.map((teacher) =>
          teacher.id === teacherId ? { ...teacher, verified: true } : teacher
        ),
      }));
      setStatusWithActor('Instructor verified.');
    },
    [isSupabaseEnabled, supabase, setError, setSupabaseStatus, setRecords, setStatusWithActor]
  );

export default useInstructorVerification;
