// Reanimated 4 runs on react-native-worklets, which has no native side in Jest: use its mock,
// then Reanimated's test helpers so animations complete synchronously.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-reanimated').setUpTests();
