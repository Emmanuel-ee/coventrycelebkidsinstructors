import { useCallback } from 'react';

const useChildCheckin = ({
  attendanceActive,
  selectedChild,
  currentInstructor,
  isSupabaseEnabled,
  supabase,
  createId,
  setError,
  setSupabaseStatus,
  setIsUpdatingChildStatus,
  setRecords,
  setSelectedChild,
  setStatusWithActor,
}) =>
  useCallback(
    async (action) => {
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
        signedInUserId:
          action === 'sign_in'
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
          setError(
            `Unable to ${action === 'sign_in' ? 'sign in' : 'sign out'}. ${checkinError.message}`
          );
          setIsUpdatingChildStatus(false);
          return;
        }
        const { error: statusError } = await supabase
          .from('children')
          .update({
            last_status: action,
            last_action_at: actionTimestamp,
            signed_in: action === 'sign_in',
            signed_in_user_id: action === 'sign_in' ? currentInstructor?.id || null : null,
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
    },
    [
      attendanceActive,
      selectedChild,
      currentInstructor,
      isSupabaseEnabled,
      supabase,
      createId,
      setError,
      setSupabaseStatus,
      setIsUpdatingChildStatus,
      setRecords,
      setSelectedChild,
      setStatusWithActor,
    ]
  );

export default useChildCheckin;
