// src/Layout.test.jsx
// =============================================================================
//
// Unit tests for the Layout shell component.
// Layout is purely presentational — Header, Footer, children, and the
// --background-image CSS variable.
 
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
 
vi.mock('./header',       () => ({ default: () => <header data-testid="Header" /> }));
vi.mock('./footer',       () => ({ default: () => <footer data-testid="Footer" /> }));
vi.mock('./layout.scss',  () => ({}));
 
import Layout from './layout';
 
describe('Layout', () => {
 
  it('renders Header', () => {
    render(<Layout><p>content</p></Layout>);
    expect(screen.getByTestId('Header')).toBeInTheDocument();
  });
 
  it('renders Footer', () => {
    render(<Layout><p>content</p></Layout>);
    expect(screen.getByTestId('Footer')).toBeInTheDocument();
  });
 
  it('renders children inside the main content area', () => {
    render(<Layout><span>Hello world</span></Layout>);
    const main = document.querySelector('.layout-content');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('Hello world');
  });
 
  it('applies the layout-container class to the root element', () => {
    render(<Layout><p /></Layout>);
    expect(document.querySelector('.layout-container')).toBeInTheDocument();
  });
 
  it('sets the --background-image CSS variable when backgroundImage is provided', () => {
    render(<Layout backgroundImage="/images/hero.jpg"><p /></Layout>);
    const container = document.querySelector('.layout-container');
    expect(container.style.getPropertyValue('--background-image'))
      .toBe('url(/images/hero.jpg)');
  });
 
  it('sets --background-image to "url(undefined)" when backgroundImage is omitted', () => {
    // This documents current behaviour — the template literal always runs.
    render(<Layout><p /></Layout>);
    const container = document.querySelector('.layout-container');
    expect(container.style.getPropertyValue('--background-image'))
      .toBe('url(undefined)');
  });
 
  it('renders multiple children correctly', () => {
    render(
      <Layout>
        <p data-testid="child-1">First</p>
        <p data-testid="child-2">Second</p>
      </Layout>
    );
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });
 
  it('renders no children when none are passed', () => {
    render(<Layout />);
    const main = document.querySelector('.layout-content');
    expect(main).toBeInTheDocument();
    expect(main.childElementCount).toBe(0);
  });
});
