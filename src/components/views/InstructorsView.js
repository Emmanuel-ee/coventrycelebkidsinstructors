import React from 'react';

const InstructorsView = ({
  instructorSearch,
  onSearchChange,
  onBack,
  filteredVerifiedTeachers,
  filteredPendingTeachers,
  isLeadInstructor,
  onOpenInstructor,
  onCardKeyDown,
  renderTeacherAvatar,
  onRemoveInstructor,
  onVerifyInstructor,
  onDenyInstructor,
}) => (
  <div className="app__main">
    <section className="panel">
      <div className="panel__heading">
        <h2>Instructors</h2>
        <div className="panel__actions">
          <input
            type="search"
            value={instructorSearch}
            onChange={onSearchChange}
            placeholder="Search instructors"
            aria-label="Search instructors"
          />
          <button type="button" className="ghost" onClick={onBack} aria-label="Back">
            ←
          </button>
        </div>
      </div>
      <div className="list">
        {filteredVerifiedTeachers.length === 0 ? (
          <p className="empty">No verified instructors yet. Add your first instructor above.</p>
        ) : (
          filteredVerifiedTeachers.map((teacher) => (
            <article
              key={teacher.id}
              className="card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenInstructor(teacher)}
              onKeyDown={(event) => onCardKeyDown(event, () => onOpenInstructor(teacher))}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {renderTeacherAvatar(teacher)}
                  <div>
                    <h3>{teacher.name}</h3>
                    <p className="muted">{teacher.role}</p>
                  </div>
                </div>
                <div className="meta">
                  <span>{teacher.email || 'No email'}</span>
                  <span>{teacher.phone || 'No phone'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isLeadInstructor && !teacher.role?.toLowerCase().includes('lead') && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveInstructor(teacher.id);
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      <div className="panel__sublist">
        <h3>Pending Instructor Verifications</h3>
        {filteredPendingTeachers.length === 0 ? (
          <p className="empty">No pending verifications.</p>
        ) : (
          filteredPendingTeachers.map((teacher) => (
            <article
              key={teacher.id}
              className="card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenInstructor(teacher)}
              onKeyDown={(event) => onCardKeyDown(event, () => onOpenInstructor(teacher))}
            >
              <div>
                <h4>{teacher.name}</h4>
                <p className="muted">{teacher.role}</p>
                <span>{teacher.email}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {isLeadInstructor && (
                    <>
                      <button
                        type="button"
                        className="primary"
                        onClick={(event) => {
                          event.stopPropagation();
                          onVerifyInstructor(teacher.id);
                        }}
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDenyInstructor(teacher.id);
                        }}
                      >
                        Deny
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  </div>
);

export default InstructorsView;
