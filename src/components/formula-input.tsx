"use client";

import React, {
  useRef,
  useMemo,
  useLayoutEffect,
  forwardRef,
  useCallback,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { tokenize } from "@/lib/formula-tokenizer";
import type { Token, TokenType } from "@/lib/formula-tokenizer";
import { cn } from "@/lib/utils";

/** Map tokenizer output to theme-aware highlight classes. */
function tokenClassName(type: TokenType): string {
  switch (type) {
    case "number":
      return "formula-num";
    case "string":
      return "formula-str";
    case "true":
    case "false":
    case "null":
      return "formula-kw";
    case "identifier":
      return "formula-id";
    case "plus":
    case "minus":
    case "star":
    case "slash":
    case "percent":
    case "bang":
    case "eqeq":
    case "bangeq":
    case "lt":
    case "gt":
    case "lteq":
    case "gteq":
    case "andand":
    case "oror":
      return "formula-op";
    case "lparen":
    case "rparen":
    case "lbracket":
    case "rbracket":
      return "formula-bracket";
    case "comma":
      return "formula-comma";
    default:
      return "text-foreground";
  }
}

/** Bracket nesting depth per token index (for lparen/rparen/lbracket/rbracket). */
function getBracketDepths(tokens: Token[]): number[] {
  const depths: number[] = [];
  let level = 0;
  for (const token of tokens) {
    if (token.type === "rparen" || token.type === "rbracket") {
      level = Math.max(0, level - 1);
      depths.push(level);
    } else if (token.type === "lparen" || token.type === "lbracket") {
      depths.push(level);
      level++;
    } else {
      depths.push(level);
    }
  }
  return depths;
}

/** Indices of bracket tokens that have no matching pair (unbalanced). */
function getUnmatchedBracketIndices(tokens: Token[]): Set<number> {
  const unmatched = new Set<number>();
  const parenStack: number[] = [];
  const bracketStack: number[] = [];
  tokens.forEach((token, i) => {
    if (token.type === "lparen") {
      parenStack.push(i);
    } else if (token.type === "rparen") {
      if (parenStack.length === 0) unmatched.add(i);
      else parenStack.pop();
    } else if (token.type === "lbracket") {
      bracketStack.push(i);
    } else if (token.type === "rbracket") {
      if (bracketStack.length === 0) unmatched.add(i);
      else bracketStack.pop();
    }
  });
  parenStack.forEach((i) => unmatched.add(i));
  bracketStack.forEach((i) => unmatched.add(i));
  return unmatched;
}

/** Split text into segments; when showUnderlineOnNonSpace, only non-whitespace runs get underline in UI. */
function segmentBySpaces(
  text: string,
  showUnderlineOnNonSpace: boolean
): { text: string; underline: boolean }[] {
  if (!showUnderlineOnNonSpace || text.length === 0)
    return [{ text, underline: false }];
  const segments: { text: string; underline: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const isNonSpace = /\S/.test(text[i]);
    let j = i;
    while (j < text.length && /\S/.test(text[j]) === isNonSpace) j++;
    segments.push({ text: text.slice(i, j), underline: isNonSpace });
    i = j;
  }
  return segments;
}

function getTokenClassName(
  token: Token,
  tokenIndex: number,
  tokens: Token[],
  knownFunctionNames?: Set<string>,
  validationActive?: boolean,
  bracketDepths?: number[],
  unmatchedBracketIndices?: Set<number>
): string {
  if (token.type === "identifier" && tokens[tokenIndex + 1]?.type === "lparen") {
    const isKnownFunction = knownFunctionNames?.has(String(token.value)) ?? false;
    if (validationActive && knownFunctionNames && !isKnownFunction) {
      return "formula-error";
    }
    return "formula-fn";
  }

  const base = tokenClassName(token.type);
  const isBracket =
    token.type === "lparen" ||
    token.type === "rparen" ||
    token.type === "lbracket" ||
    token.type === "rbracket";
  if (isBracket && unmatchedBracketIndices?.has(tokenIndex)) {
    return cn(base, "formula-bracket-unmatched");
  }
  if (isBracket && bracketDepths && bracketDepths[tokenIndex] !== undefined) {
    const d = bracketDepths[tokenIndex] % 5;
    return cn(base, `formula-bracket-depth-${d}`);
  }
  return base;
}

/** Split text into segments; when showErrorUnderline, only non-whitespace segments get the underline. */
function renderWithErrorUnderline(
  text: string,
  baseClassName: string,
  showErrorUnderline: boolean,
  keyPrefix: string
): React.ReactNode {
  if (!showErrorUnderline) {
    return <span key={keyPrefix} className={baseClassName}>{text}</span>;
  }
  const segments: { text: string; underline: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const isSpace = /\s/.test(text[i]);
    let j = i;
    while (j < text.length && /\s/.test(text[j]) === isSpace) j++;
    segments.push({ text: text.slice(i, j), underline: isSpace ? false : true });
    i = j;
  }
  return (
    <span key={keyPrefix} className={baseClassName}>
      {segments.map((seg, idx) =>
        seg.underline ? (
          <span key={`${keyPrefix}-${idx}`} className="formula-error-underline">
            {seg.text}
          </span>
        ) : (
          <span key={`${keyPrefix}-${idx}`}>{seg.text}</span>
        )
      )}
    </span>
  );
}

function renderHighlightSpans(
  value: string,
  tokens: ReturnType<typeof tokenize>,
  knownFunctionNames?: Set<string>,
  validationActive?: boolean,
  errorRange?: { start: number; end: number } | null,
  bracketDepths?: number[]
) {
  if (tokens.length === 0) {
    return value ? [<span key="raw" className="text-foreground">{value}</span>] : null;
  }

  const depths = bracketDepths ?? getBracketDepths(tokens);
  const unmatchedBracketIndices = getUnmatchedBracketIndices(tokens);
  const spans: React.ReactNode[] = [];
  let cursor = 0;

  for (const [tokenIndex, token] of tokens.entries()) {
    if (cursor < token.start) {
      const gapStart = cursor;
      const gapEnd = token.start;
      const inError =
        errorRange && gapStart < errorRange.end && gapEnd > errorRange.start;
      spans.push(
        renderWithErrorUnderline(
          value.slice(cursor, token.start),
          "text-foreground",
          !!inError,
          `gap-${cursor}-${token.start}`
        )
      );
    }

    const inError =
      errorRange && token.start < errorRange.end && token.end > errorRange.start;
    const tokenClassName = getTokenClassName(
      token,
      tokenIndex,
      tokens,
      knownFunctionNames,
      validationActive,
      depths,
      unmatchedBracketIndices
    );
    spans.push(
      renderWithErrorUnderline(
        value.slice(token.start, token.end),
        tokenClassName,
        !!inError,
        `tok-${token.start}-${token.end}`
      )
    );

    cursor = token.end;
  }

  if (cursor < value.length) {
    const inError =
      errorRange && cursor < errorRange.end && value.length > errorRange.start;
    spans.push(
      renderWithErrorUnderline(
        value.slice(cursor),
        "text-foreground",
        !!inError,
        `tail-${cursor}`
      )
    );
  }

  return spans;
}

export type FormulaInputProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange" | "onBlur"
> & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  /** Optional error message shown below the input */
  error?: string | null;
  /** When set, the range is underlined in red (coordinates relative to value). */
  errorRange?: { start: number; end: number } | null;
  /** Known functions used to distinguish function calls from plain identifiers. */
  knownFunctionNames?: Set<string>;
  /** When true, validation-based highlight states such as unknown functions are shown. */
  validationActive?: boolean;
  /**
   * When false, disables syntax highlighting and shows plain text.
   * Use as fallback when the overlay has visibility issues (e.g. numbers/identifiers not showing).
   * @default true
   */
  highlight?: boolean;
};

