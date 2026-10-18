import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders its label and handles clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save &amp; Share</Button>);
    const btn = screen.getByRole('button', { name: /save & share/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled();
  });
});
