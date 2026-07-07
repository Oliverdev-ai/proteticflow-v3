import { execSync } from 'child_process';

const checks = [
  {
    name: 'font-black banido',
    cmd: 'rg --no-ignore -l "font-(black|extrabold)" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'cores tailwind cruas',
    cmd: 'rg --no-ignore -l "(bg|text|border)-(blue|emerald|sky|violet|yellow|fuchsia|rose|pink|orange|lime|green|teal|cyan|indigo|purple|red|zinc|slate|gray|neutral|stone|cool)-[0-9]" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'raio >14px',
    cmd: 'rg --no-ignore -l "rounded-(2xl|3xl)" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'raio arbitrario >14px',
    cmd: 'rg --no-ignore -l "rounded-\\[(1[5-9]|[2-9][0-9]|[0-9]{3,})px\\]" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'uppercase com tracking arbitrario',
    cmd: 'rg --no-ignore -l "uppercase.*tracking-\\[|tracking-\\[.*uppercase" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'scale agressivo',
    cmd: 'rg --no-ignore -l "active:scale-9[0-7]|hover:scale-1[1-9]" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'backdrop blur alto',
    cmd: 'rg --no-ignore -l "backdrop-blur-(xl|2xl|3xl)" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'shadow colorida banida',
    cmd: 'rg --no-ignore -l "shadow-(primary|accent|success|warning|destructive|info)/|shadow-(blue|emerald|sky|violet|yellow|fuchsia|rose|pink|orange|lime|green|teal|cyan|indigo|purple|red|zinc|slate|gray|neutral)-[0-9]" apps/web/src',
    expectEmpty: true,
  },
  {
    name: 'emoji em chrome',
    cmd: 'rg --no-ignore -lP "[\\x{2600}-\\x{27BF}]|[\\x{1F300}-\\x{1FAFF}]" apps/web/src/app apps/web/src/components',
    expectEmpty: true,
  },
  {
    name: 'JOB_STATUS legado',
    cmd: 'rg --no-ignore -l "JOB_STATUS_LABELS|JOB_STATUS_COLORS" apps/web/src',
    expectEmpty: true,
  },
];

let failed = 0;

for (const { name, cmd, expectEmpty } of checks) {
  try {
    const output = execSync(cmd, { encoding: 'utf-8' }).trim();
    if (expectEmpty && output.length > 0) {
      console.error(`FAIL [${name}]:\n${output}`);
      failed += 1;
    } else {
      console.log(`OK   [${name}]`);
    }
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : null;
    if (expectEmpty && status === 1) {
      console.log(`OK   [${name}]`);
      continue;
    }

    const stderr = error?.stderr ? String(error.stderr) : '';
    console.error(`ERROR [${name}]`);
    if (stderr.trim().length > 0) {
      console.error(stderr.trim());
    } else {
      console.error(String(error));
    }
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) falharam.`);
  process.exit(1);
}

console.log('\nTodos os checks passaram.');
