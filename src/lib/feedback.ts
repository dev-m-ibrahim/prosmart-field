import { PUBLIC_APP_URL } from './config';

/**
 * The address the customer opens by scanning the QR code.
 * On the web build it is the current site; inside the Android app (origin is not public) the hosted web app is used.
 */
export function feedbackUrl(token: string): string {
  const { protocol, hostname, origin, pathname } = window.location;
  const isPublicWeb = protocol.startsWith('http') && hostname !== 'localhost' && hostname !== '127.0.0.1';
  const base = isPublicWeb ? origin + pathname : PUBLIC_APP_URL;
  return `${base.replace(/#.*$/, '')}#/f/${token}`;
}
