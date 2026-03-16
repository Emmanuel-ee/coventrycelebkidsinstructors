import React, { useState } from 'react';
import './App.css';

export default function Login({ onLogin, error }) {
  const [form, setForm] = useState({ username: '', password: '' });

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(form.username, form.password);
  }

  return (
    <div className="panel" style={{ maxWidth: 400, margin: '40px auto' }}>
      <h2>Instructor Login</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Enter your username"
            required
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />
        </label>
        <button className="primary" type="submit">Sign In</button>
        {error && <p className="banner banner--error">{error}</p>}
      </form>
    </div>
  );
}
