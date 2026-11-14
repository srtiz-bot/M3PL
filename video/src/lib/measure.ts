import {measureText} from '@remotion/layout-utils';
import {font} from '../brand/tokens';

export const textW = (text: string, size: number, weight: '600' | '700' | '800' = '700', family: string = font.display) =>
  measureText({text, fontFamily: family, fontSize: size, fontWeight: weight}).width;
