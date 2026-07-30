import { useState, useCallback } from 'react';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { Platform, Alert } from 'react-native';
import type { Action } from '@/types';

// Deep-link URL schemes for common apps.
// Falls back to an https URL if the app is not installed.
const APP_URLS: Record<string, [string, string]> = {
  whatsapp:  ['whatsapp://',                'https://wa.me'],
  spotify:   ['spotify://',                  'https://open.spotify.com'],
  youtube:   ['youtube://',                  'https://youtube.com'],
  instagram: ['instagram://',               'https://instagram.com'],
  chrome:    ['googlechrome://',            'https://www.google.com'],
  google:    ['googlechrome://',            'https://www.google.com'],
  telegram:  ['tg://',                      'https://telegram.org'],
  netflix:   ['nflx://',                    'https://netflix.com'],
  facebook:  ['fb://',                      'https://facebook.com'],
  twitter:   ['twitter://',                 'https://twitter.com'],
  tiktok:    ['tiktok://',                  'https://tiktok.com'],
  gmail:     ['googlegmail://',             'https://mail.google.com'],
  maps:      ['comgooglemaps://',           'https://maps.google.com'],
  uber:      ['uber://',                    'https://uber.com'],
  settings:  ['app-settings:',             'app-settings:'],
};

async function tryOpen(scheme: string, fallback: string) {
  try {
    const can = await Linking.canOpenURL(scheme);
    await Linking.openURL(can ? scheme : fallback);
  } catch {
    await Linking.openURL(fallback);
  }
}

export interface DeviceActionsHook {
  torchOn: boolean;
  executeAction: (action: Action) => Promise<string>;
}

export function useDeviceActions(): DeviceActionsHook {
  const [torchOn, setTorchOn] = useState(false);

  const executeAction = useCallback(async (action: Action): Promise<string> => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    switch (action.type) {
      case 'flashlight_on': {
        setTorchOn(true);
        return 'Lanterna ligada';
      }

      case 'flashlight_off': {
        setTorchOn(false);
        return 'Lanterna desligada';
      }

      case 'open_app': {
        const appKey = (action.param ?? '').toLowerCase();
        const urls = APP_URLS[appKey];
        if (urls) {
          await tryOpen(urls[0], urls[1]);
        } else {
          // Generic intent — try common scheme
          try {
            await Linking.openURL(`${appKey}://`);
          } catch {
            Alert.alert('App não encontrado', `Não foi possível abrir "${action.param}".`);
          }
        }
        return `Abrindo ${action.param}`;
      }

      case 'search_web': {
        const q = encodeURIComponent(action.param ?? '');
        await tryOpen(
          `googlechrome://navigate?url=https://www.google.com/search?q=${q}`,
          `https://www.google.com/search?q=${q}`,
        );
        return `Pesquisando: ${action.param}`;
      }

      case 'send_whatsapp': {
        // param format: "phone:message"
        const [phone, ...msgParts] = (action.param ?? ':').split(':');
        const msg = encodeURIComponent(msgParts.join(':'));
        const url = phone
          ? `whatsapp://send?phone=${phone}&text=${msg}`
          : `whatsapp://send?text=${msg}`;
        await tryOpen(url, `https://wa.me/?text=${msg}`);
        return 'Abrindo WhatsApp';
      }

      case 'call': {
        const phone = action.param ?? '';
        await Linking.openURL(`tel:${phone}`);
        return `Ligando para ${phone}`;
      }

      case 'open_maps': {
        const dest = encodeURIComponent(action.param ?? '');
        await tryOpen(
          `comgooglemaps://?q=${dest}`,
          `https://maps.google.com/maps?q=${dest}`,
        );
        return `Abrindo mapa: ${action.param}`;
      }

      default:
        return `Ação: ${action.type}`;
    }
  }, []);

  return { torchOn, executeAction };
}