const inputBase =
  "min-h-[4.5rem] w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base font-mono text-sm transition-colors outline-none md:text-sm";

/**
 * Multiline formula input with tokenizer-based syntax highlighting (no extra dependency).
 * Renders an overlay of token spans behind a transparent textarea so caret/selection still work.
 */
export const FormulaInput = forwardRef<HTMLTextAreaElement, FormulaInputProps>(
  function FormulaInput(
    {
      value,
      onChange,
      onBlur,
      error,
      errorRange,
      className,
      placeholder,
      knownFunctionNames,
      validationActive = false,
      highlight = true,
      ...rest
    },
    ref
  ) {
    const highlightRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const setRefs = useCallback(
      (el: HTMLTextAreaElement | null) => {
        (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      },
      [ref]
    );

    const tokens = useMemo(() => {
      if (!value) return [];
      try {
        const list = tokenize(value);
        return list.filter((t) => t.type !== "eof");
      } catch {
        return [];
      }
    }, [value]);

    const highlightSpans = useMemo(
      () =>
        renderHighlightSpans(
          value,
          tokens,
          knownFunctionNames,
          validationActive,
          errorRange ?? null,
          undefined
        ),
      [knownFunctionNames, tokens, validationActive, value, errorRange]
    );

    useLayoutEffect(() => {
      if (!highlight) return;
      const input = inputRef.current;
      const highlightEl = highlightRef.current;
      if (!input || !highlightEl) return;
      const syncScroll = () => {
        highlightEl.scrollLeft = input.scrollLeft;
        highlightEl.scrollTop = input.scrollTop;
      };
      input.addEventListener("scroll", syncScroll);
      return () => input.removeEventListener("scroll", syncScroll);
    }, [highlight]);

    if (!highlight) {
      return (
        <div className="relative w-full">
          <Textarea
            ref={setRefs}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            className={cn(
              inputBase,
              "field-sizing-content",
              className,
              error && "border-destructive focus-visible:ring-destructive"
            )}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            {...rest}
          />
          {error ? (
            <p role="alert" className="mt-1.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="relative w-full">
        <div
          ref={highlightRef}
          aria-hidden
          className={cn(
            inputBase,
            "field-sizing-content pointer-events-none absolute inset-0 overflow-auto whitespace-pre border-transparent font-mono",
            "scrollbar-none [&::-webkit-scrollbar]:hidden",
            className
          )}
        >
          {value ? highlightSpans : <span className="text-muted-foreground">{placeholder}</span>}
        </div>
        <Textarea
          ref={setRefs}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          wrap="off"
          className={cn(
            inputBase,
            "field-sizing-content relative text-transparent caret-foreground selection:bg-primary/30 bg-transparent whitespace-pre overflow-auto",
            "placeholder:text-transparent",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          style={{ caretColor: "var(--foreground)", background: "transparent" }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          {...rest}
        />
        {error ? (
          <p role="alert" className="mt-1.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
