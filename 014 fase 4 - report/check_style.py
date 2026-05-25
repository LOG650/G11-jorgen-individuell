"""Quick style/proofread check on Report draft.md (most recent active draft)."""
import re
from pathlib import Path

text = Path("Report draft.md").read_text(encoding="utf-8")

# Strip code-blocks and LaTeX so they don't pollute the checks
clean = re.sub(r"```.*?```|`[^`]+`", "", text, flags=re.DOTALL)
clean = re.sub(r"\$\$.*?\$\$|\$[^$]+\$", "", clean, flags=re.DOTALL)

ai_patterns = [
    (r"\bdet er viktig å (?:bemerke|merke|notere|understreke)\b", "AI-floskel"),
    (r"\bdet er verdt å nevne\b", "AI-floskel"),
    (r"\bsom et resultat av\b", "unaturlig"),
    (r"\bdette betyr at\b", "fyllord (ofte)"),
    (r"\bi denne sammenheng\b", "tung formulering"),
    (r"\bsåvel som\b", "arkaisk"),
    (r"  +", "doble mellomrom"),
    (r"\bog og\b|\bi i\b|\bav av\b", "ord-gjentakelse"),
    (r"\bdette er en\s+\w+\s+som\b", "oppblåst"),
    (r"\bdet finnes\b", "kan ofte strammes"),
    (r"\bjeg\b", "førsteperson – skal være 'vi'"),
]

print("=== AI-floskler / stilfeil ===")
for pat, desc in ai_patterns:
    matches = list(re.finditer(pat, clean, re.IGNORECASE))
    if matches:
        print(f"[{desc}]: {len(matches)} treff")
        for m in matches[:3]:
            ls = clean.rfind("\n", 0, m.start()) + 1
            le = clean.find("\n", m.end())
            line_no = clean[: m.start()].count("\n") + 1
            snippet = clean[ls:le].strip()[:140]
            print(f"  L{line_no}: {snippet}")

print()
print("=== Setninger med >50 ord ===")
sentences = re.split(r"(?<=[.!?])\s+", clean)
long_sentences = [(i, s) for i, s in enumerate(sentences) if len(s.split()) > 50]
print(f"Antall: {len(long_sentences)}")
for i, s in long_sentences[:8]:
    word_count = len(s.split())
    print(f"  [{word_count} ord]: {s[:200].strip()}...")

print()
print("=== Kapittel-struktur ===")
headings = re.findall(r"^(##) (.+)$", text, re.MULTILINE)
print(f"Hovedkapitler ({len(headings)}):")
for level, title in headings:
    print(f"  {title}")
