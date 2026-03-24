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
    <div className="card card--stack detail-card">
      <div className="detail-card__header">
        <div className="detail-card__identity">
          {renderTeacherAvatar(selectedTeacher, 64)}
          <div>
            <h3>{selectedTeacher.role}</h3>
            <p className="muted">Instructor profile</p>
          </div>
        </div>
        <span
          className={`badge ${
            selectedTeacher.verified ? 'badge--verified' : 'badge--pending'
          }`}
        >
          {selectedTeacher.verified ? 'Verified' : 'Pending'}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Email</span>
          <span>{selectedTeacher.email || 'No email provided'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Phone</span>
          <span>{selectedTeacher.phone || 'No phone provided'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Joined</span>
          <span>
            {selectedTeacher.createdAt
              ? new Date(selectedTeacher.createdAt).toLocaleDateString()
              : 'Unknown'}
          </span>
        </div>
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
