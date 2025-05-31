import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const DEFAULT_LANGUAGE = process.env.LANG || 'en';
const FALLBACK_LANGUAGE = 'en'; // Explicitly defined fallback language

type LocaleData = Record<string, any>; // Can be more specific if you know the structure
const locales: Record<string, LocaleData> = {};

// Determine the correct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct the absolute path to the 'locales' directory
// Assuming this i18n.ts file is e.g., in src/lib/, and the 'locales' folder is at the project root.
// ADJUST THIS PATH IF YOUR STRUCTURE IS DIFFERENT!
// Example: if i18n.ts is in src/lib/, and locales is in src/locales/, it would be '../locales'
const LOCALES_DIRECTORY = path.join(__dirname, '../../locales');

let isInitialized = false;

/**
 * Initializes the translation system by loading locale files.
 * Should be called once at the beginning of the application.
 */
export function initializeI18n(): void {
  if (isInitialized) {
    console.warn('[i18n] Attempted to re-initialize the translation system. Skipping.');
    return;
  }

  console.log(`[i18n] Initializing translation system...`);
  console.log(`[i18n] Attempting to load translations from: ${LOCALES_DIRECTORY}`);
  console.log(`[i18n] Default language set to: ${DEFAULT_LANGUAGE}`);

  try {
    if (!fs.existsSync(LOCALES_DIRECTORY)) {
      console.error(`[i18n] ERROR: Locales directory not found at ${LOCALES_DIRECTORY}`);
      isInitialized = true; // Mark as initialized to prevent re-attempts, even on failure
      return;
    }

    const files = fs.readdirSync(LOCALES_DIRECTORY);
    if (files.length === 0) {
      console.warn(`[i18n] WARNING: No files found in locales directory: ${LOCALES_DIRECTORY}`);
    }

    for (const file of files) {
      if (file.endsWith('.json')) {
        const lang = path.basename(file, '.json');
        const filePath = path.join(LOCALES_DIRECTORY, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          locales[lang] = JSON.parse(content);
          console.log(`[i18n] Successfully loaded locale: ${lang}`);
        } catch (parseError) {
          console.error(`[i18n] Error parsing JSON for locale ${lang} from ${filePath}:`, parseError);
        }
      }
    }
  } catch (error) {
    console.error(`[i18n] Critical error loading locales from ${LOCALES_DIRECTORY}:`, error);
  }

  isInitialized = true;
  const loadedLanguages = Object.keys(locales);
  if (loadedLanguages.length > 0) {
    console.log(`[i18n] Translation system initialization complete. Loaded languages: ${loadedLanguages.join(', ')}`);
    if (!locales[DEFAULT_LANGUAGE]) {
      console.warn(`[i18n] WARNING: Default language "${DEFAULT_LANGUAGE}" was not loaded. Check your locale files.`);
    }
  } else {
    console.warn(`[i18n] WARNING: No languages were loaded. The t() function will return keys.`);
  }
}

function getNestedValue(obj: any, key: string): string | undefined {
  return key.split('.').reduce((currentObject, keyPart) => {
    if (currentObject && typeof currentObject === 'object' && Object.prototype.hasOwnProperty.call(currentObject, keyPart)) {
      return currentObject[keyPart];
    }
    return undefined;
  }, obj);
}

/**
 * Translation function.
 * @param key The translation key, e.g., "commands.help.description".
 * @param vars Optional variables to replace in the translation (e.g., {user}).
 * @returns The translated string, or the key itself if the translation is not found.
 */
interface TranslationOptions {
  defaultValue?: string;
  [key: string]: any; // For other interpolation variables
}

export function t(key: string, options?: TranslationOptions | Record<string, string | number>): string {
  if (!isInitialized) {
    console.warn(`[i18n] t() called before locales were initialized for key: "${key}". Call initializeI18n() at application startup.`);
    // If options has a defaultValue, use it, otherwise return key
    if (typeof options === 'object' && options !== null && 'defaultValue' in options && typeof options.defaultValue === 'string') {
      return options.defaultValue;
    }
    return key;
  }

  const targetLangData = locales[DEFAULT_LANGUAGE];
  const fallbackLangData = locales[FALLBACK_LANGUAGE];

  let text: string | undefined;

  if (targetLangData) {
    text = getNestedValue(targetLangData, key);
  }

  if (text === undefined && DEFAULT_LANGUAGE !== FALLBACK_LANGUAGE && fallbackLangData) {
    text = getNestedValue(fallbackLangData, key);
  }

  // If still not found, use defaultValue from options if provided, otherwise the key
  if (text === undefined) {
    if (typeof options === 'object' && options !== null && 'defaultValue' in options && typeof options.defaultValue === 'string') {
      console.warn(`[i18n] Translation missing for key: "${key}". Using provided defaultValue.`);
      text = options.defaultValue;
    } else {
      console.warn(`[i18n] Translation missing for key: "${key}". Defaulting to key.`);
      text = key;
    }
  }

  // Interpolation (handle if 'options' is for defaultValue or for vars)
   // Check if options is not just for defaultValue
  const varsForInterpolation = (typeof options === 'object' && options !== null && !('defaultValue' in options))
      ? options as Record<string, string | number>
      : (typeof options === 'object' && options !== null && Object.keys(options).length > 1)
          ? options as Record<string, string | number> // has defaultValue AND other vars
          : undefined;
  if (varsForInterpolation) {
    for (const [variableKey, value] of Object.entries(varsForInterpolation)) {
      if (variableKey === 'defaultValue') continue; // Skip defaultValue itself for interpolation
      text = text.replaceAll(`{${variableKey}}`, String(value));
    }
  }
  return text || key;
}