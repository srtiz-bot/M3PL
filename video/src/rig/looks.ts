import {color} from '../brand/tokens';
import type {Look} from './types';

/**
 * Saúl — recurring guide. ORIGINAL design, not traced from any reference.
 * Placeholder likeness: adjust skin / hair / beard / glasses here so the
 * cartoon matches the real Saúl. Every scene reads from this one object,
 * which is what keeps the character consistent across episodes.
 */
export const SAUL: Look = {
  skin: '#C98E64',
  skinShade: '#B07650',
  hair: '#2A211C',
  hairStyle: 'short',
  beard: true,
  glasses: false,
  shirt: color.navy,
  shirtAccent: color.orange,
  pants: '#5B5F6B',
  shoes: '#3B2A22',
};

/** The Latin American business owner (the viewer's stand-in). */
export const OWNER: Look = {
  skin: '#D9A07A',
  skinShade: '#BF8660',
  hair: '#3B2416',
  hairStyle: 'bun',
  beard: false,
  glasses: false,
  shirt: color.orange,
  shirtAccent: color.white,
  pants: color.navySoft,
  shoes: color.navy,
};

/** A US customer. */
export const CUSTOMER: Look = {
  skin: '#8D5A3B',
  skinShade: '#744830',
  hair: '#1E1612',
  hairStyle: 'curly',
  beard: false,
  glasses: true,
  shirt: '#4F7CAC',
  shirtAccent: color.white,
  pants: color.navy,
  shoes: color.navy,
};
