import { describe, it, expect } from "bun:test";
import {
  Placeholders,
  stripComments,
  hasPartialPlaceholder,
  findOuterMarkers,
  findInnermostMarkers,
  splitOnPipe,
  parseMarkerHead,
  parseIfMarker,
  parseCleanupMarker,
  resolveMarkers,
  applyCleanupDirectives,
  selectCreatorOutput,
  spliceAtParagraph,
} from "./placeholders";

const baseEvalContext = {
  capturedCreatorOutput: "",
  storyCards: [] as StoryCard[],
};

function withCapture(text: string) {
  return { ...baseEvalContext, capturedCreatorOutput: text };
}

function withCards(cards: StoryCard[]) {
  return { ...baseEvalContext, storyCards: cards };
}

describe("stripComments", () => {
  it("removes a simple comment", () => {
    expect(stripComments("hello {{% note %}} world")).toBe("hello  world");
  });

  it("removes multiple comments", () => {
    expect(stripComments("a {{% one %}} b {{% two %}} c")).toBe("a  b  c");
  });

  it("leaves text alone with no comments", () => {
    expect(stripComments("plain text")).toBe("plain text");
  });

  it("leaves an unclosed comment in place", () => {
    expect(stripComments("hello {{% never closes")).toBe(
      "hello {{% never closes"
    );
  });

  it("removes a comment containing other markers", () => {
    expect(stripComments("a {{% {{default x | y}} %}} b")).toBe("a  b");
  });
});

describe("findOuterMarkers", () => {
  it("finds a single marker", () => {
    const markers = findOuterMarkers("hello {{default ${x} | y}} world");
    expect(markers).toHaveLength(1);
    expect(markers[0]?.body).toBe("default ${x} | y");
  });

  it("finds multiple markers", () => {
    const markers = findOuterMarkers("{{a}} and {{b}}");
    expect(markers).toHaveLength(2);
    expect(markers[0]?.body).toBe("a");
    expect(markers[1]?.body).toBe("b");
  });

  it("returns the outermost when nested", () => {
    const markers = findOuterMarkers("{{outer {{inner}}}}");
    expect(markers).toHaveLength(1);
    expect(markers[0]?.body).toBe("outer {{inner}}");
  });

  it("ignores an unclosed marker", () => {
    const markers = findOuterMarkers("{{never closes");
    expect(markers).toHaveLength(0);
  });
});

describe("findInnermostMarkers", () => {
  it("returns innermost when nested two levels deep", () => {
    const markers = findInnermostMarkers("{{outer {{inner stuff}}}}");
    expect(markers).toHaveLength(1);
    expect(markers[0]?.body).toBe("inner stuff");
  });

  it("returns innermost across siblings", () => {
    const markers = findInnermostMarkers("a {{x}} b {{y {{z}}}}");
    const bodies = markers.map((m) => m.body).sort();
    expect(bodies).toEqual(["x", "z"]);
  });

  it("preserves position relative to original text", () => {
    const text = "before {{outer {{inner}}}} after";
    const innermost = findInnermostMarkers(text);
    expect(innermost).toHaveLength(1);
    const m = innermost[0]!;
    expect(text.slice(m.start, m.end)).toBe("{{inner}}");
  });
});

describe("splitOnPipe", () => {
  it("splits on pipes", () => {
    expect(splitOnPipe("a | b | c")).toEqual(["a ", " b ", " c"]);
  });

  it("respects double quotes", () => {
    expect(splitOnPipe('a | "b|c" | d')).toEqual(["a ", ' "b|c" ', " d"]);
  });

  it("respects single quotes", () => {
    expect(splitOnPipe("a | 'b|c' | d")).toEqual(["a ", " 'b|c' ", " d"]);
  });

  it("treats apostrophes inside words as plain text, not quote delimiters", () => {
    expect(splitOnPipe("Thor's hammer. | fallback")).toEqual([
      "Thor's hammer. ",
      " fallback",
    ]);
  });

  it("handles multiline content between pipes", () => {
    expect(splitOnPipe("Thor's hammer.\n\n | fallback")).toEqual([
      "Thor's hammer.\n\n ",
      " fallback",
    ]);
  });

  it("returns single element when no pipes", () => {
    expect(splitOnPipe("just text")).toEqual(["just text"]);
  });
});

