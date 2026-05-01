// src/unisPauseButton.test.jsx
//
// Unit tests for UnisPauseButton — a static SVG pause icon.
// Verifies the component renders the correct SVG elements: circle background
// and two vertical pause bars.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnisPauseButton from './unisPauseButton';

describe('UnisPauseButton', () => {
  it('renders an svg element with correct dimensions and class', () => {
    render(<UnisPauseButton />);
    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '40px');
    expect(svg).toHaveAttribute('height', '40px');
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    expect(svg).toHaveClass('unis-play-button-icon');
  });

  it('renders a circle background with unis-blue fill', () => {
    render(<UnisPauseButton />);
    const circle = document.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('cx', '50');
    expect(circle).toHaveAttribute('cy', '50');
    expect(circle).toHaveAttribute('r', '48');
    expect(circle).toHaveAttribute('fill', '#163387');
  });

  it('renders two vertical pause bars', () => {
    render(<UnisPauseButton />);
    const rects = document.querySelectorAll('rect');
    expect(rects).toHaveLength(2);

    // First bar (left)
    expect(rects[0]).toHaveAttribute('x', '35');
    expect(rects[0]).toHaveAttribute('y', '30');
    expect(rects[0]).toHaveAttribute('width', '10');
    expect(rects[0]).toHaveAttribute('height', '40');
    expect(rects[0]).toHaveAttribute('fill', 'black');

    // Second bar (right)
    expect(rects[1]).toHaveAttribute('x', '55');
    expect(rects[1]).toHaveAttribute('y', '30');
    expect(rects[1]).toHaveAttribute('width', '10');
    expect(rects[1]).toHaveAttribute('height', '40');
    expect(rects[1]).toHaveAttribute('fill', 'black');
  });
});