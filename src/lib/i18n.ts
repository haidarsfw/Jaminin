import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en.json'
import id from '@/locales/id.json'
import type { Lang } from './format'

const STORAGE_KEY = 'jaminin:bahasa'

function storedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id'
  } catch {
    return 'id'
  }
}

void i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: storedLang(),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = i18n.language

export function setLanguage(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Penyimpanan bisa diblokir di mode privat; bahasa tetap berganti untuk sesi ini.
  }
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

export function currentLang(): Lang {
  return i18n.language === 'en' ? 'en' : 'id'
}

export default i18n
