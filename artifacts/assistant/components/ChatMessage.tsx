import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { DARK } from '@/constants/colors';
import type { Message, Action } from '@/types';

const ACTION_LABELS: Record<string, { icon: string; label: string; lib: 'feather' | 'mci' }> = {
  flashlight_on:  { icon: 'zap',            label: 'Lanterna ligada',     lib: 'feather' },
  flashlight_off: { icon: 'zap-off',        label: 'Lanterna desligada',  lib: 'feather' },
  open_app:       { icon: 'external-link',  label: 'Abrindo app',         lib: 'feather' },
  search_web:     { icon: 'search',         label: 'Pesquisando...',       lib: 'feather' },
  send_whatsapp:  { icon: 'message-circle', label: 'Enviando mensagem',   lib: 'feather' },
  call:           { icon: 'phone',          label: 'Ligando...',           lib: 'feather' },
  open_maps:      { icon: 'map-pin',        label: 'Abrindo mapa',        lib: 'feather' },
};

function ActionChip({ action }: { action: Action }) {
  const info = ACTION_LABELS[action.type] ?? { icon: 'cpu', label: action.type, lib: 'feather' };
  const label = action.param && action.type === 'open_app'
    ? `Abrindo ${action.param}`
    : info.label;

  return (
    <View style={styles.actionChip}>
      <Feather name={info.icon as any} size={12} color={DARK.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Feather name="cpu" size={14} color={DARK.primary} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {message.isVoice && (
          <View style={styles.voicePill}>
            <Feather name="mic" size={10} color={DARK.primary} />
            <Text style={styles.voiceText}>Mensagem de voz</Text>
          </View>
        )}
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content}
        </Text>
        {message.action && <ActionChip action={message.action} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DARK.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: DARK.userBubble,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: DARK.assistantBubble,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  textUser: {
    color: DARK.userBubbleText,
  },
  textAssistant: {
    color: DARK.text,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  voiceText: {
    fontSize: 11,
    color: DARK.primary,
    fontFamily: 'Inter_500Medium',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: DARK.primaryDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  actionLabel: {
    fontSize: 11,
    color: DARK.primary,
    fontFamily: 'Inter_500Medium',
  },
});
