import React from 'react';

const InstructorDetailView = ({
  selectedTeacher,
  assignedChildren,
  isLeadInstructor,
  onBack,
  onVerify,
  onDeny,
  onOpenChild,
  onCardKeyDown,
  renderTeacherAvatar,
}) => (
  <section className="panel">
    <div className="panel__heading">
      <h2>{selectedTeacher.name}</h2>
      <div className="panel__actions">
        <button type="button" className="ghost" onClick={onBack}>
          Back to instructors
        </button>
        {!selectedTeacher.verified && isLeadInstructor && (
          <>
            <button type="button" className="primary" onClick={() => onVerify(selectedTeacher.id)}>
              Verify instructor
            </button>
            <button type="button" className="ghost" onClick={() => onDeny(selectedTeacher.id)}>
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
            onClick={() => onOpenChild(child)}
            onKeyDown={(event) => onCardKeyDown(event, () => onOpenChild(child))}
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
);

export default InstructorDetailView;
