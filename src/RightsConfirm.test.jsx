// src/RightsConfirm.test.jsx
//
// The rights checkbox shown on every upload (Terms of Service 3.6).
//
// Until Unis holds licenses from The MLC and the performing rights
// organizations, it can only carry music the uploader controls. This box is
// the artist saying so. The upload wizard and the signup wizard own the
// "must be ticked" rule (and the backend refuses anything without
// rightsConfirmed: true); this suite covers the box itself.

import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./RightsConfirm.scss', () => ({}));

import RightsConfirm, { RIGHTS_HELP_HREF } from './RightsConfirm';

const Controlled = (props) => {
  const [checked, setChecked] = useState(false);
  return <RightsConfirm checked={checked} onChange={setChecked} {...props} />;
};

describe('RightsConfirm — what the artist is agreeing to', () => {
  it('is a labelled group about this song', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Your rights to this song' })).toBeInTheDocument();
  });

  it('spells out the four conditions', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toHaveLength(4);
    expect(items[0]).toMatch(/you wrote it, and everyone who co-wrote it or made the beat is fine/i);
    expect(items[1]).toMatch(/no publisher or publishing administrator, such as songtrust or tunecore publishing/i);
    expect(items[2]).toMatch(/no one who wrote it is with sesac or gmr\. ascap and bmi are fine/i);
    expect(items[3]).toMatch(/it isn’t a cover, and any sample in it is cleared/i);
  });

  it('the checkbox says the song is licensed to Unis under the Terms', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAccessibleName(/all of this is true for this song, and i license it to unis under section 3 of the terms of service/i);
  });

  it('links to the Terms and to the help article, each in a new tab', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} />);
    const terms = screen.getByRole('link', { name: 'Terms of Service' });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms.getAttribute('rel')).toContain('noopener');

    const why = screen.getByRole('link', { name: 'Why Unis asks' });
    expect(why).toHaveAttribute('href', '/help#upload-rights');
    expect(RIGHTS_HELP_HREF).toBe('/help#upload-rights');
    expect(why).toHaveAttribute('target', '_blank');
  });

  it('words everything for the music in a video', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} mediaType="video" />);
    expect(screen.getByRole('group', { name: 'Your rights to the music in this video' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveAccessibleName(/all of this is true for the music in this video/i);
  });
});

describe('RightsConfirm — the checkbox', () => {
  it('reflects the value it is given', () => {
    const { rerender } = render(<RightsConfirm checked={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    rerender(<RightsConfirm checked onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('reports ticking and unticking to the parent', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<RightsConfirm checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(<RightsConfirm checked onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('clicking the sentence ticks the box', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByText(/all of this is true for this song/i));
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('two boxes on one page keep separate ids', () => {
    render(
      <>
        <RightsConfirm checked={false} onChange={() => {}} idPrefix="main" />
        <RightsConfirm checked={false} onChange={() => {}} idPrefix="clean" />
      </>
    );
    const ids = screen.getAllByRole('checkbox').map((box) => box.id);
    expect(ids).toEqual(['main-confirm', 'clean-confirm']);
  });
});

describe('RightsConfirm — the alert', () => {
  it('is not shown by default', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-invalid');
  });

  it('explains why the upload was stopped', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} showAlert />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the box to upload this song. If any of these isn’t true, the song can’t go on Unis yet.');
  });

  it('has its own wording for a video', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} showAlert mediaType="video" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check the box to upload this video. If any of these isn’t true for the music in it, the video can’t go on Unis yet.');
  });

  it('marks the box invalid and ties it to the alert for screen readers', () => {
    render(<RightsConfirm checked={false} onChange={() => {}} showAlert idPrefix="up" />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAttribute('aria-describedby', 'up-alert');
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'up-alert');
    expect(screen.getByRole('group')).toHaveClass('rights-confirm--alert');
  });

  it('goes away as soon as the box is ticked', async () => {
    const user = userEvent.setup();
    render(<Controlled showAlert />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('group')).not.toHaveClass('rights-confirm--alert');
  });
});
