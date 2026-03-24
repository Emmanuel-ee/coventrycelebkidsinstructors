import React from 'react';

const DeleteInstructorModal = ({ isOpen, teacherName, onCancel, onConfirm }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal__backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal__header">
          <h2>Remove instructor</h2>
        </div>
        <p className="modal__body">
          Are you sure you want to remove {teacherName}? Children assigned will become unassigned,
          and this action cannot be undone.
        </p>
        <div className="modal__actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Yes, remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteInstructorModal;
