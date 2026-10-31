import { describe, expect, it } from 'vitest';
import {
    getAirportIdentityKey,
    getAirportIdentityName,
    setAirportIdentity,
    resetAirportIdentity,
    createAirportGroupId,
} from '../../src/utils/airport-identity.js';

describe('subscription airport identity', () => {
    it('uses explicit stable group identity before inferred domain identity', () => {
        const sub = {
            id: 'a',
            url: 'https://one.example.com/sub',
            airportIdentity: { groupId: 'shared', name: 'Confirmed' },
        };
        expect(getAirportIdentityKey(sub)).toBe('identity:shared');
        expect(getAirportIdentityName(sub)).toBe('Confirmed');
    });
    it('creates a non-empty unique group id for manual confirmation', () => {
        const first = createAirportGroupId();
        const second = createAirportGroupId();
        expect(first).toBeTruthy();
        expect(second).not.toBe(first);
    });

    it('falls back to the inferred key and resets reversibly', () => {
        const sub = { id: 'a', url: 'https://one.example.com/sub' };
        setAirportIdentity(sub, 'custom', 'My Airport');
        expect(getAirportIdentityKey(sub)).toBe('identity:custom');
        expect(getAirportIdentityName(sub)).toBe('My Airport');
        resetAirportIdentity(sub);
        expect(sub.airportIdentity).toBeNull();
        expect(getAirportIdentityKey(sub)).toBe('site:example.com');
    });
});
