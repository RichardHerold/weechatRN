import { HeaderHeightContext } from '@react-navigation/elements';
import type { RouteProp } from '@react-navigation/native';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import type { ConnectionError } from '../../../src/lib/weechat/connection';
import { reducer } from '../../../src/store';
import type { Settings } from '../../../src/store/settings';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent
} from '../../../src/test-utils';
import type { RootStackParamList } from '../../../src/usecase/Root';
import ConnectionSettings from '../../../src/usecase/settings/ConnectionSettings';

type ConnectionControls = {
  connecting: boolean;
  connectionError: ConnectionError | null;
  connect: () => void;
  disconnect: () => void;
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual<object>('@react-navigation/native'),
  usePreventRemove: jest.fn()
}));

const savedSettings: Settings = {
  hostname: 'relay.example.com',
  path: null,
  password: 'secret',
  ssl: true,
  filterBuffers: true,
  protocol: 'api',
  mediaUploadOptions: { basicAuth: false }
};

const emptySettings: Settings = {
  hostname: null,
  path: null,
  password: null,
  ssl: true,
  filterBuffers: true,
  protocol: 'weechat',
  mediaUploadOptions: { basicAuth: true }
};

const renderSettings = async ({
  settings = savedSettings,
  connected = false,
  controls = {}
}: {
  settings?: Settings;
  connected?: boolean;
  controls?: Partial<ConnectionControls>;
} = {}) => {
  const store = configureStore({
    reducer,
    preloadedState: {
      settings,
      app: {
        connected,
        currentBufferId: null,
        notification: null,
        currentBufferLinesFetched: false,
        version: ''
      }
    }
  });
  const connection: ConnectionControls = {
    connecting: false,
    connectionError: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    ...controls
  };
  const navigation = {
    navigate: jest.fn(),
    dispatch: jest.fn()
  } as unknown as NativeStackNavigationProp<
    RootStackParamList,
    'Connection Settings'
  >;

  await render(
    <HeaderHeightContext.Provider value={0}>
      <ConnectionSettings
        route={{} as RouteProp<RootStackParamList, 'Connection Settings'>}
        navigation={navigation}
        {...connection}
      />
    </HeaderHeightContext.Provider>,
    { store }
  );

  return { store, connection, navigation };
};

const lastPreventRemove = () => jest.mocked(usePreventRemove).mock.lastCall;

