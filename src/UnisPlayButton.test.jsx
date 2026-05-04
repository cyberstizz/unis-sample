// src/unisPlayButton.test.jsx
//
// Unit tests for UnisPlayButton — a static SVG play icon.
// Verifies the component renders the correct SVG elements: circle background
// and triangular play path.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnisPlayButton from './unisPlayButton';

describe('UnisPlayButton', () => {
it('renders an svg element with correct dimensions and class', () => {
    render(<UnisPlayButton />);
    // SVGs only get the implicit "img" role when they have an accessible
    // name (e.g. a <title> child or aria-label). This is a decorative icon
    // — query directly with querySelector instead.
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '40px');
    expect(svg).toHaveAttribute('height', '40px');
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    expect(svg).toHaveClass('unis-play-button-icon');
  });
  
  it('renders a circle background with unis-blue fill', () => {
    render(<UnisPlayButton />);
    const circle = document.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('cx', '50');
    expect(circle).toHaveAttribute('cy', '50');
    expect(circle).toHaveAttribute('r', '48');
    expect(circle).toHaveAttribute('fill', '#163387');
  });

  it('renders a triangular play path', () => {
    render(<UnisPlayButton />);
    const path = document.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute('d', 'M38 30 L70 50 L38 70 Z');
    expect(path).toHaveAttribute('fill', 'black');
  });
});