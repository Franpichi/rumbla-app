import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, typography } from '@/utils/constants';

export default function RunScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Run coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  text: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
});
