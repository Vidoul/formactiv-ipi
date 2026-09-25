// Convention de messages de commit : Conventional Commits (cf. CONTRIBUTING.md).
// Exemples : "feat(auth): verrouillage après 5 échecs (RG-AUTH-02)", "fix(web): focus visible".
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'api',
        'web',
        'db',
        'auth',
        'utilisateurs',
        'formations',
        'sessions',
        'inscriptions',
        'evaluations',
        'documents',
        'reporting',
        'rgpd',
        'journal',
        'e2e',
        'ci',
        'docker',
        'docs',
        'deps',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
