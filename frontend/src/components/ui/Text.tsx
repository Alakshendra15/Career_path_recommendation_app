import { createContext, useContext } from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { fontFor } from '../../theme';

// true inside another <Text>, where an unstyled child should inherit its parent's font
const Nested = createContext(false);

/**
 * Drop-in replacement for React Native's Text that applies the app font.
 * Existing styles keep using fontWeight ('700' etc.); it is translated to the matching font file.
 * Nested text inherits the parent's font unless it sets its own weight.
 */
export function Text({ style, ...props }: TextProps) {
  const nested = useContext(Nested);
  const flat = StyleSheet.flatten(style) ?? {};
  const explicit = flat.fontFamily ?? (flat.fontWeight ? fontFor(flat.fontWeight) : undefined);
  const fontFamily = explicit ?? (nested ? undefined : fontFor('400'));
  return (
    <Nested.Provider value>
      {/* fontWeight is reset so Android does not fake-bold a font file that is already bold */}
      <RNText {...props} style={[style, fontFamily ? { fontFamily, fontWeight: 'normal' } : null]} />
    </Nested.Provider>
  );
}
