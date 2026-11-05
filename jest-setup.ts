import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return
  require('react-native-worklets/src/mock')
);

jest.mock('@expo/ui', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const React = jest.requireActual<typeof import('react')>('react');

  const FieldGroup = RN.ScrollView as typeof RN.ScrollView & {
    Section: typeof RN.View;
    SectionHeader: typeof RN.View;
    SectionFooter: typeof RN.View;
  };
  FieldGroup.Section = RN.View;
  FieldGroup.SectionHeader = RN.View;
  FieldGroup.SectionFooter = RN.View;

  const Button = ({
    label,
    onPress,
    testID,
    children
  }: {
    label?: string;
    onPress?: () => void;
    testID?: string;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      RN.Pressable,
      { onPress, testID, accessibilityRole: 'button' },
      children ?? React.createElement(RN.Text, null, label)
    );

  const Picker = Object.assign(
    ({
      testID,
      selectedValue,
      onValueChange,
      children
    }: {
      testID?: string;
      selectedValue: unknown;
      onValueChange: (value: unknown) => void;
      children?: React.ReactNode;
    }) =>
      React.createElement(
        RN.View,
        { testID, selectedValue, onValueChange } as object,
        children
      ),
    { Item: () => null }
  );

  return {
    Host: RN.View,
    Switch: RN.Switch,
    TextInput: RN.TextInput,
    Text: RN.Text,
    FieldGroup: FieldGroup,
    Row: RN.View,
    Spacer: RN.View,
    Button,
    Picker
  };
});
