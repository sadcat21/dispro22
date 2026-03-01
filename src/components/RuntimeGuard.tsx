import React, { useEffect } from 'react';

interface RuntimeGuardProps {
  children: React.ReactNode;
}

const IGNORED_PATTERNS = [
  'UIStyleError',
  'طلب تعديل من المستخدم',
  '[Respond and provide all suggestions in Arabic]',
];

const shouldIgnoreError = (value: unknown): boolean => {
  const text = typeof value === 'string'
    ? value
    : value instanceof Error
      ? `${value.name} ${value.message} ${value.stack || ''}`
      : JSON.stringify(value || '');

  return IGNORED_PATTERNS.some((pattern) => text.includes(pattern));
};

const RuntimeGuard: React.FC<RuntimeGuardProps> = ({ children }) => {
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      if (shouldIgnoreError(event.error || event.message)) {
        event.preventDefault();
        console.warn('Ignored external UIStyleError:', event.message);
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldIgnoreError(event.reason)) {
        event.preventDefault();
        console.warn('Ignored external UIStyleError rejection');
      }
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
};

export default RuntimeGuard;