describe('ConnectionSettings', () => {
  beforeEach(() => {
    jest.mocked(usePreventRemove).mockClear();
  });

  it('labels the saved relay and shows the connection status', async () => {
    await renderSettings({ connected: true });

    expect(screen.getByTestId('settings-status')).toHaveTextContent(
      'Connected'
    );
    expect(screen.getByTestId('settings-status-detail')).toHaveTextContent(
      'relay.example.com · API protocol'
    );
    expect(screen.getByText('Address')).toBeOnTheScreen();
    expect(screen.getByText('Path')).toBeOnTheScreen();
    expect(screen.getByText('Password')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-hostname').props.defaultValue).toBe(
      'relay.example.com'
    );
    expect(screen.getByTestId('settings-path').props.placeholder).toBe(
      'Default (/api)'
    );
    expect(screen.getByTestId('settings-disconnect')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-save')).not.toBeOnTheScreen();
  });

  it('explains what to do on first run', async () => {
    await renderSettings({ settings: emptySettings });

    expect(screen.getByTestId('settings-status')).toHaveTextContent(
      'Not set up yet'
    );
    expect(screen.getByTestId('settings-status-detail')).toHaveTextContent(
      'Fill in your relay below, then tap Save and connect.'
    );
    expect(screen.queryByTestId('settings-connect')).not.toBeOnTheScreen();
  });

  it('shows the last connection error when disconnected', async () => {
    const connectionError: ConnectionError = {
      message: () =>
        'Failed to authenticate with weechat relay. Check password.'
    };
    await renderSettings({ controls: { connectionError } });

    expect(screen.getByTestId('settings-status')).toHaveTextContent(
      'Not connected'
    );
    expect(screen.getByTestId('settings-status-detail')).toHaveTextContent(
      'Failed to authenticate with weechat relay. Check password.'
    );
    expect(screen.getByTestId('settings-connect')).toBeOnTheScreen();
  });

  it('saves a pasted URL as host, path and TLS, then connects', async () => {
    const { store, connection } = await renderSettings({
      settings: emptySettings
    });

    await userEvent.type(
      screen.getByTestId('settings-hostname'),
      'https://example.com/~me/weechat'
    );
    await userEvent.type(screen.getByTestId('settings-password'), 'hunter2');
    await fireEvent(screen.getByTestId('settings-ssl'), 'onValueChange', false);

    expect(screen.getByTestId('settings-save')).toHaveTextContent(
      'Save and connect'
    );
    await fireEvent.press(screen.getByTestId('settings-save'));

    const settings = store.getState().settings;
    expect(settings.hostname).toBe('example.com');
    expect(settings.path).toBe('/~me/weechat');
    expect(settings.ssl).toBe(true);
    expect(settings.password).toBe('hunter2');
    expect(settings.protocol).toBe('weechat');
    expect(connection.disconnect).not.toHaveBeenCalled();
    expect(connection.connect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('settings-relay-footer')).toHaveTextContent(
      /Turned on Use TLS because the address started with https:\/\/\. Moved \/~me\/weechat to Path\./
    );
    expect(screen.queryByTestId('settings-save')).not.toBeOnTheScreen();
  });

  it('reconnects with the new settings when already connected', async () => {
    const { store, connection } = await renderSettings({ connected: true });

    await fireEvent(
      screen.getByTestId('settings-protocol'),
      'onValueChange',
      'weechat'
    );
    expect(screen.getByTestId('settings-path').props.placeholder).toBe(
      'Default (/weechat)'
    );

    expect(screen.getByTestId('settings-save')).toHaveTextContent(
      'Save and reconnect'
    );
    await fireEvent.press(screen.getByTestId('settings-save'));

    expect(store.getState().settings.protocol).toBe('weechat');
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
    expect(connection.connect).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid settings out of the store', async () => {
    const { store, connection } = await renderSettings({
      settings: emptySettings
    });

    await userEvent.type(
      screen.getByTestId('settings-hostname'),
      'relay.example.com'
    );
    await fireEvent.press(screen.getByTestId('settings-save'));

    expect(screen.getByTestId('settings-error')).toHaveTextContent(
      /Enter the relay password/
    );
    expect(store.getState().settings.hostname).toBeNull();
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it('discards unsaved edits', async () => {
    const { store } = await renderSettings();

    await userEvent.clear(screen.getByTestId('settings-hostname'));
    await userEvent.type(
      screen.getByTestId('settings-hostname'),
      'other.example.com'
    );
    expect(lastPreventRemove()?.[0]).toBe(true);

    await fireEvent.press(screen.getByTestId('settings-discard'));

    expect(screen.getByTestId('settings-hostname').props.defaultValue).toBe(
      'relay.example.com'
    );
    expect(screen.queryByTestId('settings-save')).not.toBeOnTheScreen();
    expect(lastPreventRemove()?.[0]).toBe(false);
    expect(store.getState().settings.hostname).toBe('relay.example.com');
  });

  it('asks before leaving with unsaved edits', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { navigation } = await renderSettings();

    await userEvent.type(screen.getByTestId('settings-path'), '/weechat');

    const callback = lastPreventRemove()?.[1];
    const action = { type: 'GO_BACK' };
    await act(() => callback?.({ data: { action } }));

    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2];
    expect(buttons?.map((button) => button.text)).toEqual([
      'Keep editing',
      'Discard',
      'Save and connect'
    ]);

    await act(() => buttons?.[1].onPress?.());
    expect(navigation.dispatch).toHaveBeenCalledWith(action);

    alert.mockRestore();
  });

  it('applies the server buffer option right away without saving relay edits', async () => {
    const { store } = await renderSettings();

    await userEvent.type(screen.getByTestId('settings-password'), 'more');
    await fireEvent(
      screen.getByTestId('settings-filter-buffers'),
      'onValueChange',
      false
    );

    const settings = store.getState().settings;
    expect(settings.filterBuffers).toBe(false);
    expect(settings.password).toBe('secret');
  });
});
