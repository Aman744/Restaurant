import { db } from '../lib/firebase.js';
import { doc, setDoc } from 'firebase/firestore';

const MOCK_EVENTS_KEY = 'restaurant_qr_mock_events_db';

export class EventService {
  static async logEvent(
    tenantId: string,
    eventType: string,
    entityId: string,
    actorId: string,
    payload: any,
    isMockMode: boolean
  ): Promise<void> {
    const eventId = `evt_${Math.floor(Math.random() * 900000 + 100000)}`;
    const eventObj = {
      id: eventId,
      type: eventType,
      version: 1,
      source: 'web-client',
      correlationId: `corr_${Math.floor(Math.random() * 900000 + 100000)}`,
      entityId,
      actorId,
      timestamp: new Date(),
      payload
    };

    if (isMockMode) {
      try {
        const stored = localStorage.getItem(MOCK_EVENTS_KEY);
        const list = stored ? JSON.parse(stored) : [];
        list.push({
          ...eventObj,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem(MOCK_EVENTS_KEY, JSON.stringify(list));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error('Failed to log mock event:', e);
      }
      return;
    }

    try {
      await setDoc(doc(db, 'tenants', tenantId, 'events', eventId), eventObj);
    } catch (err) {
      console.error(`Failed to log live event ${eventType}:`, err);
    }
  }
}
