import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { encode } from 'base64-arraybuffer';

type Instrument = 'Piano' | 'Guitar' | 'Flute';
type Octave = 'Low' | 'Medium' | 'High';
type Phase = 'idle' | 'listening' | 'answering' | 'result' | 'timeout';

const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const INSTRUMENTS: { name: Instrument; icon: string; detail: string }[] = [
  { name: 'Piano', icon: '♬', detail: 'Bright & clear' },
  { name: 'Guitar', icon: '♩', detail: 'Warm & plucked' },
  { name: 'Flute', icon: '♫', detail: 'Airy & smooth' },
];
const OCTAVES: { name: Octave; range: string }[] = [
  { name: 'Low', range: 'C3 – B3' },
  { name: 'Medium', range: 'C4 – B4' },
  { name: 'High', range: 'C5 – B5' },
];
const COLORS = {
  background: '#F4F0E9',
  card: '#FFFEFB',
  ink: '#202923',
  muted: '#777E75',
  green: '#286B4D',
  paleGreen: '#E4EEE5',
  line: '#E8E3D9',
  orange: '#F1B45D',
  red: '#A8463C',
};

function createWave(noteIndex: number, octave: Octave, instrument: Instrument): ArrayBuffer {
  const sampleRate = 22050;
  const duration = 1.1;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples * 2, true);

  const octaveNumber = octave === 'Low' ? 3 : octave === 'Medium' ? 4 : 5;
  const midi = (octaveNumber + 1) * 12 + noteIndex;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const harmonics = instrument === 'Flute' ? [1, 0.28, 0.08] : instrument === 'Guitar' ? [1, 0.55, 0.32, 0.18] : [1, 0.48, 0.25, 0.12];

  for (let i = 0; i < samples; i += 1) {
    const time = i / sampleRate;
    const attack = Math.min(1, time / (instrument === 'Flute' ? 0.12 : 0.012));
    const release = Math.min(1, (duration - time) / (instrument === 'Flute' ? 0.14 : 0.3));
    const decay = instrument === 'Flute' ? 0.82 + 0.18 * Math.exp(-time * 1.5) : Math.exp(-time * (instrument === 'Guitar' ? 2.7 : 1.3));
    let sample = 0;
    harmonics.forEach((gain, harmonic) => {
      sample += gain * Math.sin(2 * Math.PI * frequency * (harmonic + 1) * time);
    });
    const normalized = (sample / 1.95) * attack * release * decay * 0.72;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, normalized)) * 32767, true);
  }

  return buffer;
}

