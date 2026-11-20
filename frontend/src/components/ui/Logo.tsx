import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The CareerPath mark: a route that climbs from where you are to your goal.
 * `variant="light"` is a white tile with an indigo route, for use on coloured backgrounds (splash).
 */
export function Logo({ size = 72, variant = 'brand' }: { size?: number; variant?: 'brand' | 'light' }) {
  const light = variant === 'light';
  const stroke = light ? '#4F46E5' : '#FFFFFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4F46E5" />
          <Stop offset="1" stopColor="#7C3AED" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" rx="26" fill={light ? '#FFFFFF' : 'url(#tile)'} />
      <Path d="M27 73 C27 55 50 60 50 43 C50 36 57 33 63.5 30" stroke={stroke} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Circle cx="27" cy="73" r="8" fill={stroke} />
      <Circle cx="73" cy="26" r="10" fill="none" stroke={stroke} strokeWidth="6" />
      <Circle cx="73" cy="26" r="3.5" fill={stroke} />
    </Svg>
  );
}