describe("parseMarkerHead", () => {
  it("parses a single token", () => {
    expect(parseMarkerHead("capture")).toEqual({ type: "capture", args: "" });
  });

  it("parses type + args", () => {
    expect(parseMarkerHead("default x | y")).toEqual({
      type: "default",
      args: "x | y",
    });
  });

  it("lowercases the type", () => {
    expect(parseMarkerHead("Default x | y")?.type).toBe("default");
  });

  it("returns undefined for empty body", () => {
    expect(parseMarkerHead("")).toBeUndefined();
    expect(parseMarkerHead("   ")).toBeUndefined();
  });
});

describe("parseIfMarker", () => {
  it("parses a fuzzy branch form with default threshold", () => {
    const parsed = parseIfMarker('Jake ~= "Alice,Jake" | yes | no');
    expect(parsed?.comparator.kind).toBe("fuzzy");
    if (parsed?.comparator.kind === "fuzzy") {
      expect(parsed.comparator.threshold).toBe(70);
      expect(parsed.comparator.rhs).toBe("Alice,Jake");
    }
    expect(parsed?.terminator.kind).toBe("branch");
  });

  it("parses a fuzzy branch form with custom threshold", () => {
    const parsed = parseIfMarker('Jake ~=85 "Alice,Jake" | yes | no');
    if (parsed?.comparator.kind === "fuzzy") {
      expect(parsed.comparator.threshold).toBe(85);
    } else {
      throw new Error("expected fuzzy");
    }
  });

  it("parses an exact branch form", () => {
    const parsed = parseIfMarker('yes == "y,yes" | a | b');
    expect(parsed?.comparator.kind).toBe("exact");
  });

  it("parses a math branch form", () => {
    const parsed = parseIfMarker("18 > 17 | adult | minor");
    expect(parsed?.comparator.kind).toBe("math");
    if (parsed?.comparator.kind === "math") {
      expect(parsed.comparator.op).toBe(">");
    }
  });

  it("parses a transclude form", () => {
    const parsed = parseIfMarker('Excalibur ~= "mythical-weapons" transclude');
    expect(parsed?.terminator.kind).toBe("transclude");
  });

  it("rejects transclude with a math comparator", () => {
    expect(parseIfMarker("18 > 5 transclude")).toBeUndefined();
  });

  it("rejects a malformed marker missing pipe", () => {
    expect(parseIfMarker("18 > 5")).toBeUndefined();
  });
});

describe("evalDefault via resolveMarkers", () => {
  it("uses the expression when non-empty", () => {
    expect(
      resolveMarkers("{{default Jake | Adventurer}}", baseEvalContext)
    ).toBe("Jake");
  });

  it("uses the fallback when expression is empty", () => {
    expect(resolveMarkers("{{default  | Adventurer}}", baseEvalContext)).toBe(
      "Adventurer"
    );
  });

  it("uses the fallback when expression is whitespace", () => {
    expect(resolveMarkers("{{default    | Adventurer}}", baseEvalContext)).toBe(
      "Adventurer"
    );
  });
});