function PianoKeys({ onSelect, disabled }: { onSelect: (index: number) => void; disabled: boolean }) {
  const whiteNotes = [0, 2, 4, 5, 7, 9, 11];
  const blackNotes = [1, 3, 6, 8, 10];
  return (
    <View style={styles.pianoFrame}>
      <View style={styles.pianoKeys}>
        {whiteNotes.map((note, index) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${NOTES[note]}`}
            disabled={disabled}
            key={note}
            onPress={() => onSelect(note)}
            style={[styles.whiteKey, index > 0 && styles.keyDivider]}
          >
            <Text style={styles.keyLabel}>{NOTES[note]}</Text>
          </Pressable>
        ))}
        {blackNotes.map((note) => {
          const positions: Record<number, number> = { 1: 10.1, 3: 24.4, 6: 52.9, 8: 67.2, 10: 81.5 };
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${NOTES[note]}`}
              disabled={disabled}
              key={note}
              onPress={() => onSelect(note)}
              style={[styles.blackKey, { left: `${positions[note]}%` }]}
            >
              <Text style={styles.blackKeyLabel}>{NOTES[note]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GuitarBoard({ onSelect, disabled }: { onSelect: (index: number) => void; disabled: boolean }) {
  return (
    <View style={styles.guitarBody}>
      <View style={styles.guitarNut} />
      <View style={styles.guitarFrets}>
        {NOTES.map((note, index) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${note}`}
            disabled={disabled}
            key={note}
            onPress={() => onSelect(index)}
            style={styles.fret}
          >
            <View style={styles.guitarString} />
            <View style={[styles.fretMarker, index === 0 && styles.rootMarker]} />
            <Text style={styles.fretLabel}>{note}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.instrumentCaption}>12 notes across one octave · tap a fret</Text>
    </View>
  );
}

function FluteBody({ onSelect, disabled }: { onSelect: (index: number) => void; disabled: boolean }) {
  return (
    <View style={styles.fluteBody}>
      <View style={styles.fluteTube}>
        {NOTES.map((note, index) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Select ${note}`}
            disabled={disabled}
            key={note}
            onPress={() => onSelect(index)}
            style={styles.fluteHoleWrap}
          >
            <View style={[styles.fluteHole, index === 0 && styles.fluteRootHole]} />
            <Text style={styles.fluteLabel}>{note}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.instrumentCaption}>12 finger positions · tap a hole</Text>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [instrument, setInstrument] = useState<Instrument>('Piano');
  const [octave, setOctave] = useState<Octave>('Medium');
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(30);
  const [message, setMessage] = useState('Listen closely, then find the note.');
  const [streak, setStreak] = useState(0);
  const deadline = useRef<number | null>(null);
  const roundId = useRef(0);
  const currentSound = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch((error: unknown) => console.warn('Unable to configure audio playback:', error));
    return () => {
      roundId.current += 1;
      Speech.stop();
      if (currentSound.current) void currentSound.current.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'answering' || deadline.current === null) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        deadline.current = null;
        setPhase('timeout');
        setMessage(`Time's up — it was ${target === null ? '' : NOTES[target]}.`);
        setStreak(0);
      }
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [phase, target]);

  const playNote = async (note: number, selectedInstrument: Instrument, selectedOctave: Octave, activeRound: number) => {
    const cacheDirectory = FileSystem.cacheDirectory;
    if (!cacheDirectory) throw new Error('Audio cache directory is unavailable.');
    const fileUri = `${cacheDirectory}note-${activeRound}.wav`;
    await FileSystem.writeAsStringAsync(fileUri, encode(createWave(note, selectedOctave, selectedInstrument)), {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    if (activeRound !== roundId.current) {
      await sound.unloadAsync();
      return;
    }
    currentSound.current = sound;
    await sound.playAsync();
    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) resolve();
      });
    });
    await sound.unloadAsync();
    currentSound.current = null;
  };

  const startRound = async () => {
    if (phase === 'listening' || phase === 'answering') return;
    const activeRound = roundId.current + 1;
    roundId.current = activeRound;
    const nextTarget = Math.floor(Math.random() * NOTES.length);
    setTarget(nextTarget);
    setPhase('listening');
    setRemaining(30);
    setMessage('Listen closely…');
    try {
      await new Promise<void>((resolve, reject) => {
        Speech.speak('Where is this note?', {
          language: 'en-US',
          rate: 0.9,
          onDone: resolve,
          onStopped: resolve,
          onError: reject,
        });
      });
      if (activeRound !== roundId.current) return;
      await playNote(nextTarget, instrument, octave, activeRound);
      if (activeRound !== roundId.current) return;
      deadline.current = Date.now() + 30000;
      setPhase('answering');
      setMessage('Where is this note? Tap it before time runs out.');
    } catch (error) {
      if (activeRound !== roundId.current) return;
      console.error('Unable to play the note:', error);
      setPhase('idle');
      setMessage('Could not play the note. Please try again.');
    }
  };

  const stopRound = () => {
    roundId.current += 1;
    deadline.current = null;
    Speech.stop();
    if (currentSound.current) {
      void currentSound.current.stopAsync();
      void currentSound.current.unloadAsync();
      currentSound.current = null;
    }
    setPhase('idle');
    setMessage('Ready when you are. Listen for the note.');
  };

  const selectAnswer = (answer: number) => {
    if (phase !== 'answering' || target === null) return;
    deadline.current = null;
    if (answer === target) {
      setStreak((value) => value + 1);
      setMessage(`That's right! It was ${NOTES[target]}.`);
    } else {
      setStreak(0);
      setMessage(`Not quite — it was ${NOTES[target]}.`);
    }
    setPhase('result');
  };

  const busy = phase === 'listening';
  const canAnswer = phase === 'answering';
  const roundActive = busy || canAnswer;
  const isNarrow = width < 380;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: isNarrow ? 18 : 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>A LITTLE PRACTICE, EVERY DAY</Text>
            <Text style={styles.title}>Note Scout<Text style={styles.titleDot}>.</Text></Text>
          </View>
          <View style={styles.streakPill}>
            <Text style={styles.streakIcon}>✦</Text>
            <Text style={styles.streakText}>{streak} streak</Text>
          </View>
        </View>

        <View style={styles.intro}>
          <Text style={styles.introTitle}>Trust your ears.</Text>
          <Text style={styles.introCopy}>Hear a note. Find it on your instrument.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>01  CHOOSE YOUR INSTRUMENT</Text>
          <View style={styles.instrumentRow}>
            {INSTRUMENTS.map((option) => {
              const selected = instrument === option.name;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.name}
                  onPress={() => !roundActive && setInstrument(option.name)}
                  style={[styles.instrumentOption, selected && styles.instrumentSelected]}
                >
                  <Text style={[styles.instrumentIcon, selected && styles.instrumentIconSelected]}>{option.icon}</Text>
                  <Text style={[styles.instrumentName, selected && styles.instrumentNameSelected]}>{option.name}</Text>
                  <Text style={styles.instrumentDetail}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.sectionLabel, styles.octaveHeading]}>02  PICK AN OCTAVE</Text>
          <View style={styles.octaveRow}>
            {OCTAVES.map((option) => {
              const selected = octave === option.name;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={option.name}
                  onPress={() => !roundActive && setOctave(option.name)}
                  style={[styles.octaveOption, selected && styles.octaveSelected]}
                >
                  <Text style={[styles.octaveName, selected && styles.octaveNameSelected]}>{option.name}</Text>
                  <Text style={[styles.octaveRange, selected && styles.octaveRangeSelected]}>{option.range}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.practiceHeader}>
          <View>
            <Text style={styles.sectionLabel}>03  FIND THE NOTE</Text>
            <Text style={styles.practiceTitle}>{instrument} · {octave} octave</Text>
          </View>
          <View style={[styles.timerPill, canAnswer && remaining <= 10 && styles.timerUrgent]}>
            <Text style={[styles.timerText, canAnswer && remaining <= 10 && styles.timerTextUrgent]}>
              {phase === 'answering' ? `0:${String(remaining).padStart(2, '0')}` : '0:30'}
            </Text>
          </View>
        </View>

        <View style={styles.instrumentCard}>
          <View style={styles.instrumentCardHeading}>
            <Text style={styles.instrumentCardTitle}>{instrument === 'Piano' ? 'Your keyboard' : instrument === 'Guitar' ? 'Your fretboard' : 'Your flute'}</Text>
            <Text style={styles.rangeBadge}>{OCTAVES.find((item) => item.name === octave)?.range}</Text>
          </View>
          {instrument === 'Piano' ? (
            <PianoKeys disabled={!canAnswer} onSelect={selectAnswer} />
          ) : instrument === 'Guitar' ? (
            <GuitarBoard disabled={!canAnswer} onSelect={selectAnswer} />
          ) : (
            <FluteBody disabled={!canAnswer} onSelect={selectAnswer} />
          )}
          <View style={styles.notePicker}>
            {NOTES.map((note, index) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${note}`}
                disabled={!canAnswer}
                key={note}
                onPress={() => selectAnswer(index)}
                style={[styles.noteButton, canAnswer && styles.noteButtonActive]}
              >
                <Text style={[styles.noteButtonText, canAnswer && styles.noteButtonTextActive]}>{note}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.promptPanel}>
          <View style={[styles.soundIcon, busy && styles.soundIconActive]}>
            <Text style={styles.soundIconText}>{busy ? '♪' : canAnswer ? '♫' : '♪'}</Text>
          </View>
          <View style={styles.promptTextWrap}>
            <Text style={styles.promptTitle}>{busy ? 'Listen up' : canAnswer ? 'Your turn' : phase === 'timeout' || phase === 'result' ? 'Round complete' : 'Ready to listen?'}</Text>
            <Text style={styles.promptMessage}>{message}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy || canAnswer}
          onPress={phase === 'listening' || phase === 'answering' ? stopRound : startRound}
          style={[styles.startButton, (busy || canAnswer) && styles.startButtonDisabled]}
        >
          <Text style={styles.startButtonIcon}>{busy ? '♪' : canAnswer ? '◷' : '▶'}</Text>
          <Text style={styles.startButtonText}>{busy ? 'Listening…' : canAnswer ? 'Listening for your answer' : phase === 'result' || phase === 'timeout' ? 'Play another note' : 'Start listening'}</Text>
        </Pressable>
        {(busy || canAnswer) && (
          <Pressable accessibilityRole="button" onPress={stopRound} style={styles.cancelButton}>
            <Text style={styles.cancelText}>End round</Text>
          </Pressable>
        )}

        <Text style={styles.footer}>Take your time. The more you listen, the more you’ll hear.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, paddingTop: 14, paddingBottom: 30, maxWidth: 600, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 5 },
  title: { color: COLORS.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -1 },
  titleDot: { color: COLORS.green },
  streakPill: { backgroundColor: COLORS.card, borderRadius: 30, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakIcon: { color: '#D38A28', fontSize: 15 },
  streakText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  intro: { marginTop: 22, marginBottom: 18 },
  introTitle: { color: COLORS.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  introCopy: { color: COLORS.muted, fontSize: 13, marginTop: 5 },
  card: { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, padding: 16 },
  sectionLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.25 },
  instrumentRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  instrumentOption: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 5, borderRadius: 13, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', backgroundColor: '#FFFDFC' },
  instrumentSelected: { borderColor: COLORS.green, backgroundColor: COLORS.paleGreen },
  instrumentIcon: { fontSize: 19, color: COLORS.muted, height: 23 },
  instrumentIconSelected: { color: COLORS.green },
  instrumentName: { color: COLORS.ink, fontSize: 12, fontWeight: '700', marginTop: 4 },
  instrumentNameSelected: { color: COLORS.green },
  instrumentDetail: { color: COLORS.muted, fontSize: 9, marginTop: 3, textAlign: 'center' },
  octaveHeading: { marginTop: 18 },
  octaveRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  octaveOption: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center' },
  octaveSelected: { borderColor: COLORS.green, backgroundColor: COLORS.paleGreen },
  octaveName: { color: COLORS.ink, fontSize: 11, fontWeight: '700' },
  octaveNameSelected: { color: COLORS.green },
  octaveRange: { color: COLORS.muted, fontSize: 9, marginTop: 3 },
  octaveRangeSelected: { color: COLORS.green },
  practiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 23, marginBottom: 10 },
  practiceTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '700', marginTop: 5 },
  timerPill: { backgroundColor: '#ECE7DD', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  timerUrgent: { backgroundColor: '#F8E7E3' },
  timerText: { color: COLORS.ink, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: COLORS.red },
  instrumentCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 15, borderWidth: 1, borderColor: COLORS.line },
  instrumentCardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  instrumentCardTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  rangeBadge: { color: COLORS.green, fontSize: 10, fontWeight: '700', backgroundColor: COLORS.paleGreen, overflow: 'hidden', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  pianoFrame: { backgroundColor: '#D8D0C2', padding: 5, paddingBottom: 4, borderRadius: 10, height: 118 },
  pianoKeys: { flex: 1, flexDirection: 'row', overflow: 'hidden', borderRadius: 6, position: 'relative' },
  whiteKey: { flex: 1, backgroundColor: '#FFFEFB', borderBottomWidth: 4, borderBottomColor: '#E4DED3', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 9 },
  keyDivider: { borderLeftWidth: 1, borderLeftColor: '#D8D3C9' },
  keyLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '600' },
  blackKey: { position: 'absolute', top: 0, width: '7.5%', height: '59%', backgroundColor: '#29332D', borderBottomLeftRadius: 5, borderBottomRightRadius: 5, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5, zIndex: 2 },
  blackKeyLabel: { color: '#EDEBE5', fontSize: 7, fontWeight: '600' },
  guitarBody: { backgroundColor: '#60432E', padding: 8, borderRadius: 11, overflow: 'hidden' },
  guitarNut: { position: 'absolute', left: 0, top: 8, bottom: 26, width: 4, backgroundColor: '#E5D6B6', zIndex: 2 },
  guitarFrets: { flexDirection: 'row', height: 65 },
  fret: { flex: 1, borderRightWidth: 2, borderRightColor: '#BEA98A', alignItems: 'center', justifyContent: 'center' },
  guitarString: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: '#D5C8AD' },
  fretMarker: { width: 17, height: 17, borderRadius: 10, backgroundColor: '#E8E1D2', borderWidth: 2, borderColor: '#C4A77E', zIndex: 1 },
  rootMarker: { backgroundColor: COLORS.orange, borderColor: '#F8D398' },
  fretLabel: { color: '#F8F2E6', fontSize: 7, fontWeight: '700', marginTop: 6 },
  instrumentCaption: { color: COLORS.muted, fontSize: 9, textAlign: 'center', marginTop: 8 },
  fluteBody: { backgroundColor: '#E8EFE8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 8 },
  fluteTube: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#CBDCCF', borderRadius: 24, height: 42, paddingHorizontal: 3 },
  fluteHoleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fluteHole: { width: 13, height: 13, borderRadius: 8, backgroundColor: '#3F6552', borderWidth: 2, borderColor: '#F3F6F0' },
  fluteRootHole: { backgroundColor: COLORS.orange },
  fluteLabel: { position: 'absolute', top: 23, color: COLORS.green, fontSize: 7, fontWeight: '700' },
  notePicker: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 13 },
  noteButton: { width: '15%', minWidth: 35, height: 34, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F6F1' },
  noteButtonActive: { backgroundColor: '#FFFDF8', borderColor: '#CFD9CC' },
  noteButtonText: { color: '#AFB1A9', fontSize: 10, fontWeight: '700' },
  noteButtonTextActive: { color: COLORS.ink },
  promptPanel: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14, padding: 12, backgroundColor: '#EAEFE7', borderRadius: 14 },
  soundIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#D9E6D9', justifyContent: 'center', alignItems: 'center' },
  soundIconActive: { backgroundColor: '#C7DEC9' },
  soundIconText: { color: COLORS.green, fontSize: 18, fontWeight: '700' },
  promptTextWrap: { flex: 1 },
  promptTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  promptMessage: { color: COLORS.muted, fontSize: 10, marginTop: 3, lineHeight: 14 },
  startButton: { backgroundColor: COLORS.green, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginTop: 13 },
  startButtonDisabled: { backgroundColor: '#819688' },
  startButtonIcon: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  startButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  cancelButton: { alignSelf: 'center', paddingVertical: 9, paddingHorizontal: 14 },
  cancelText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  footer: { color: COLORS.muted, textAlign: 'center', fontSize: 10, marginTop: 17, paddingHorizontal: 10 },
});
