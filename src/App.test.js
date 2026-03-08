import { render, screen } from '@testing-library/react';
import App from './App';

test('renders instructor and child records heading', () => {
  render(<App />);
  const heading = screen.getByText(/instructor & child records/i);
  expect(heading).toBeInTheDocument();
});
