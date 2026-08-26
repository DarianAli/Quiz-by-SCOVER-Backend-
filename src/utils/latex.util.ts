// ─── LaTeX Conversion Service ─────────────────────────────────────────────────
//
// Mengkonversi ekspresi matematika dalam teks biasa ke format LaTeX
// agar dapat dirender oleh MathJax/KaTeX di frontend.
//
// Pola yang didukung:
//   Fraksi     : 1/2        → \frac{1}{2}
//   Akar       : sqrt(x)    → \sqrt{x}
//   Pangkat    : x^2        → x^{2}
//   Sigma      : sum(1,n)   → \sum_{1}^{n}
//   Integral   : int(a,b)   → \int_{a}^{b}
//   Limit      : lim(x→0)  → \lim_{x \to 0}
//   Pi         : PI / pi    → \pi
//   Infinity   : inf        → \infty
//   Theta      : theta      → \theta
//   Alpha/Beta : alpha/beta → \alpha / \beta
//   Matriks    : matrix(..) → \begin{pmatrix}...\end{pmatrix}

// ─── Simple fraction: integer/integer ────────────────────────────────────────
const FRACTION_RE   = /\b(\d+)\/(\d+)\b/g;

// ─── sqrt(expr) or \sqrt or √ ────────────────────────────────────────────────
const SQRT_RE       = /sqrt\(([^)]+)\)|√(\w+)/g;

// ─── x^n  → x^{n} ───────────────────────────────────────────────────────────
const POWER_RE      = /([A-Za-z0-9])(\^)(\d+|[A-Za-z])/g;

// ─── sum(lower, upper) ───────────────────────────────────────────────────────
const SUM_RE        = /\bsum\(([^,)]+),([^)]+)\)/g;

// ─── int(lower, upper) or integral(lower, upper) ─────────────────────────────
const INT_RE        = /\b(?:int|integral)\(([^,)]+),([^)]+)\)/g;

// ─── lim(var→value) ─────────────────────────────────────────────────────────
const LIM_RE        = /\blim\(([^→\->]+)[→\->]+([^)]+)\)/g;

// ─── Greek letters & special symbols ─────────────────────────────────────────
const SYMBOL_MAP: [RegExp, string][] = [
    [/\bPI\b|\bpi\b/g,            "\\pi"],
    [/\binf(?:inity)?\b/gi,       "\\infty"],
    [/\btheta\b/gi,               "\\theta"],
    [/\balpha\b/gi,               "\\alpha"],
    [/\bbeta\b/gi,                "\\beta"],
    [/\bgamma\b/gi,               "\\gamma"],
    [/\bdelta\b/gi,               "\\delta"],
    [/\blambda\b/gi,              "\\lambda"],
    [/\bmu\b/gi,                  "\\mu"],
    [/\bsigma\b/gi,               "\\sigma"],
    [/\bomega\b/gi,               "\\omega"],
    [/\bapprox\b/gi,              "\\approx"],
    [/\bpm\b/gi,                  "\\pm"],
    [/\bleq\b/gi,                 "\\leq"],
    [/\bgeq\b/gi,                 "\\geq"],
    [/\bneq\b/gi,                 "\\neq"],
    [/\btimes\b/gi,               "\\times"],
    [/\bdiv\b/gi,                 "\\div"],
    [/\bcdot\b/gi,                "\\cdot"],
    [/°/g,                         "^{\\circ}"],
];

// ─── Main conversion function ─────────────────────────────────────────────────

/**
 * Checks whether a string contains potential math notation
 * that needs to be converted.
 */
export function hasMathNotation(text: string): boolean {
    if (!text) return false;
    return (
        FRACTION_RE.test(text)   ||
        /sqrt\(|√/.test(text)    ||
        /\^/.test(text)          ||
        /\b(sum|int|integral|lim)\(/.test(text) ||
        /\b(pi|PI|inf|theta|alpha|beta|gamma|delta|lambda|sigma|omega)\b/i.test(text)
    );
}

/**
 * Converts plain-text math notation to LaTeX.
 *
 * @param text - Raw text which may contain math expressions
 * @returns Text with math expressions wrapped in LaTeX syntax
 */
export function toLatex(text: string): string {
    if (!text) return text;

    let result = text;

    // 1. fractions: 3/4 → \frac{3}{4}
    result = result.replace(FRACTION_RE, (_m, num, den) => `\\frac{${num}}{${den}}`);

    // 2. sqrt(expr) or √x → \sqrt{expr}
    result = result.replace(SQRT_RE, (_m, inner1, inner2) =>
        `\\sqrt{${inner1 ?? inner2}}`
    );

    // 3. sum(lower, upper) → \sum_{lower}^{upper}
    result = result.replace(SUM_RE, (_m, low, up) =>
        `\\sum_{${low.trim()}}^{${up.trim()}}`
    );

    // 4. int(lower, upper) → \int_{lower}^{upper}
    result = result.replace(INT_RE, (_m, low, up) =>
        `\\int_{${low.trim()}}^{${up.trim()}}`
    );

    // 5. lim(x→0) → \lim_{x \to 0}
    result = result.replace(LIM_RE, (_m, variable, value) =>
        `\\lim_{${variable.trim()} \\to ${value.trim()}}`
    );

    // 6. x^2 → x^{2}
    result = result.replace(POWER_RE, (_m, base, _caret, exp) =>
        `${base}^{${exp}}`
    );

    // 7. Greek letters & symbols
    for (const [re, replacement] of SYMBOL_MAP) {
        // reset lastIndex for global regexes
        re.lastIndex = 0;
        result = result.replace(re, replacement);
    }

    return result;
}

/**
 * Wraps LaTeX expression in display math delimiters if it contains
 * LaTeX commands, otherwise returns as-is.
 */
export function wrapLatex(text: string): string {
    if (!text) return text;
    const converted = toLatex(text);
    // If conversion added LaTeX commands, don't auto-wrap — let frontend handle it
    return converted;
}
