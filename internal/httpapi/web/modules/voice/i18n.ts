import { hasI18nKey, t, type MessageValues } from '../i18n/index.js';

export type VoiceMessageDescriptor = {
  key: string;
  fallback: string;
  values?: MessageValues;
};

export type VoiceMessageValues = MessageValues;

function interpolateFallback(message: string, values: MessageValues): string {
  return message.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, name) => {
    const value = values[name];
    return value == null ? match : String(value);
  });
}

export function voiceText(key: string, fallback: string, values: MessageValues = {}): string {
  if (hasI18nKey(key)) {
    return t(key, values);
  }
  return interpolateFallback(fallback, values);
}

export function voiceMessage(key: string, fallback: string, values?: MessageValues): VoiceMessageDescriptor {
  return { key, fallback, values };
}

export function renderVoiceMessage(message: VoiceMessageDescriptor): string {
  return voiceText(message.key, message.fallback, message.values);
}
