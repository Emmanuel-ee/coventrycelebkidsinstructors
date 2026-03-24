import React from 'react';

const LoginView = ({ loginForm, onChange, onSubmit, onRegister }) => (
  <section className="panel">
    <div className="panel__heading">
      <h2>Instructor login</h2>
    </div>
    <form className="form" onSubmit={onSubmit}>
      <div className="form__grid">
        <label>
          Email
          <input
            name="email"
            type="email"
            value={loginForm.email}
            onChange={onChange}
            placeholder="instructor@email.com"
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={loginForm.password}
            onChange={onChange}
            placeholder="Enter your password"
            required
          />
        </label>
      </div>
      <button type="submit" className="primary">
        Sign in
      </button>
      <button type="button" className="ghost" onClick={onRegister}>
        Register instructor
      </button>
    </form>
  </section>
);

export default LoginView;
