import { normalizeRelayAddress } from '../../../src/lib/helpers/relay-address';

describe('normalizeRelayAddress', () => {
  it('leaves a plain host name alone', () => {
    expect(
      normalizeRelayAddress({
        hostname: 'relay.example.com',
        path: '',
        ssl: true
      })
    ).toEqual({
      ok: true,
      address: { hostname: 'relay.example.com', path: '', ssl: true },
      notes: []
    });
  });

  it('keeps a port and trims whitespace', () => {
    const result = normalizeRelayAddress({
      hostname: '  relay.example.com:9000 ',
      path: '',
      ssl: false
    });
    expect(result).toEqual({
      ok: true,
      address: { hostname: 'relay.example.com:9000', path: '', ssl: false },
      notes: []
    });
  });

  it('moves https:// to the TLS switch', () => {
    const result = normalizeRelayAddress({
      hostname: 'https://relay.example.com',
      path: '',
      ssl: false
    });
    expect(result).toEqual({
      ok: true,
      address: { hostname: 'relay.example.com', path: '', ssl: true },
      notes: ['Turned on Use TLS because the address started with https://.']
    });
  });

  it('turns TLS off for http:// and ws://', () => {
    for (const scheme of ['http', 'ws']) {
      const result = normalizeRelayAddress({
        hostname: `${scheme}://relay.example.com:9001`,
        path: '',
        ssl: true
      });
      expect(result.ok && result.address).toEqual({
        hostname: 'relay.example.com:9001',
        path: '',
        ssl: false
      });
    }
  });

  it('just removes the scheme when TLS already matches', () => {
    const result = normalizeRelayAddress({
      hostname: 'wss://relay.example.com',
      path: '',
      ssl: true
    });
    expect(result).toEqual({
      ok: true,
      address: { hostname: 'relay.example.com', path: '', ssl: true },
      notes: ['Removed wss:// from the address.']
    });
  });

  it('moves a path typed after the host into the path field', () => {
    const result = normalizeRelayAddress({
      hostname: 'https://example.com/~user/weechat/',
      path: '',
      ssl: true
    });
    expect(result).toEqual({
      ok: true,
      address: { hostname: 'example.com', path: '/~user/weechat', ssl: true },
      notes: [
        'Removed https:// from the address.',
        'Moved /~user/weechat to Path.'
      ]
    });
  });

  it('ignores a bare trailing slash', () => {
    const result = normalizeRelayAddress({
      hostname: 'relay.example.com/',
      path: '',
      ssl: true
    });
    expect(result).toEqual({
      ok: true,
      address: { hostname: 'relay.example.com', path: '', ssl: true },
      notes: []
    });
  });

  it('accepts the same path in both places', () => {
    const result = normalizeRelayAddress({
      hostname: 'relay.example.com/weechat',
      path: '/weechat',
      ssl: true
    });
    expect(result).toEqual({
      ok: true,
      address: { hostname: 'relay.example.com', path: '/weechat', ssl: true },
      notes: []
    });
  });

  it('refuses two different paths', () => {
    const result = normalizeRelayAddress({
      hostname: 'relay.example.com/weechat',
      path: '/api',
      ssl: true
    });
    expect(result.ok).toBe(false);
  });

  it('adds a leading slash to the path', () => {
    const result = normalizeRelayAddress({
      hostname: 'relay.example.com',
      path: 'weechat',
      ssl: true
    });
    expect(result.ok && result.address.path).toEqual('/weechat');
  });

  it('requires an address', () => {
    expect(
      normalizeRelayAddress({ hostname: '  ', path: '', ssl: true })
    ).toEqual({
      ok: false,
      error: 'Enter the address of your WeeChat relay.'
    });
  });

  it('rejects other schemes', () => {
    const result = normalizeRelayAddress({
      hostname: 'irc://irc.libera.chat',
      path: '',
      ssl: true
    });
    expect(result.ok).toBe(false);
  });

  it('rejects host names with spaces or credentials', () => {
    for (const hostname of [
      'relay example.com',
      'me:secret@relay.example.com'
    ]) {
      expect(normalizeRelayAddress({ hostname, path: '', ssl: true }).ok).toBe(
        false
      );
    }
  });
});
