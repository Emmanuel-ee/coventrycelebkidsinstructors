import React from 'react';

const AppStatus = ({
  currentInstructor,
  isLoading,
  error,
  supabaseStatus,
  onProfile,
  onSignOut,
  renderTeacherAvatar,
}) => (
  <div className="app__status">
    {currentInstructor && (
      <div className="banner banner--signedin">
        <div className="signedin__content">
          {renderTeacherAvatar(currentInstructor, 40)}
          <div>
            <p className="signedin__label">Signed in</p>
            <p className="signedin__name">{currentInstructor.name}</p>
            <p className="signedin__role">{currentInstructor.role || 'Instructor'}</p>
          </div>
        </div>
        <div className="signedin__actions">
          <button type="button" className="ghost signedin__action" onClick={onProfile}>
            Update profile
          </button>
          <button type="button" className="ghost signedin__action" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    )}
    {isLoading && <p className="banner banner--info">Loading records…</p>}
    {error && <p className="banner banner--error">{error}</p>}
    {!error && supabaseStatus && <p className="banner banner--success">{supabaseStatus}</p>}
  </div>
);

export default AppStatus;
