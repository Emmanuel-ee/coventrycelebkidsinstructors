import React from 'react';

const ProfileView = ({
  profileForm,
  passwordForm,
  isLeadInstructor,
  onBack,
  onProfileChange,
  onPasswordChange,
  onProfileSubmit,
  onPasswordSubmit,
}) => (
  <section className="panel panel--register">
    <div className="panel__heading">
      <div>
        <h2>Update profile</h2>
        <p className="panel__intro">Edit your contact details, role, or photo.</p>
      </div>
      <button type="button" className="ghost" onClick={onBack}>
        Back to details
      </button>
    </div>
    <div className="panel__sublist">
      <form className="form" onSubmit={onProfileSubmit}>
        <div className="form__grid">
          <label>
            Name*
            <input name="name" value={profileForm.name} onChange={onProfileChange} required />
          </label>
          <label>
            Role
            <select
              name="role"
              value={profileForm.role}
              onChange={onProfileChange}
              disabled={isLeadInstructor}
            >
              <option>Lead Instructor</option>
              <option>Instructor</option>
              <option>Support</option>
              <option>Volunteer</option>
            </select>
          </label>
          <label>
            Email*
            <input
              name="email"
              type="email"
              value={profileForm.email}
              onChange={onProfileChange}
              required
            />
          </label>
          <label>
            Phone
            <input name="phone" value={profileForm.phone} onChange={onProfileChange} />
          </label>
          <label className="form__full">
            Update photo (optional)
            <input
              name="photoFile"
              type="file"
              accept="image/*"
              onChange={onProfileChange}
            />
          </label>
        </div>
        <button type="submit" className="primary">
          Save profile changes
        </button>
      </form>
    </div>
    <div className="panel__sublist">
      <h3>Change password</h3>
      <form className="form" onSubmit={onPasswordSubmit}>
        <div className="form__grid">
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              value={passwordForm.currentPassword}
              onChange={onPasswordChange}
              required
            />
          </label>
          <label>
            New password
            <input
              name="nextPassword"
              type="password"
              value={passwordForm.nextPassword}
              onChange={onPasswordChange}
              required
              minLength={6}
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={onPasswordChange}
              required
              minLength={6}
            />
          </label>
        </div>
        <button type="submit" className="primary">
          Update password
        </button>
      </form>
    </div>
  </section>
);

export default ProfileView;
