import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const defaultLang = process.env.LANG || 'en';

type LocaleData = Record<string, any>;

const locales: Record<string, LocaleData> = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.join(__dirname, 'locales');

console.log(`[i18n] Loading translations from: ${LOCALES_DIR}`);
console.log(`[i18n] Default language: ${defaultLang}`);

try {
  const files = fs.readdirSync(LOCALES_DIR);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const lang = path.basename(file, '.json');
      const filePath = path.join(LOCALES_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      locales[lang] = JSON.parse(content);
      console.log(`[i18n] Loaded locale: ${lang}`);
    }
  }
} catch (error) {
  console.error(`[i18n] Error loading locales:`, error);
}

function getNestedValue(obj: any, key: string): string | undefined {
  return key.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Translation function
 * @param key translation key like "commands.help.description"
 * @param vars optional variables to replace in translation
 * @returns translated string or key if missing
 */
export function t(key: string, vars?: Record<string, string>): string {
  const translations = locales[defaultLang] || locales['en'];
  let text = getNestedValue(translations, key) || key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}
