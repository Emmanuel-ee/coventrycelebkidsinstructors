import React from 'react';

const HomeView = ({
  onChildren,
  onInstructors,
  onAvailability,
  attendanceStartDate,
  attendanceEndDate,
  onAttendanceStart,
  onAttendanceEnd,
  onDownloadAttendance,
}) => (
  <section className="panel panel--home">
    <div className="panel__heading">
      <h2>Welcome</h2>
    </div>
    <div className="home__actions">
      <button type="button" className="primary home__button" onClick={onChildren}>
        <span>
          <strong>Children</strong>
          <span className="home__hint">View, search, and manage child details</span>
        </span>
        <span className="home__arrow">→</span>
      </button>
      <button type="button" className="ghost home__button" onClick={onInstructors}>
        <span>
          <strong>Instructors</strong>
          <span className="home__hint">Review, verify, and register instructors</span>
        </span>
        <span className="home__arrow">→</span>
      </button>
      <button type="button" className="ghost home__button" onClick={onAvailability}>
        <span>
          <strong>Availability</strong>
          <span className="home__hint">Submit and review availability</span>
        </span>
        <span className="home__arrow">→</span>
      </button>
    </div>
    <div className="attendance-controls">
      <div className="attendance-controls__dates">
        <label>
          Attendance start
          <input type="date" value={attendanceStartDate} onChange={onAttendanceStart} />
        </label>
        <label>
          Attendance end
          <input type="date" value={attendanceEndDate} onChange={onAttendanceEnd} />
        </label>
      </div>
      <button
        type="button"
        className="ghost attendance-controls__download"
        onClick={onDownloadAttendance}
      >
        Download attendance
      </button>
    </div>
  </section>
);

export default HomeView;
