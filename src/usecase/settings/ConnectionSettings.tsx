import {
  Button,
  FieldGroup,
  Host,
  Picker,
  Row,
  Spacer,
  Switch,
  Text,
  TextInput
} from '@expo/ui';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import {
  accessibilityLabel,
  buttonStyle,
  foregroundStyle
} from '@expo/ui/swift-ui/modifiers';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useState } from 'react';
import { Alert, Platform, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createSelector } from 'reselect';
import { KeyboardAvoidingView } from '../../../modules/keyboard-avoiding-view';
import { normalizeRelayAddress } from '../../lib/helpers/relay-address';
import type { ConnectionError } from '../../lib/weechat/connection';
import type { StoreState } from '../../store';
import { setConnectionInfoAction } from '../../store/actions';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { ConnectionOptions } from '../../store/settings';
import type { RootStackParamList } from '../Root';
import { styles } from './styles';

type NavigationProps = NativeStackScreenProps<
  RootStackParamList,
  'Connection Settings'
>;

type Props = NavigationProps & {
  connect: () => void;
  disconnect: () => void;
  connecting: boolean;
  connectionError: ConnectionError | null;
};

type Protocol = ConnectionOptions['protocol'];

type RelayDraft = {
  protocol: Protocol;
  hostname: string;
  path: string;
  password: string;
  ssl: boolean;
};

const selectConnectionOptions = createSelector(
  [(state: StoreState) => state.settings],
  ({
    hostname,
    password,
    ssl,
    filterBuffers,
    path,
    protocol
  }): ConnectionOptions => ({
    hostname,
    password,
    ssl,
    filterBuffers,
    path,
    protocol
  })
);

const draftFrom = (options: ConnectionOptions): RelayDraft => ({
  protocol: options.protocol,
  hostname: options.hostname ?? '',
  path: options.path ?? '',
  password: options.password ?? '',
  ssl: options.ssl
});

const sameDraft = (a: RelayDraft, b: RelayDraft): boolean =>
  a.protocol === b.protocol &&
  a.hostname === b.hostname &&
  a.path === b.path &&
  a.password === b.password &&
  a.ssl === b.ssl;

const PROTOCOL_LABEL: Record<Protocol, string> = {
  api: 'API',
  weechat: 'WeeChat'
};

const DEFAULT_PATH: Record<Protocol, string> = {
  api: '/api',
  weechat: '/weechat'
};

// Buttons inside a row only take taps on their label; full-width rows use the
// Form's default button look. Both are iOS-only modifiers.
const inlineButton = Platform.select({
  ios: [buttonStyle('borderless')],
  default: undefined
});
const rowButton = Platform.select({
  ios: [buttonStyle('automatic')],
  default: undefined
});
const secondary = Platform.select({
  ios: [foregroundStyle({ type: 'hierarchical', style: 'secondary' })],
  default: undefined
});

