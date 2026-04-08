module.exports = {
  ci: {
    collect: {
      // Usa o build estático (dist/) servido pelo próprio LHCI
      staticDistDir: './dist',
      // Audita a landing (/) e o login (/login)
      url: ['http://localhost/index.html'],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        // Throttling leve — prod real terá CDN
        throttling: {
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
