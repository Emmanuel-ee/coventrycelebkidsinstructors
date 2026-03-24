import React from 'react';

const AppHeader = ({ verifiedCount, childrenCount, onHome, isRefreshing }) => (
  <header className="app__header">
    <button
      type="button"
      className="app__brand"
      onClick={onHome}
      aria-label="Go to home"
    >
      <img
        className="app__logo"
        src={`${process.env.PUBLIC_URL}/logo/Asset 199.svg`}
        alt="CCI logo"
      />
      <div>
        <p className="app__eyebrow">CelebKids Admin</p>
        <h1>Instructor Dashboard</h1>
        <p className="app__subtitle">In Christ For Christ With Joy</p>
      </div>
    </button>
    <div className="app__stats">
      <div>
        <span className="stat__label">Verified instructors</span>
        <span className="stat__value">{verifiedCount}</span>
      </div>
      <div>
        <span className="stat__label">Children</span>
        <span className="stat__value">{childrenCount}</span>
      </div>
      {isRefreshing && (
        <div className="stat__sync" aria-live="polite">
          <span className="stat__dot" />
          Syncing…
        </div>
      )}
    </div>
  </header>
);

export default AppHeader;
