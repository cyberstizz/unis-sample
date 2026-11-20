// src/utils/platformFee.test.js
//
// Unis's fee on song sales and direct support — the "break-even gate".
// This file mirrors backend PlatformFees.java; if a number here has to change,
// the backend has to change with it.
//
//   fee = 10% of the payment, or Stripe's card fee (2.9% rounded up + 30¢) + 1¢,
//         whichever is higher
//
// Under about $4.35 the gate decides and Unis clears exactly 1¢; from there up
// it is a plain 10%. The buyer always pays the listed price.

import { describe, it, expect } from 'vitest';
import {
  MIN_SONG_PRICE_CENTS,
  MIN_SUPPORT_CENTS,
  stripeCardFeeCents,
  platformFeeCents,
  artistReceivesCents,
  dollarsToCents,
  formatCents,
  priceHint,
} from './platformFee';

describe('platformFee — the minimums', () => {
  it('a song costs at least $0.94 (5¢ under the iTunes 99¢ tier)', () => {
    expect(MIN_SONG_PRICE_CENTS).toBe(94);
  });

  it('direct support is at least $1.00', () => {
    expect(MIN_SUPPORT_CENTS).toBe(100);
  });
});

describe('platformFee — Stripe\'s card fee', () => {
  it.each([
    [94, 33],     // 2.726¢ → rounds up to 3, + 30
    [100, 33],    // 2.9¢ → 3, + 30
    [199, 36],    // 5.771¢ → 6, + 30
    [1000, 59],   // exactly 29¢, + 30
    [1001, 60],   // 29.029¢ → rounds UP to 30, + 30
    [5000, 175],
  ])('on %i¢ is %i¢ (2.9%% rounded up, plus 30¢)', (amount, fee) => {
    expect(stripeCardFeeCents(amount)).toBe(fee);
  });

  it.each([0, -50, null, undefined, 'abc'])('is 0 for %p', (amount) => {
    expect(stripeCardFeeCents(amount)).toBe(0);
  });
});

describe('platformFee — Unis\'s fee', () => {
  it.each([
    // amount, fee, artist receives
    [94, 34, 60],      // minimum song price
    [100, 34, 66],     // minimum support
    [199, 37, 162],
    [299, 40, 259],
    [1000, 100, 900],  // plain 10%
    [2500, 250, 2250],
    [10000, 1000, 9000],
  ])('%i¢ → fee %i¢, artist receives %i¢', (amount, fee, artist) => {
    expect(platformFeeCents(amount)).toBe(fee);
    expect(artistReceivesCents(amount)).toBe(artist);
  });

  it('the documented examples hold: $0.94 → $0.60, $1.99 → $1.62, $10.00 → $9.00', () => {
    expect(artistReceivesCents(94)).toBe(60);
    expect(artistReceivesCents(199)).toBe(162);
    expect(artistReceivesCents(1000)).toBe(900);
  });

  it('under the crossover Unis clears exactly 1¢ after Stripe is paid', () => {
    [94, 100, 150, 199, 250, 300, 400, 434].forEach((amount) => {
      expect(platformFeeCents(amount) - stripeCardFeeCents(amount)).toBe(1);
    });
  });

  it('Unis never loses money on a payment at or above the minimum', () => {
    for (let amount = MIN_SONG_PRICE_CENTS; amount <= 20000; amount += 1) {
      expect(platformFeeCents(amount)).toBeGreaterThan(stripeCardFeeCents(amount));
    }
  });

  it('the gate hands over to a plain 10% at about $4.35', () => {
    expect(platformFeeCents(434)).toBe(44);  // gate: 43 + 1 beats 10% (43)
    expect(platformFeeCents(435)).toBe(44);  // the two meet
    expect(platformFeeCents(445)).toBe(45);  // 10% (45) beats the gate (44)
    expect(platformFeeCents(500)).toBe(50);
  });

  it('from the crossover up, the fee is 10% rounded to the cent', () => {
    [500, 999, 1234, 4999, 20000].forEach((amount) => {
      expect(platformFeeCents(amount)).toBe(Math.round(amount * 0.10));
    });
  });

  it('fee and artist share always add up to what the buyer paid', () => {
    for (let amount = 1; amount <= 5000; amount += 7) {
      expect(platformFeeCents(amount) + artistReceivesCents(amount)).toBe(amount);
    }
  });

  it('the fee never exceeds the payment, so the artist never goes negative', () => {
    expect(platformFeeCents(10)).toBe(10);
    expect(artistReceivesCents(10)).toBe(0);
    expect(artistReceivesCents(1)).toBe(0);
  });

  it.each([0, -100, null, undefined, 'abc'])('is 0 for %p', (amount) => {
    expect(platformFeeCents(amount)).toBe(0);
    expect(artistReceivesCents(amount)).toBe(0);
  });

  it('ignores fractions of a cent', () => {
    expect(platformFeeCents(199.9)).toBe(platformFeeCents(199));
    expect(platformFeeCents('199')).toBe(37);
  });
});

describe('platformFee — prices typed into a form', () => {
  it.each([
    ['1.99', 199],
    ['0.94', 94],
    ['2', 200],
    ['1.5', 150],
    [1.99, 199],
    ['19.999', 2000],  // rounds to the nearest cent
    ['0.1', 10],       // no floating-point drift
  ])('%p → %i¢', (value, cents) => {
    expect(dollarsToCents(value)).toBe(cents);
  });

  it.each(['', 'abc', null, undefined])('%p is not a price', (value) => {
    expect(dollarsToCents(value)).toBeNull();
  });

  it.each([
    [94, '$0.94'],
    [199, '$1.99'],
    [1000, '$10.00'],
    [5, '$0.05'],
    [0, '$0.00'],
    [null, '$0.00'],
  ])('formats %p as %s', (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });
});

describe('platformFee — the hint under a price box', () => {
  it('always states the minimum', () => {
    expect(priceHint('')).toContain('minimum $0.94');
    expect(priceHint('5')).toContain('minimum $0.94');
  });

  it('gives no take-home figure until the price is valid', () => {
    ['', 'abc', '0.93', '0'].forEach((value) => {
      const hint = priceHint(value);
      expect(hint).toContain("You receive the price minus Unis's fee");
      expect(hint).not.toMatch(/At \$/);
    });
  });

  it('says what the artist takes home at a valid price', () => {
    expect(priceHint('0.94')).toContain('At $0.94 you receive $0.60');
    expect(priceHint('1.99')).toContain('At $1.99 you receive $1.62');
    expect(priceHint('10')).toContain('At $10.00 you receive $9.00');
  });

  it('explains the fee and where the money goes', () => {
    const hint = priceHint('1.99');
    expect(hint).toContain('paid directly to your Stripe account');
    expect(hint).toContain("Unis's fee is 10%, or just its card-processing cost + 1¢ on smaller prices");
  });
});
