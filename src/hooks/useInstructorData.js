import { useMemo } from 'react';

const useInstructorData = ({ teachers, instructorSearch, currentInstructor }) => {
  const pendingTeachers = useMemo(
    () => teachers.filter((teacher) => !teacher.verified),
    [teachers]
  );

  const verifiedTeachers = useMemo(
    () =>
      teachers
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
    [teachers]
  );

  const filteredVerifiedTeachers = useMemo(() => {
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

  const filteredPendingTeachers = useMemo(() => {
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

  return {
    pendingTeachers,
    verifiedTeachers,
    filteredVerifiedTeachers,
    filteredPendingTeachers,
    isLeadInstructor,
  };
};

export default useInstructorData;
