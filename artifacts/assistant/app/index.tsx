import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  Text,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Camera from 'expo-camera';

import { DARK } from '@/constants/colors';
import ChatMessage from '@/components/ChatMessage';
import MicButton from '@/components/MicButton';
import TypingIndicator from '@/components/TypingIndicator';
import TorchCamera from '@/components/TorchCamera';
import { useAssistant } from '@/hooks/useAssistant';
import { useDeviceActions } from '@/hooks/useDeviceActions';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const {
    messages,
    isRecording,
    isLoading,
    alwaysListening,
    hasMicPermission,
    sendText,
    startRecording,
    stopRecording,
    toggleAlwaysListening,
    clearMessages,
  } = useAssistant();

  const { torchOn, executeAction } = useDeviceActions();

  const [cameraPermission, requestCameraPermission] = Camera.useCameraPermissions();

  const handleSendText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setText('');
    inputRef.current?.blur();
    const action = await sendText(trimmed);
    if (action) {
      await executeAction(action);
    }
  }, [text, isLoading, sendText, executeAction]);

  const handleMic = useCallback(async () => {
    if (isLoading) return;
    if (isRecording) {
      const action = await stopRecording();
      if (action) await executeAction(action);
    } else {
      if (!hasMicPermission) {
        await Camera.Camera.requestPermissionsAsync?.();
        return;
      }
      await startRecording();
    }
  }, [isLoading, isRecording, hasMicPermission, startRecording, stopRecording, executeAction]);

  const handleAlwaysListening = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    toggleAlwaysListening();
  }, [toggleAlwaysListening]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK.bg} />

      {/* Torch camera — invisible, controls flashlight */}
      <TorchCamera enabled={torchOn} />

      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoCircle}>
            <Feather name="cpu" size={16} color={DARK.primary} />
          </View>
          <Text style={styles.headerTitle}>Replit</Text>
          {alwaysListening && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ouvindo</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={handleAlwaysListening}
            style={({ pressed }) => [
              styles.iconBtn,
              alwaysListening && styles.iconBtnActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather
              name="radio"
              size={18}
              color={alwaysListening ? DARK.primary : DARK.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={clearMessages}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="trash-2" size={18} color={DARK.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── Chat list ──────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatMessage message={item} />}
          inverted
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!messages.length}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={isLoading ? <TypingIndicator /> : null}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <Feather name="mic" size={32} color={DARK.textDim} />
                <Text style={styles.emptyTitle}>Olá, eu sou o Replit</Text>
                <Text style={styles.emptySubtitle}>
                  Fale ou escreva um comando.{'\n'}Ex: "Liga a lanterna" ou "Abre o WhatsApp"
                </Text>
              </View>
            ) : null
          }
        />

        {/* ── Input bar ──────────────────────────────── */}
        <View style={[styles.inputBar, { paddingBottom: bottomPad + 8 }]}>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Escreva um comando..."
              placeholderTextColor={DARK.textDim}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSendText}
              blurOnSubmit={false}
            />
            {text.trim().length > 0 ? (
              <Pressable
                onPress={handleSendText}
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="send" size={18} color="#fff" />
              </Pressable>
            ) : null}
          </View>

          {/* Mic button — centred below the text input */}
          <View style={styles.micRow}>
            <MicButton
              isRecording={isRecording}
              isLoading={isLoading}
              onPress={handleMic}
            />
            {isRecording && (
              <Text style={styles.recordingHint}>Toque para parar</Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DARK.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DARK.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: DARK.text,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DARK.recording,
  },
  liveText: {
    fontSize: 11,
    color: DARK.recording,
    fontFamily: 'Inter_500Medium',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: DARK.primaryDim,
  },

  // List
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: DARK.text,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: DARK.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Input bar
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DARK.border,
    backgroundColor: DARK.bg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: DARK.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: DARK.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: DARK.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DARK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRow: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  recordingHint: {
    fontSize: 12,
    color: DARK.recording,
    fontFamily: 'Inter_400Regular',
  },
});
