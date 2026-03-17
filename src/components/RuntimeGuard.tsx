import React from 'react';
import { describeRuntimeIssue, shouldIgnoreRuntimeIssue } from '@/utils/runtimeErrorFilter';

interface RuntimeGuardProps {
  children: React.ReactNode;
}

let guardInstalled = false;

const installRuntimeErrorGuard = () => {
  if (guardInstalled || typeof window === 'undefined') return;

  const suppressIgnoredError = (value: unknown, fallbackMessage?: string): boolean => {
    if (!shouldIgnoreError(value)) return false;
    console.warn('Ignored external UIStyleError:', fallbackMessage ?? toSafeText(value));
    return true;
  };

  const previousOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (suppressIgnoredError(error ?? message, String(message))) return true;
    if (typeof previousOnError === 'function') {
      return previousOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  const previousOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    if (suppressIgnoredError(event.reason, 'Unhandled rejection')) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      return;
    }
    if (typeof previousOnUnhandledRejection === 'function') {
      return previousOnUnhandledRejection.call(window, event);
    }
  };

  window.addEventListener(
    'error',
    (event) => {
      const payload = event.error ?? event.message ?? event;
      if (suppressIgnoredError(payload, event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (suppressIgnoredError(event.reason, 'Unhandled rejection')) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    true
  );

  guardInstalled = true;
};

installRuntimeErrorGuard();

const RuntimeGuard: React.FC<RuntimeGuardProps> = ({ children }) => {
  return <>{children}</>;
};

export default RuntimeGuard;

