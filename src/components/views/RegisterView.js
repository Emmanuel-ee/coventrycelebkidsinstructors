import React from 'react';

const RegisterView = ({ isSignedIn, onBack, registerInstructorForm }) => (
  <section className="panel panel--register">
    <div className="panel__heading">
      <div>
        <h2>Register instructor</h2>
        <p className="panel__intro">
          Provide instructor details and a secure password to create the account.
        </p>
      </div>
      <button type="button" className="ghost" onClick={onBack}>
        {isSignedIn ? 'Back to instructors' : 'Back to login'}
      </button>
    </div>
    {registerInstructorForm}
  </section>
);

export default RegisterView;
