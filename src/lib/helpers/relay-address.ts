export type RelayAddress = {
  hostname: string;
  path: string;
  ssl: boolean;
};

export type NormalizedRelayAddress =
  | { ok: true; address: RelayAddress; notes: string[] }
  | { ok: false; error: string };

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;

/**
 * Cleans up what people paste into the relay address field.
 *
 * The connection is built as `ws(s)://<hostname><path>`, so a pasted URL like
 * `https://example.com/weechat` would otherwise connect to a host named
 * "https", and a path typed after the host is silently replaced by the path
 * field. This moves the scheme to the TLS switch and the path to the path
 * field, and returns a note for each change so the screen can say what moved.
 */
export const normalizeRelayAddress = (
  input: RelayAddress
): NormalizedRelayAddress => {
  let hostname = input.hostname.trim();
  let path = input.path.trim();
  let ssl = input.ssl;
  const notes: string[] = [];

  if (!hostname) {
    return { ok: false, error: 'Enter the address of your WeeChat relay.' };
  }

  const scheme = SCHEME.exec(hostname)?.[1].toLowerCase();
  if (scheme !== undefined) {
    if (!['http', 'https', 'ws', 'wss'].includes(scheme)) {
      return {
        ok: false,
        error: `${scheme}:// isn't supported. Enter a host name like relay.example.com.`
      };
    }
    const secure = scheme === 'https' || scheme === 'wss';
    hostname = hostname.slice(scheme.length + 3);
    if (secure !== ssl) {
      ssl = secure;
      notes.push(
        secure
          ? `Turned on Use TLS because the address started with ${scheme}://.`
          : `Turned off Use TLS because the address started with ${scheme}://.`
      );
    } else {
      notes.push(`Removed ${scheme}:// from the address.`);
    }
  }

  // Paths keep any trailing slash: a proxy routing `location /relay/` does
  // not serve `/relay`, so `/relay/` and `/relay` are different relays.
  const slash = hostname.indexOf('/');
  if (slash >= 0) {
    const pathInAddress = hostname.slice(slash);
    hostname = hostname.slice(0, slash);
    if (pathInAddress !== '/' && pathInAddress !== path) {
      if (path) {
        return {
          ok: false,
          error: `The address ends in ${pathInAddress} but Path is ${path}. Keep the path in the Path field only.`
        };
      }
      path = pathInAddress;
      notes.push(`Moved ${pathInAddress} to Path.`);
    }
  }

  if (path && !path.startsWith('/')) path = `/${path}`;

  let parsed: URL;
  try {
    parsed = new URL(`ws://${hostname}`);
  } catch {
    return {
      ok: false,
      error: `“${hostname}” isn't a valid host name. Use something like relay.example.com or relay.example.com:9000.`
    };
  }
  if (parsed.username || parsed.password || /\s/.test(hostname)) {
    return {
      ok: false,
      error: `“${hostname}” isn't a valid host name. Use something like relay.example.com or relay.example.com:9000.`
    };
  }

  return { ok: true, address: { hostname, path, ssl }, notes };
};