describe("evalIf branch form via resolveMarkers", () => {
  it("returns thenText on fuzzy match above threshold", () => {
    expect(
      resolveMarkers(
        '{{if Excalibur ~= "Excalibur,Mjolnir" | got it | nope}}',
        baseEvalContext
      )
    ).toBe("got it");
  });

  it("returns elseText on fuzzy match below threshold", () => {
    expect(
      resolveMarkers(
        '{{if foobar ~= "Excalibur,Mjolnir" | got it | nope}}',
        baseEvalContext
      )
    ).toBe("nope");
  });

  it("honours custom threshold", () => {
    expect(
      resolveMarkers(
        '{{if Excaliber ~=99 "Excalibur" | hit | miss}}',
        baseEvalContext
      )
    ).toBe("miss");
    expect(
      resolveMarkers(
        '{{if Excaliber ~=70 "Excalibur" | hit | miss}}',
        baseEvalContext
      )
    ).toBe("hit");
  });

  it("handles exact match case-insensitively", () => {
    expect(
      resolveMarkers('{{if YES == "y,yes" | sure | naw}}', baseEvalContext)
    ).toBe("sure");
    expect(
      resolveMarkers('{{if no == "y,yes" | sure | naw}}', baseEvalContext)
    ).toBe("naw");
  });

  it("handles math comparators", () => {
    expect(
      resolveMarkers("{{if 18 > 17 | adult | minor}}", baseEvalContext)
    ).toBe("adult");
    expect(
      resolveMarkers("{{if 16 > 17 | adult | minor}}", baseEvalContext)
    ).toBe("minor");
    expect(resolveMarkers("{{if 18 >= 18 | yes | no}}", baseEvalContext)).toBe(
      "yes"
    );
    expect(resolveMarkers("{{if 5 < 10 | yes | no}}", baseEvalContext)).toBe(
      "yes"
    );
    expect(resolveMarkers("{{if 5 == 5 | yes | no}}", baseEvalContext)).toBe(
      "yes"
    );
    expect(resolveMarkers("{{if 5 != 6 | yes | no}}", baseEvalContext)).toBe(
      "yes"
    );
  });

  it("supports trailing arithmetic on LHS", () => {
    expect(resolveMarkers("{{if 18+5 > 20 | yes | no}}", baseEvalContext)).toBe(
      "yes"
    );
    expect(
      resolveMarkers("{{if 10*2 == 20 | yes | no}}", baseEvalContext)
    ).toBe("yes");
  });

  it("falls back to string equality for non-numeric ==/!=", () => {
    expect(
      resolveMarkers("{{if apple == apple | yes | no}}", baseEvalContext)
    ).toBe("yes");
    expect(
      resolveMarkers("{{if apple != pear | yes | no}}", baseEvalContext)
    ).toBe("yes");
  });
});

describe("evalIf transclude form via resolveMarkers", () => {
  const weaponCards: StoryCard[] = [
    {
      id: "1",
      title: "Excalibur",
      type: "mythical-weapons",
      entry: "The blade of kings.",
      keys: ["Excalibur"],
    },
    {
      id: "2",
      title: "Mjolnir",
      type: "mythical-weapons",
      entry: "Thor's hammer.",
      keys: ["Mjolnir"],
    },
    {
      id: "3",
      title: "Random Sword",
      type: "common-weapons",
      entry: "An ordinary blade.",
      keys: ["sword"],
    },
  ];

  it("transcludes the matched card entry (fuzzy)", () => {
    expect(
      resolveMarkers(
        '{{if Excalibur ~= "mythical-weapons" transclude}}',
        withCards(weaponCards)
      )
    ).toBe("The blade of kings.");
  });

  it("matches via card keys when title differs", () => {
    const cards: StoryCard[] = [
      {
        id: "1",
        title: "Lightning Hammer",
        type: "mythical-weapons",
        entry: "Crackling power.",
        keys: ["Mjolnir"],
      },
    ];
    expect(
      resolveMarkers(
        '{{if Mjolnir ~= "mythical-weapons" transclude}}',
        withCards(cards)
      )
    ).toBe("Crackling power.");
  });

  it("transcludes via exact match", () => {
    expect(
      resolveMarkers(
        '{{if Excalibur == "mythical-weapons" transclude}}',
        withCards(weaponCards)
      )
    ).toBe("The blade of kings.");
  });

  it("returns empty string when no card matches the type", () => {
    expect(
      resolveMarkers(
        '{{if Excalibur ~= "made-up-type" transclude}}',
        withCards(weaponCards)
      )
    ).toBe("");
  });

  it("returns empty string when no card matches above threshold", () => {
    expect(
      resolveMarkers(
        '{{if xyzzy ~= "mythical-weapons" transclude}}',
        withCards(weaponCards)
      )
    ).toBe("");
  });

  it("skips the FoxTweaks config card", () => {
    const cards: StoryCard[] = [
      {
        id: "cfg",
        title: "FoxTweaks Config",
        type: "mythical-weapons",
        entry: "config",
        keys: ["Excalibur"],
      },
      {
        id: "1",
        title: "Excalibur",
        type: "mythical-weapons",
        entry: "The blade of kings.",
        keys: ["Excalibur"],
      },
    ];
    expect(
      resolveMarkers(
        '{{if Excalibur ~= "mythical-weapons" transclude}}',
        withCards(cards)
      )
    ).toBe("The blade of kings.");
  });
});

