const CN_ALIASES = ['cn', 'cx', 'tw', 'clsx', 'twMerge'];

const BANNED_PATTERNS = [
  {
    regex: /\bfont-(black|extrabold)\b/,
    message: 'DS: font-black/extrabold banido. Maximo: font-bold (700).',
  },
  {
    regex: /\b(bg|text|border)-(blue|emerald|sky|violet|yellow|fuchsia|rose|pink|orange|lime|green|teal|cyan|indigo|purple|red)-\d+/,
    message: 'DS: cor Tailwind crua. Usar token var(--).',
  },
  {
    regex: /\b(bg|text|border)-(zinc|slate|gray|neutral|stone|cool)-\d+/,
    message: 'DS: neutro frio banido. Usar tokens warm (--fg, --bg-muted, etc).',
  },
  {
    regex: /\brounded-(2xl|3xl)\b/,
    message: 'DS: raio maximo radius-lg (14px). Usar rounded-xl ou var(--radius-lg).',
  },
  {
    regex: /\brounded-\[(?:1[5-9]|[2-9]\d|\d{3,})px\]/,
    message: 'DS: raio arbitrario >14px banido.',
  },
  {
    regex: /\buppercase\b(?=.*\btracking-\[)|\btracking-\[(?=.*\buppercase\b)/,
    message: 'DS: uppercase + tracking-[] banido fora de chip/overline. Usar .chip ou .t-overline.',
  },
  {
    regex: /\bactive:scale-9[0-7]\b/,
    message: 'DS: active:scale minimo 0.98 (active:scale-[0.98]).',
  },
  {
    regex: /\bhover:scale-1[1-9]\b/,
    message: 'DS: hover:scale proibido.',
  },
  {
    regex: /\bshadow-(primary|accent|success|warning|destructive|info)\//,
    message: 'DS: sombra colorida banida. Usar shadow-sm ou var(--shadow-*).',
  },
  {
    regex: /\bbackdrop-blur-(xl|2xl|3xl)\b/,
    message: 'DS: backdrop-blur permitido apenas no command palette (z-palette). Usar blur-sm se necessario.',
  },
];

function isCnCall(node) {
  if (node.callee?.type !== 'Identifier') return false;
  return CN_ALIASES.includes(node.callee.name);
}

function isClassNameAttribute(node) {
  return node?.type === 'JSXAttribute' && node.name?.name === 'className';
}

export default {
  rules: {
    guardrails: {
      meta: { type: 'suggestion', fixable: null },
      create(context) {
        function checkString(value, node) {
          if (typeof value !== 'string') return;
          for (const { regex, message } of BANNED_PATTERNS) {
            if (regex.test(value)) {
              context.report({ node, message });
            }
          }
        }

        return {
          JSXAttribute(node) {
            if (!isClassNameAttribute(node)) return;
            const literalValue = node.value?.type === 'Literal' ? node.value.value : null;
            checkString(literalValue, node);

            if (node.value?.type !== 'JSXExpressionContainer') return;
            if (node.value.expression?.type !== 'Literal') return;
            checkString(node.value.expression.value, node);
          },

          CallExpression(node) {
            if (!isCnCall(node)) return;

            function walkArg(arg) {
              if (!arg) return;

              if (arg.type === 'Literal') {
                checkString(arg.value, arg);
                return;
              }

              if (arg.type === 'ConditionalExpression') {
                walkArg(arg.consequent);
                walkArg(arg.alternate);
                return;
              }

              if (arg.type === 'ArrayExpression') {
                for (const element of arg.elements) {
                  if (element) walkArg(element);
                }
              }
            }

            for (const arg of node.arguments) {
              walkArg(arg);
            }
          },

          Literal(node) {
            if (typeof node.value !== 'string') return;
            if (!/^#[0-9A-Fa-f]{3,8}$/.test(node.value.trim())) return;

            if (isClassNameAttribute(node.parent)) {
              context.report({
                node,
                message: 'DS: hex literal em className. Usar token CSS var(--).',
              });
            }
          },
        };
      },
    },
  },
};
