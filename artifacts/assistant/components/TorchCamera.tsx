/**
 * TorchCamera renders a tiny, off-screen CameraView so we can toggle the
 * Android flashlight without displaying a camera preview to the user.
 */
import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { CameraView } from 'expo-camera';

interface Props {
  enabled: boolean;
}

// Only mount on native (camera not meaningful on web)
export default function TorchCamera({ enabled }: Props) {
  if (Platform.OS === 'web') return null;
  return (
    <CameraView
      style={styles.camera}
      enableTorch={enabled}
      facing="back"
    />
  );
}

const styles = StyleSheet.create({
  camera: {
    position: 'absolute',
    width: 1,
    height: 1,
    top: -1,
    left: -1,
    opacity: 0,
  },
});
