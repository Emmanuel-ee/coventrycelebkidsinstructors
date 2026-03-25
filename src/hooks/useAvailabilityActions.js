import { useCallback } from 'react';

const useAvailabilityActions = ({
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
}) => {
  const deleteAvailability = useCallback(
    async (entry, reasonOverride) => {
      setError('');
      setSupabaseStatus('');
      if (entry.status !== 'approved') {
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
            setError('Unable to delete availability. Check delete policy on public.availability.');
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
    },
    [
      deleteRequest.reason,
      isSupabaseEnabled,
      supabase,
      mapAvailabilityFromDb,
      setAvailabilityEntries,
      setError,
      setSupabaseStatus,
      setDeleteRequest,
    ]
  );

  const updateStatus = useCallback(
    async (entry, action, reasonOverride) => {
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
            setError('Unable to delete availability. Check delete policy on public.availability.');
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
    },
    [
      isLeadInstructor,
      approvalReasons,
      isSupabaseEnabled,
      supabase,
      currentInstructor,
      mapAvailabilityFromDb,
      setAvailabilityEntries,
      setError,
      setSupabaseStatus,
      setApprovalReasons,
    ]
  );

  return {
    deleteAvailability,
    updateStatus,
  };
};

export default useAvailabilityActions;
