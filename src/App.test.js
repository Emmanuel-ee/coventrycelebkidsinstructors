import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('renders instructor list heading and register flow', () => {
  render(<App />);
  const heading = screen.getByText(/Celeb Kids Instructors/i);
  expect(heading).toBeInTheDocument();

  const registerButton = screen.getByRole('button', { name: /register instructor/i });
  fireEvent.click(registerButton);

  expect(screen.getByRole('heading', { name: /register instructor/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to list/i })).toBeInTheDocument();
});