describe("evalFilter via resolveMarkers", () => {
  it("capitalize", () => {
    expect(resolveMarkers("{{filter capitalize jake}}", baseEvalContext)).toBe(
      "Jake"
    );
  });

  it("trim", () => {
    expect(resolveMarkers('{{filter trim "  hi  "}}', baseEvalContext)).toBe(
      "hi"
    );
  });

  it("lower", () => {
    expect(resolveMarkers("{{filter lower HELLO}}", baseEvalContext)).toBe(
      "hello"
    );
  });

  it("upper", () => {
    expect(resolveMarkers("{{filter upper hello}}", baseEvalContext)).toBe(
      "HELLO"
    );
  });

  it("replace with literal pattern", () => {
    expect(
      resolveMarkers("{{filter replace foobar | foo | baz}}", baseEvalContext)
    ).toBe("bazbar");
  });

  it("replace with regex pattern", () => {
    expect(
      resolveMarkers("{{filter replace 123abc | ^\\d+ | }}", baseEvalContext)
    ).toBe("abc");
  });

  it("replace decodes \\n in the replacement", () => {
    expect(
      resolveMarkers("{{filter replace a//b//c | // | \\n}}", baseEvalContext)
    ).toBe("a\nb\nc");
  });

  it("composes via nesting", () => {
    expect(
      resolveMarkers(
        "{{filter capitalize {{filter trim '  hi  '}}}}",
        baseEvalContext
      )
    ).toBe("Hi");
  });

  it("leaves unknown filter in place", () => {
    expect(
      resolveMarkers("{{filter invented_filter jake}}", baseEvalContext)
    ).toBe("{{filter invented_filter jake}}");
  });
});

describe("evalCapture via resolveMarkers", () => {
  it("emits the captured creator output for bare {{capture}}", () => {
    expect(resolveMarkers("{{capture}}", withCapture("hello world"))).toBe(
      "hello world"
    );
  });

  it("emits empty string when cache is empty", () => {
    expect(resolveMarkers("Hello {{capture}}!", withCapture(""))).toBe(
      "Hello !"
    );
  });

  it("directed capture markers leave a placeholder for the directed pass", () => {
    expect(
      resolveMarkers(
        "{{capture into=Memories paragraph=0}}",
        withCapture("creator")
      )
    ).toBe("");
  });
});

describe("evalExtract via resolveMarkers", () => {
  const captured =
    "CHARACTER INFORMATION\nName: Jake\nClass: Sword guy\nGender: male";

  it("extracts a value with literal prefix", () => {
    expect(resolveMarkers('{{extract "Name:"}}', withCapture(captured))).toBe(
      "Jake"
    );
  });

  it("skips lines whose value contains marker syntax (avoids matching the marker itself)", () => {
    const ctx = {
      ...withCapture(captured),
      originalPromptText: `Name: {{extract "Name:"}}\n${captured}`,
    };
    expect(resolveMarkers('{{extract "Name:"}}', ctx)).toBe("Jake");
  });

  it("searches originalPromptText before falling through to capturedCreatorOutput", () => {
    const ctx = {
      ...baseEvalContext,
      originalPromptText: "Some preamble.\nClass: Wizard\nOther stuff.",
    };
    expect(resolveMarkers('{{extract "Class:"}}', ctx)).toBe("Wizard");
  });

  it("extracts via regex literal with capture group", () => {
    expect(
      resolveMarkers("{{extract /Name:\\s*(\\w+)/}}", withCapture(captured))
    ).toBe("Jake");
  });

  it("returns empty string when prefix is absent", () => {
    expect(
      resolveMarkers('{{extract "Missing:"}}', withCapture(captured))
    ).toBe("");
  });

  it("returns empty string when cache is empty", () => {
    expect(resolveMarkers('{{extract "Name:"}}', withCapture(""))).toBe("");
  });
});

describe("evalRemove (in-context cleanup) via resolveMarkers", () => {
  it("strips {{remove}} markers from text", () => {
    expect(resolveMarkers("A card body. {{remove}}", baseEvalContext)).toBe(
      "A card body. "
    );
  });
});

