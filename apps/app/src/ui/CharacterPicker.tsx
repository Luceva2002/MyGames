import { Modal, Pressable, ScrollView, View } from 'react-native';
import { BOT_CHARACTERS } from '@giochi/engine';
import { CharacterAvatar } from './avatars';
import { Button, focusRing, T, tap } from './kit';
import { colors } from './theme';

/** Griglia delle 16 maschere: chi gioca sceglie la sua, che appare al tavolo e nei punteggi. */
export function CharacterPicker({ value, onChange, size = 64, disabled = [] }: { value: string | null; onChange: (id: string | null) => void; size?: number; disabled?: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {BOT_CHARACTERS.map((c) => {
        const selected = value === c.id;
        const off = disabled.includes(c.id);
        return (
          <Pressable
            key={c.id}
            disabled={off}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            accessibilityState={{ selected, disabled: off }}
            onPress={() => {
              tap();
              onChange(selected ? null : c.id);
            }}
            style={(state) => [
              { alignItems: 'center', gap: 4, padding: 6, borderRadius: 16, borderWidth: 3, borderColor: selected ? colors.accent : 'transparent', backgroundColor: selected ? colors.surface2 : 'transparent', width: size + 24, opacity: off ? 0.3 : 1 },
              focusRing((state as { focused?: boolean }).focused ?? false),
            ]}
          >
            <CharacterAvatar id={c.id} size={size} />
            <T size={12} weight="800" color={selected ? colors.accent : colors.muted} center lines={1}>
              {c.name}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Finestra per scegliere la maschera di un posto (partita sullo stesso telefono, stanza online). */
export function CharacterPickerModal({ visible, title, value, taken = [], onPick, onClose }: {
  visible: boolean;
  title: string;
  value: string | null;
  /** Maschere già prese da altri posti: si vedono ma non si scelgono. */
  taken?: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 26, padding: 20, gap: 14, width: '100%', maxWidth: 560, borderWidth: 3, borderColor: colors.line }} accessibilityViewIsModal>
          <T size={22} weight="900">
            {title}
          </T>
          <ScrollView style={{ maxHeight: 460 }}>
            <CharacterPicker
              value={value}
              disabled={taken.filter((t) => t !== value)}
              onChange={(id) => {
                if (id) onPick(id);
                onClose();
              }}
            />
          </ScrollView>
          <Button small kind="ghost" color={colors.muted} label="Chiudi" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
