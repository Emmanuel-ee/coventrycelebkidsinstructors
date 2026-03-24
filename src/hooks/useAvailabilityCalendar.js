import { useMemo } from 'react';

const useAvailabilityCalendar = (availabilityEntries) => {
  const approvedAvailability = useMemo(
    () => availabilityEntries.filter((entry) => entry.status === 'approved'),
    [availabilityEntries]
  );

  const approvedAvailabilityCalendar = useMemo(() => {
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

  return { approvedAvailability, approvedAvailabilityCalendar };
};

export default useAvailabilityCalendar;
