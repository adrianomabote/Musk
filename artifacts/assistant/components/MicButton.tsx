import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { DARK } from '@/constants/colors';

interface Props {
  isRecording: boolean;
  isLoading: boolean;
  onPress: () => void;
}

export default function MicButton({ isRecording, isLoading, onPress }: Props) {
  const scale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
      );
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 0 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(ringOpacity);
      cancelAnimation(ringScale);
      scale.value = withTiming(1, { duration: 200 });
      ringOpacity.value = withTiming(0, { duration: 200 });
      ringScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const bgColor = isRecording ? DARK.recording : DARK.primary;
  const iconName = isLoading ? 'loader' : isRecording ? 'square' : 'mic';

  return (
    <View style={styles.container}>
      {/* Ripple ring */}
      <Animated.View
        style={[
          styles.ring,
          { backgroundColor: isRecording ? DARK.recordingGlow : DARK.primaryDim },
          ringStyle,
        ]}
      />
      <Animated.View style={animStyle}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: bgColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name={iconName as any} size={22} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DARK.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