const ConnectionSettings: React.FC<Props> = ({
  navigation,
  connect,
  disconnect,
  connecting,
  connectionError
}) => {
  const theme = useColorScheme();
  const dispatch = useAppDispatch();
  const saved = useAppSelector(selectConnectionOptions);
  const connected = useAppSelector((state) => state.app.connected);

  const [draft, setDraft] = useState(() => draftFrom(saved));
  // Text fields keep their own text; bumping the key reloads them after a
  // save normalizes the address or a discard restores the saved values.
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const dirty = !sameDraft(draft, draftFrom(saved));
  const active = connected || connecting;
  const configured = Boolean(saved.hostname && saved.password);

  const update = (change: Partial<RelayDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setError(null);
    setNotes([]);
  };

  const discard = () => {
    setDraft(draftFrom(saved));
    setFormKey((key) => key + 1);
    setError(null);
    setNotes([]);
  };

  const save = (): boolean => {
    const result = normalizeRelayAddress({
      hostname: draft.hostname,
      path: draft.path,
      ssl: draft.ssl
    });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    if (!draft.password) {
      setError(
        'Enter the relay password you set with /set relay.network.password in WeeChat.'
      );
      return false;
    }

    const { hostname, path, ssl } = result.address;
    dispatch(
      setConnectionInfoAction({
        ...saved,
        protocol: draft.protocol,
        hostname,
        path: path || null,
        password: draft.password,
        ssl
      })
    );
    setDraft({ ...draft, hostname, path, ssl });
    setFormKey((key) => key + 1);
    setError(null);
    setNotes(result.notes);
    return true;
  };

  const saveAndConnect = (): boolean => {
    if (!save()) return false;
    if (active) disconnect();
    connect();
    return true;
  };

  const saveLabel = active ? 'Save and reconnect' : 'Save and connect';

  usePreventRemove(dirty, ({ data }) => {
    Alert.alert(
      'Save your relay settings?',
      "You changed the relay settings but haven't saved them.",
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action)
        },
        {
          text: saveLabel,
          onPress: () => {
            if (saveAndConnect()) navigation.dispatch(data.action);
          }
        }
      ]
    );
  });

  const setFilterBuffers = (filterBuffers: boolean) => {
    dispatch(setConnectionInfoAction({ ...saved, filterBuffers }));
  };

  const status = connected
    ? 'Connected'
    : connecting
      ? 'Connecting…'
      : configured
        ? 'Not connected'
        : 'Not set up yet';
  const statusDetail =
    !active && connectionError
      ? connectionError.message()
      : configured
        ? `${saved.hostname} · ${PROTOCOL_LABEL[saved.protocol]} protocol`
        : `Fill in your relay below, then tap ${saveLabel}.`;

  const errorColor = theme === 'dark' ? '#ff6961' : '#c4281c';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['right', 'bottom', 'left']} style={{ flex: 1 }}>
        <StatusBar
          barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        />

        <KeyboardAvoidingView
          enabled={Platform.OS === 'android'}
          style={{ flex: 1 }}
        >
          <Host style={{ flex: 1 }}>
            <FieldGroup>
              <FieldGroup.Section title="Connection">
                <Row alignment="center" spacing={8}>
                  <Text testID="settings-status">{status}</Text>
                  <Spacer flexible />
                  {active ? (
                    <Button
                      label="Disconnect"
                      variant="text"
                      modifiers={inlineButton}
                      onPress={disconnect}
                      testID="settings-disconnect"
                    />
                  ) : configured && !dirty ? (
                    <Button
                      label="Connect"
                      variant="text"
                      modifiers={inlineButton}
                      onPress={connect}
                      testID="settings-connect"
                    />
                  ) : null}
                </Row>
                <Text
                  modifiers={secondary}
                  textStyle={{
                    fontSize: 13,
                    ...(Platform.OS !== 'ios' && {
                      color: theme === 'dark' ? '#9d9da3' : '#6c6c70'
                    })
                  }}
                  testID="settings-status-detail"
                >
                  {statusDetail}
                </Text>
              </FieldGroup.Section>

              <FieldGroup.Section title="Relay">
                <Row alignment="center">
                  <Text>Protocol</Text>
                  <Spacer flexible />
                  <Picker
                    selectedValue={draft.protocol}
                    onValueChange={(protocol) => update({ protocol })}
                    testID="settings-protocol"
                  >
                    <Picker.Item label={PROTOCOL_LABEL.api} value="api" />
                    <Picker.Item
                      label={PROTOCOL_LABEL.weechat}
                      value="weechat"
                    />
                  </Picker>
                </Row>
                <Row alignment="center" spacing={12}>
                  <Text>Address</Text>
                  <TextInput
                    key={`hostname-${formKey}`}
                    defaultValue={draft.hostname}
                    onChangeText={(hostname) => update({ hostname })}
                    placeholder="relay.example.com"
                    textAlign="right"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    modifiers={[accessibilityLabel('Relay address')]}
                    testID="settings-hostname"
                  />
                </Row>
                <Row alignment="center" spacing={12}>
                  <Text>Path</Text>
                  <TextInput
                    key={`path-${formKey}`}
                    defaultValue={draft.path}
                    onChangeText={(path) => update({ path })}
                    placeholder={`Default (${DEFAULT_PATH[draft.protocol]})`}
                    textAlign="right"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    modifiers={[accessibilityLabel('Relay path')]}
                    testID="settings-path"
                  />
                </Row>
                <Row alignment="center" spacing={12}>
                  <Text>Password</Text>
                  <TextInput
                    key={`password-${formKey}`}
                    defaultValue={draft.password}
                    onChangeText={(password) => update({ password })}
                    placeholder="Required"
                    textAlign="right"
                    autoCapitalize="none"
                    secureTextEntry
                    modifiers={[accessibilityLabel('Relay password')]}
                    testID="settings-password"
                  />
                </Row>
                <Switch
                  label="Use TLS"
                  value={draft.ssl}
                  onValueChange={(ssl) => update({ ssl })}
                  testID="settings-ssl"
                />
                {error !== null && (
                  <Text
                    textStyle={{ color: errorColor }}
                    testID="settings-error"
                  >
                    {error}
                  </Text>
                )}
                <FieldGroup.SectionFooter>
                  <Text testID="settings-relay-footer">
                    {[
                      ...notes,
                      'Use the protocol and port you set up with /relay add in WeeChat. The address can include a port, like relay.example.com:9000.'
                    ].join(' ')}
                  </Text>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>

              {dirty && (
                <FieldGroup.Section>
                  <Button
                    label={saveLabel}
                    modifiers={rowButton}
                    onPress={saveAndConnect}
                    testID="settings-save"
                  />
                  <Button
                    label="Discard changes"
                    variant="text"
                    modifiers={rowButton}
                    onPress={discard}
                    testID="settings-discard"
                  />
                </FieldGroup.Section>
              )}

              <FieldGroup.Section title="Buffer list">
                <Switch
                  label="Hide quiet server buffers"
                  value={saved.filterBuffers}
                  onValueChange={setFilterBuffers}
                  testID="settings-filter-buffers"
                />
                <FieldGroup.SectionFooter>
                  <Text>
                    Server buffers still appear when they have new activity.
                  </Text>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>

              {Platform.select({
                ios: (
                  <Button
                    modifiers={[buttonStyle('automatic')]}
                    onPress={() => navigation.navigate('Media Upload Settings')}
                    label="Media Upload Settings"
                  ></Button>
                ),
                android: (
                  <FieldGroup.Section
                    modifiers={[
                      clickable(
                        () => navigation.navigate('Media Upload Settings'),
                        {
                          indication: true
                        }
                      )
                    ]}
                  >
                    <Text>Media Upload Settings</Text>
                  </FieldGroup.Section>
                )
              })}
            </FieldGroup>
          </Host>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default memo(ConnectionSettings);
