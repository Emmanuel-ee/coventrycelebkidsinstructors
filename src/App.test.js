import { fireEvent, render, screen } from '@testing-library/react';
import bcrypt from 'bcryptjs';
import App from './App';

test('renders instructor list heading and register flow', async () => {
  const passwordHash = bcrypt.hashSync('password123', 10);
  localStorage.setItem(
    'celebkids-records-v1',
    JSON.stringify({
      teachers: [
        {
          id: 'lead-1',
          name: 'Lead Instructor',
          email: 'lead@example.com',
          role: 'Lead Instructor',
          verified: true,
          passwordHash,
        },
      ],
      children: [],
    })
  );
  render(<App />);
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'lead@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  const instructorsCta = await screen.findByRole('button', { name: /^Instructors/i });
  fireEvent.click(instructorsCta);

  const heading = screen.getByRole('heading', { name: /instructors/i });
  expect(heading).toBeInTheDocument();

  expect(screen.getByRole('heading', { name: /instructors/i })).toBeInTheDocument();
});
