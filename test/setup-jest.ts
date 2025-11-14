// test/setup-jest.ts
// Mock ESM-only 'nanoid' for Jest (CJS). We just need predictable output in tests.
jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'TESTNANOID_ABCDEFGHIJKLMNOPQRSTUVWXYZ12', // 32 chars
}));