describe("applyCleanupDirectives", () => {
  it("removepost truncates the section at the marker", () => {
    const body =
      'CHARACTER\nName: Jake\n\nYou are Jake. You are great.\n{{removepost "You are"}}';
    expect(applyCleanupDirectives(body)).toBe("CHARACTER\nName: Jake");
  });

  it("removepre drops the section prefix up to the marker", () => {
    const body =
      'Garbage prelude. Keep this: real content.\n{{removepre "Keep this:"}}';
    expect(applyCleanupDirectives(body)).toBe("real content.");
  });

  it("removes the directive even when the marker is missing", () => {
    const body = 'Plain body.\n{{removepost "never appears"}}';
    expect(applyCleanupDirectives(body)).toBe("Plain body.");
  });

  it("multiple directives apply in scenario order", () => {
    const body =
      'ALPHA BETA GAMMA DELTA\n{{removepost "GAMMA"}}\n{{removepre "ALPHA"}}';
    expect(applyCleanupDirectives(body)).toBe("BETA");
  });

  it("removeafter is an alias for removepost", () => {
    const body =
      'CHARACTER\nName: Jake\n\nYou are Jake. You are great.\n{{removeafter "You are"}}';
    expect(applyCleanupDirectives(body)).toBe("CHARACTER\nName: Jake");
  });

  it("removebefore is an alias for removepre", () => {
    const body =
      'Garbage prelude. Keep this: real content.\n{{removebefore "Keep this:"}}';
    expect(applyCleanupDirectives(body)).toBe("real content.");
  });
});

describe("dedupe filter", () => {
  it("collapses runs of a single character to one instance", () => {
    expect(
      resolveMarkers("{{filter dedupe 'foo... bar.....' | .}}", baseEvalContext)
    ).toBe("foo. bar.");
  });

  it("collapses repeated runs of a multi-char needle", () => {
    expect(
      resolveMarkers("{{filter dedupe 'foo... bar......' | ...}}", baseEvalContext)
    ).toBe("foo... bar...");
  });

  it("leaves single instances alone", () => {
    expect(
      resolveMarkers("{{filter dedupe 'a.b.c' | .}}", baseEvalContext)
    ).toBe("a.b.c");
  });

  it("handles regex special characters safely", () => {
    expect(
      resolveMarkers("{{filter dedupe 'a***b**c' | *}}", baseEvalContext)
    ).toBe("a*b*c");
  });

  it("returns expr unchanged when needle is empty", () => {
    expect(
      resolveMarkers("{{filter dedupe 'hello' | }}", baseEvalContext)
    ).toBe("hello");
  });

  it("solves the 'fit body..' compound-period scenario", () => {
    const text =
      "{{filter dedupe 'You are an adventurer, fit body.. You are great.' | .}}";
    expect(resolveMarkers(text, baseEvalContext)).toBe(
      "You are an adventurer, fit body. You are great."
    );
  });
});

describe("selectCreatorOutput", () => {
  it("returns empty string when no continues exist", () => {
    expect(selectCreatorOutput([{ text: "Start.", type: "start" }])).toBe("");
  });

  it("joins continues that precede any player action", () => {
    expect(
      selectCreatorOutput([
        { text: "Start.", type: "start" },
        { text: "First continue.", type: "continue" },
        { text: "Second continue.", type: "continue" },
      ])
    ).toBe("First continue.\n\nSecond continue.");
  });

  it("stops at the first player action", () => {
    expect(
      selectCreatorOutput([
        { text: "Start.", type: "start" },
        { text: "Creator continue.", type: "continue" },
        { text: "Player input.", type: "do" },
        { text: "Later continue.", type: "continue" },
      ])
    ).toBe("Creator continue.");
  });
});

