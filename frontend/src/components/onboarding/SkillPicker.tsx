import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { labelSkill } from '../../constants/options';
import { colors, font, spacing } from '../../theme';
import { Chip, Input, Row, Text } from '../ui';

/** Search-as-you-type picker. Suggestions come from `options`; anything typed can also be added. */
export function SkillPicker({
  selected,
  onChange,
  options,
  placeholder,
  max = 30,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  options: string[];
  placeholder: string;
  max?: number;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    const pool = options.filter((o) => !selected.includes(o));
    return (q ? pool.filter((o) => o.includes(q)) : pool).slice(0, 12);
  }, [options, selected, q]);

  function add(raw: string) {
    const value = raw.trim().toLowerCase();
    if (!value || selected.includes(value) || selected.length >= max) return;
    onChange([...selected, value]);
    setQuery('');
  }

  return (
    <View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        returnKeyType="done"
        onSubmitEditing={() => add(query)}
        style={{ marginBottom: 0 }}
      />
      {q && !options.includes(q) ? (
        <View style={{ marginTop: spacing.sm }}>
          <Chip label={`Add "${query.trim()}"`} onPress={() => add(query)} />
        </View>
      ) : null}

      {selected.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '600', marginBottom: spacing.sm }}>
            Selected ({selected.length})
          </Text>
          <Row>
            {selected.map((s) => (
              <Chip key={s} label={labelSkill(s)} selected onRemove={() => onChange(selected.filter((x) => x !== s))} />
            ))}
          </Row>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.muted, fontSize: font.sm, marginBottom: spacing.sm }}>
            {q ? 'Suggestions' : 'Popular'}
          </Text>
          <Row>
            {suggestions.map((s) => (
              <Chip key={s} label={labelSkill(s)} onPress={() => add(s)} />
            ))}
          </Row>
        </View>
      )}
    </View>
  );
}
