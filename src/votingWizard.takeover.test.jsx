// src/votingWizard.takeover.test.jsx
//
// Exercises the NEW full-bleed success takeover end-to-end. The main suite's
// step-2→3 navigation is flaky under jsdom because framer-motion's
// AnimatePresence mode="wait" never resolves its exit animation. Here we mock
// framer-motion to render synchronously, so we can drive a real vote to
// success and assert the takeover — including the EXACT before→after score.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';

const API = 'http://localhost:8080/api';

// Confetti is a no-op in jsdom.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

// Render motion.* and AnimatePresence synchronously (strip animation props).
vi.mock('framer-motion', () => {
  const MOTION_PROPS = new Set([
    'initial', 'animate', 'exit', 'variants', 'transition', 'custom',
    'whileHover', 'whileTap', 'whileFocus', 'whileInView', 'layout',
    'layoutId', 'drag', 'mode', 'onAnimationComplete',
  ]);
  const clean = (props) => {
    const out = {};
    for (const k in props) if (!MOTION_PROPS.has(k)) out[k] = props[k];
    return out;
  };
  const make = (tag) =>
    React.forwardRef((props, ref) =>
      React.createElement(tag, { ref, ...clean(props) }, props.children)
    );
  const cache = {};
  const motion = new Proxy({}, {
    get: (_t, tag) => (cache[tag] || (cache[tag] = make(tag))),
  });
  return {
    motion,
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

// Import AFTER the mocks are registered.
const VotingWizard = (await import('./votingWizard')).default;

const makeNominee = (overrides = {}) => ({
  id: 'nominee-001',
  name: 'Tony Fadd',
  type: 'artist',
  genreKey: 'rap',
  jurisdiction: {
    jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3',
    name: 'Harlem',
  },
  ...overrides,
});

describe('VotingWizard — success takeover', () => {
  beforeEach(() => {
    callTracker.reset();
    server.use(
      // Breadcrumb hierarchy so jurisdiction resolves.
      http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
        HttpResponse.json([
          { jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem', votingEnabled: true },
        ])
      ),
      // A phone-verified listener with a real score so the takeover can show
      // an exact before→after (7,325 → 7,350) and pass the submit gate.
      http.get(`${API}/v1/users/profile/:userId`, () =>
        HttpResponse.json({
          ...fixtures.users.listener,
          phoneVerified: true,
          score: 7325,
        })
      ),
      http.post(`${API}/v1/vote/submit`, () => HttpResponse.json({ success: true })),
    );
  });

  it('renders the full-bleed takeover with exact score on a successful vote', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <VotingWizard
        show={true}
        onClose={() => {}}
        onVoteSuccess={() => {}}
        nominee={makeNominee()}
        userId="user-listener-001"
        filters={{ selectedType: 'artist', selectedInterval: 'weekly' }}
      />,
      { as: 'listener' }
    );

    await screen.findByText(/Tony Fadd/);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Final Confirmation/i);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/Type the name/i);

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Tony Fadd');
    await user.type(inputs[1], 'ddaF ynoT');
    await user.click(screen.getByRole('button', { name: /cast vote/i }));

    // Takeover appears.
    await waitFor(() =>
      expect(screen.getByText(/vote locked in/i)).toBeInTheDocument()
    );

    // Category badge derived from type + interval (also echoed in the body).
    expect(screen.getAllByText(/Artist of the week/i).length).toBeGreaterThan(0);
    // Themed points tag (+25 also echoed in the sub-line).
    expect(screen.getAllByText(/\+25/).length).toBeGreaterThan(0);
    expect(screen.getByText(/pts/i)).toBeInTheDocument();
    // Headline names the nominee.
    expect(screen.getByText(/You backed/i)).toBeInTheDocument();
    // EXACT score line — the whole point. Not "7.3K → 7.3K".
    expect(screen.getByText(/7,325/)).toBeInTheDocument();
    expect(screen.getByText(/7,350/)).toBeInTheDocument();
    // Single dismiss pill.
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });
});