describe("spliceAtParagraph", () => {
  it("splices at index 0", () => {
    expect(spliceAtParagraph("one\n\ntwo", 0, "zero")).toBe(
      "zero\n\none\n\ntwo"
    );
  });

  it("splices in the middle", () => {
    expect(spliceAtParagraph("one\n\nthree", 1, "two")).toBe(
      "one\n\ntwo\n\nthree"
    );
  });

  it("appends when index exceeds paragraph count", () => {
    expect(spliceAtParagraph("one\n\ntwo", 99, "three")).toBe(
      "one\n\ntwo\n\nthree"
    );
  });

  it("clamps negative indices to 0", () => {
    expect(spliceAtParagraph("one\n\ntwo", -5, "zero")).toBe(
      "zero\n\none\n\ntwo"
    );
  });

  it("returns insertion alone when body is empty", () => {
    expect(spliceAtParagraph("", 0, "only")).toBe("only");
  });
});

describe("hasPartialPlaceholder", () => {
  it("detects a curly-brace literal not preceded by $", () => {
    expect(hasPartialPlaceholder("hello {name?} world")).toBe(true);
  });

  it("returns true even when surrounded by non-empty content", () => {
    expect(hasPartialPlaceholder("Kira{name?}")).toBe(true);
  });

  it("returns false when only ${...} placeholders are present", () => {
    expect(hasPartialPlaceholder("${kept}")).toBe(false);
  });

  it("returns false on plain text", () => {
    expect(hasPartialPlaceholder("just words")).toBe(false);
  });

  it("returns false on empty text", () => {
    expect(hasPartialPlaceholder("")).toBe(false);
  });
});

describe("parseCleanupMarker", () => {
  it("parses bare form", () => {
    const parsed = parseCleanupMarker("hello{x?}");
    expect(parsed).toEqual({ expr: "hello{x?}" });
  });

  it("parses 1-pipe form", () => {
    const parsed = parseCleanupMarker("hello{x?} | prefix");
    expect(parsed).toEqual({ expr: "hello{x?} ", prefix: " prefix" });
  });

  it("parses 2-pipe form", () => {
    const parsed = parseCleanupMarker("hello{x?} | prefix | suffix");
    expect(parsed).toEqual({
      expr: "hello{x?} ",
      prefix: " prefix ",
      suffix: " suffix",
    });
  });

  it("joins extra pipes into suffix", () => {
    const parsed = parseCleanupMarker("expr | prefix | a | b");
    expect(parsed.suffix).toBe(" a | b");
  });
});

describe("evalCleanup via resolveMarkers", () => {
  it("bare form emits content when no partial placeholder is present", () => {
    expect(resolveMarkers("{{cleanup Kira}}", baseEvalContext)).toBe("Kira");
  });

  it("bare form returns empty when any partial placeholder is present (surrounded)", () => {
    expect(
      resolveMarkers("{{cleanup Kira{description?}}}", baseEvalContext)
    ).toBe("");
  });

  it("bare form returns empty when only a partial placeholder is present", () => {
    expect(resolveMarkers("{{cleanup {name?}}}", baseEvalContext)).toBe("");
  });

  it("bare form returns empty when expr is empty", () => {
    expect(resolveMarkers("{{cleanup }}", baseEvalContext)).toBe("");
  });

  it("2-pipe wraps content with prefix + space + suffix when fully answered", () => {
    expect(
      resolveMarkers(
        "{{cleanup Kira | You are traveling with | ,}}",
        baseEvalContext
      )
    ).toBe("You are traveling with Kira,");
  });

  it("2-pipe returns empty when any partial placeholder is present (so default falls through)", () => {
    expect(
      resolveMarkers(
        "{{cleanup Kira{name?} | You are traveling with | ,}}",
        baseEvalContext
      )
    ).toBe("");
  });

  it("2-pipe returns empty when expr is empty", () => {
    expect(
      resolveMarkers(
        "{{cleanup  | You are traveling with | ,}}",
        baseEvalContext
      )
    ).toBe("");
  });

  it("1-pipe emits prefix + space + content when fully answered", () => {
    expect(
      resolveMarkers(
        "{{cleanup Kira | You are traveling with}}",
        baseEvalContext
      )
    ).toBe("You are traveling with Kira");
  });

  it("1-pipe returns empty when any partial placeholder is present", () => {
    expect(
      resolveMarkers(
        "{{cleanup Kira{description?} | You are traveling alone}}",
        baseEvalContext
      )
    ).toBe("");
  });

  it("preserves trailing punctuation in suffix without prepending a space", () => {
    expect(
      resolveMarkers("{{cleanup Bob | greeting: | !}}", baseEvalContext)
    ).toBe("greeting: Bob!");
  });

  it("traveling-companion canonical pattern: filled inputs compose into default expr", () => {
    const filledIn =
      "{{default " +
      "{{cleanup Kira | You are traveling with | ,}} " +
      "{{cleanup A warrior of some renown with red hair and green eyes.}} " +
      "| You are traveling alone.}}";
    expect(resolveMarkers(filledIn, baseEvalContext)).toBe(
      "You are traveling with Kira, A warrior of some renown with red hair and green eyes."
    );
  });

  it("traveling-companion: $ toggle but both values erased falls back via outer default", () => {
    const erasedAfterToggle =
      "{{default " +
      "{{cleanup  | You are traveling with | ,}} " +
      "{{cleanup }} " +
      "| You are traveling alone.}}";
    expect(resolveMarkers(erasedAfterToggle, baseEvalContext)).toBe(
      "You are traveling alone."
    );
  });

  it("traveling-companion: non-$ toggle leaves stragglers, treated as empty so default fires", () => {
    const stragglers =
      "{{default " +
      "{{cleanup Kira{name?} | You are traveling with | ,}} " +
      "{{cleanup Kira{description?}}} " +
      "| You are traveling alone.}}";
    expect(resolveMarkers(stragglers, baseEvalContext)).toBe(
      "You are traveling alone."
    );
  });

  it("traveling-companion: empty toggle leaves only partials, fallback fires", () => {
    const empty =
      "{{default " +
      "{{cleanup {name?} | You are traveling with | ,}} " +
      "{{cleanup {description?}}} " +
      "| You are traveling alone.}}";
    expect(resolveMarkers(empty, baseEvalContext)).toBe(
      "You are traveling alone."
    );
  });
});

