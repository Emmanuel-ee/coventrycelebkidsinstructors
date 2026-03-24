import { useMemo } from 'react';

const CLASS_PRIORITY = ['TenderFoot', 'Lighttroopers', 'Tribe of Truth', 'Celeb Teens'];

const useChildrenData = ({ teachers, children, childSearch, classFilter, selectedTeacher }) => {
  const filteredChildren = useMemo(() => {
    if (!childSearch.trim()) {
      return children;
    }
    const query = childSearch.trim().toLowerCase();
    return children.filter((child) =>
      [child.name, child.guardianName, child.guardianContact, child.classCategory]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [children, childSearch]);

  const classOptions = useMemo(() => {
    const unique = new Set(children.map((child) => child.classCategory?.trim()).filter(Boolean));
    const sorted = Array.from(unique).sort((a, b) => {
      const aIndex = CLASS_PRIORITY.indexOf(a);
      const bIndex = CLASS_PRIORITY.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });
    return ['all', ...sorted];
  }, [children]);

  const classFilteredChildren = useMemo(() => {
    if (classFilter === 'all') {
      return filteredChildren;
    }
    return filteredChildren.filter(
      (child) => (child.classCategory?.trim() || 'Unassigned') === classFilter
    );
  }, [filteredChildren, classFilter]);

  const groupedChildren = useMemo(() => {
    const groups = classFilteredChildren.reduce((acc, child) => {
      const key = child.classCategory?.trim() || 'Unassigned';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(child);
      return acc;
    }, {});
    return Object.entries(groups)
      .map(([category, items]) => ({
        category,
        children: items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => {
        const aIndex = CLASS_PRIORITY.indexOf(a.category);
        const bIndex = CLASS_PRIORITY.indexOf(b.category);
        if (aIndex !== -1 || bIndex !== -1) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        }
        return a.category.localeCompare(b.category);
      });
  }, [classFilteredChildren]);

  const teacherLookup = useMemo(
    () =>
      teachers.reduce((acc, teacher) => {
        acc[teacher.id] = teacher.name;
        return acc;
      }, {}),
    [teachers]
  );

  const assignedChildren = useMemo(
    () =>
      selectedTeacher
        ? children.filter((child) => child.teacherId === selectedTeacher.id)
        : [],
    [children, selectedTeacher]
  );

  return {
    filteredChildren,
    classOptions,
    groupedChildren,
    teacherLookup,
    assignedChildren,
  };
};

export default useChildrenData;
