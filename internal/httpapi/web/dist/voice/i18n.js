import { hasI18nKey, t } from '../i18n/index.js';
function interpolateFallback(message, values) {
    return message.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, name) => {
        const value = values[name];
        return value == null ? match : String(value);
    });
}
export function voiceText(key, fallback, values = {}) {
    if (hasI18nKey(key)) {
        return t(key, values);
    }
    return interpolateFallback(fallback, values);
}
export function voiceMessage(key, fallback, values) {
    return { key, fallback, values };
}
export function renderVoiceMessage(message) {
    return voiceText(message.key, message.fallback, message.values);
}
