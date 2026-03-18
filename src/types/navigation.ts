// Navigation param list types for React Navigation.
// Import these wherever useNavigation or StackScreenProps is used.

export type OnboardingStackParamList = {
  Auth: undefined;
};

export type RunStackParamList = {
  RunHome: undefined;
  RunSummary: {
    conqueredCount:  number;
    stolenCount:     number;
    distanceMeters:  number;
    durationSeconds: number;
  };
};

export type MainTabParamList = {
  Map:     undefined;
  Run:     undefined;  // entry point of RunStack
  Feed:    undefined;
  Profile: undefined;
};