describe("uncapitalize filter", () => {
  it("lowercases the first letter only", () => {
    expect(
      resolveMarkers("{{filter uncapitalize Hello World}}", baseEvalContext)
    ).toBe("hello World");
  });

  it("leaves an already-lowercase first letter alone", () => {
    expect(
      resolveMarkers("{{filter uncapitalize already lowercase}}", baseEvalContext)
    ).toBe("already lowercase");
  });

  it("composes inside cleanup for mid-sentence transclusion (fully answered)", () => {
    expect(
      resolveMarkers(
        "{{cleanup {{filter uncapitalize A warrior with red hair.}} | You are traveling alone, with}}",
        baseEvalContext
      )
    ).toBe("You are traveling alone, with a warrior with red hair.");
  });
});

describe("multi-line transclude inside default (apostrophes don't break split)", () => {
  it("transcluded card body containing an apostrophe and newlines still allows default's pipe to be recognized", () => {
    const cards: StoryCard[] = [
      {
        id: "mjolnir",
        title: "Mjolnir",
        type: "mythical-weapons",
        entry: "Thor's hammer, crackling with the storm.",
        keys: ["Mjolnir"],
      },
    ];
    const ctx = withCards(cards);
    const text =
      '{{default {{if Mjolnir ~= "mythical-weapons" transclude}} | You carry no signature weapon.}}';
    expect(resolveMarkers(text, ctx)).toBe(
      "Thor's hammer, crackling with the storm."
    );
  });

  it("default with literal newlines in expr still splits on the unquoted pipe", () => {
    const text =
      "{{default Thor's hammer, crackling with the storm.\n\n | You carry no signature weapon.}}";
    expect(resolveMarkers(text, baseEvalContext)).toBe(
      "Thor's hammer, crackling with the storm."
    );
  });
});

describe("Placeholders config", () => {
  it("defaults enable to true", () => {
    expect(Placeholders.validateConfig({}).enable).toBe(true);
  });

  it("parses enable=false", () => {
    expect(Placeholders.validateConfig({ enable: false }).enable).toBe(false);
  });

  it("parses string boolean", () => {
    expect(Placeholders.validateConfig({ enable: "false" }).enable).toBe(false);
  });
});

describe("resolveMarkers max-pass cap", () => {
  it("terminates when no progress is being made", () => {
    expect(resolveMarkers("{{unknown_type x y z}}", baseEvalContext)).toBe(
      "{{unknown_type x y z}}"
    );
  });
});
