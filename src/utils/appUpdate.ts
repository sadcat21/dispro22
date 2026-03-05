import { AppUpdate } from '@capawesome/capacitor-app-update';
import { Capacitor } from '@capacitor/core';

/**
 * فحص وجود تحديثات للتطبيق
 * يعمل فقط على الأجهزة الأصلية (Android/iOS)
 */
export const checkForAppUpdate = async (): Promise<{ available: boolean; version?: string }> => {
  // التحقق من أن التطبيق يعمل على جهاز أصلي
  if (!Capacitor.isNativePlatform()) {
    console.log('App update check is only available on native platforms');
    return { available: false };
  }

  try {
    const result = await AppUpdate.getAppUpdateInfo();
    return {
      available: result.available,
      version: result.latestVersion
    };
  } catch (error) {
    console.error('Error checking for app updates:', error);
    return { available: false };
  }
};

/**
 * تنفيذ التحديث إذا كان متوفراً
 */
export const performAppUpdate = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('App update is only available on native platforms');
    return false;
  }

  try {
    const result = await AppUpdate.updateApp();
    return result.success;
  } catch (error) {
    console.error('Error performing app update:', error);
    return false;
  }
};

/**
 * الحصول على معلومات الإصدار الحالي
 */
export const getCurrentAppVersion = async (): Promise<string | null> => {
  try {
    const result = await AppUpdate.getAppUpdateInfo();
    return result.currentVersion;
  } catch (error) {
    console.error('Error getting current app version:', error);
    return null;
  }
};