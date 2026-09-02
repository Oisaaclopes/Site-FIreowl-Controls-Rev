import { DomainInvalidationBus } from './invalidationBus';

type WindowLike = Pick<Window, 'addEventListener' | 'removeEventListener' | 'setInterval' | 'clearInterval'> & {
  navigator: Pick<Navigator, 'onLine'>;
};
type DocumentLike = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;

export function attachRefreshTriggers(
  targetWindow: WindowLike,
  targetDocument: DocumentLike,
  bus: DomainInvalidationBus,
  intervalMs: number,
) {
  const refresh = (reason: 'focus' | 'visibility' | 'online') => {
    if (targetWindow.navigator.onLine && (reason !== 'visibility' || targetDocument.visibilityState === 'visible')) {
      void bus.refreshActive(reason);
    }
  };
  const onFocus = () => refresh('focus');
  const onVisibility = () => refresh('visibility');
  const onOnline = () => refresh('online');
  targetWindow.addEventListener('focus', onFocus);
  targetDocument.addEventListener('visibilitychange', onVisibility);
  targetWindow.addEventListener('online', onOnline);
  const polling = targetWindow.setInterval(() => {
    if (targetWindow.navigator.onLine && targetDocument.visibilityState === 'visible') void bus.refreshActive('poll');
  }, intervalMs);
  return () => {
    targetWindow.removeEventListener('focus', onFocus);
    targetDocument.removeEventListener('visibilitychange', onVisibility);
    targetWindow.removeEventListener('online', onOnline);
    targetWindow.clearInterval(polling);
  };
}
