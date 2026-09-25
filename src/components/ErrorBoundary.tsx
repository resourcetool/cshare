import React from 'react';
import { View } from 'react-native';
import { colors, space } from '../theme';
import { logError } from '../utils/errors';
import { Body, Button, Title } from './ui';

interface State {
  failed: boolean;
}

/** Last line of defence: a friendly screen instead of a blank one. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    logError('render crash', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg }}>
        <Title>Something went wrong</Title>
        <Body style={{ marginVertical: space.lg }}>CSHARE ran into a problem. Your assignments are safe. Please try again.</Body>
        <Button label="Try again" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}
