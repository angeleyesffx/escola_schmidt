module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/*.test.{ts,tsx}',
  ],
  // Baseline real do app inteiro (antes, o threshold de 40% só era medido
  // sobre 6 arquivos já testados — dava a falsa impressão de que 40% do app
  // tinha cobertura, quando era ~23%). Piso definido logo abaixo do atual
  // pra não travar o CI à toa; suba estes números conforme for testando mais
  // telas, nunca baixe sem justificar.
  // Atualizado após cobrir signup/reset-password e os ramos de aluno/pedidos
  // de chamada.tsx: branches 23.97%, functions 27.05%, lines 30.28%,
  // statements 29%.
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 27,
      statements: 26,
    },
  },
};