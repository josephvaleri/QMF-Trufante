#!/usr/bin/env python3
# build_lexicons.py
import csv, io, json, re, sys, unicodedata
from pathlib import Path

import requests

OUT = Path("moderation_lexicons")
OUT.mkdir(exist_ok=True)

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = s.strip().lower()
    # keep letters, digits, hyphens, apostrophes (for slang), and spaces
    s = re.sub(r"[^0-9a-z\'\-\s]+", "", s)
    # collapse spaces
    s = re.sub(r"\s+", " ", s).strip()
    return s

def save_list(name, words):
    words = [w for w in {norm(w) for w in words} if 2 <= len(w) <= 64]
    words = sorted(words)
    (OUT / name).write_text("\n".join(words), encoding="utf-8")
    print(f"wrote {name}: {len(words)} terms")

# -----------------------------
# 1) Profanity / vulgarity: LDNOOBW
# -----------------------------
def build_profanity():
    # LDNOOBW ships per-language lists in /en and other folders. We'll fetch English.
    # Fallback to CMU list for coverage.
    profanity = set()

    # LDNOOBW (English)
    # raw file path is stable in repo root as /en
    try:
        r = requests.get(
            "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en"
        , timeout=30)
        if r.ok:
            profanity.update([ln for ln in r.text.splitlines() if ln and not ln.startswith("#")])
    except Exception:
        pass

    # CMU "bad-words.txt" (classic)
    try:
        r = requests.get("https://www.cs.cmu.edu/~biglou/resources/bad-words.txt", timeout=30)
        if r.ok:
            profanity.update([ln for ln in r.text.split(",")])
    except Exception:
        pass

    save_list("profanity.txt", profanity)

# -----------------------------
# 2) Sexual / obscene: CMU + LDNOOBW (sexual subset heuristic)
# -----------------------------
SEX_HINT = re.compile(r"(sex|porn|anal|cum|vag|penis|vagina|oral|fetish|nude|naked|xxx|breast|boob|clit|dick|cock|pussy|milf|nsfw|bdsm|orgasm|hentai)")
def build_sexual():
    sexual = set()
    # CMU list contains many sexual terms
    r = requests.get("https://www.cs.cmu.edu/~biglou/resources/bad-words.txt", timeout=30)
    if r.ok:
        for token in r.text.split(","):
            t = norm(token)
            if SEX_HINT.search(t):
                sexual.add(t)
    # LDNOOBW english, filter by regex hints
    r = requests.get(
        "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en"
    , timeout=30)
    if r.ok:
        for ln in r.text.splitlines():
            t = norm(ln)
            if SEX_HINT.search(t):
                sexual.add(t)
    save_list("sexual.txt", sexual)

# -----------------------------
# 3) Hate / slurs: Hatebase (public browse) + LDNOOBW overlap
# -----------------------------
def build_hate():
    hate = set()
    # Hatebase has an API (paid). We'll scrape the public search results page for English examples as seed.
    try:
        r = requests.get("https://hatebase.org/search_results", timeout=30)
        if r.ok:
            # extract table-ish tokens heuristically
            for m in re.finditer(r"\">([A-Za-z0-9\-\s']+)</a>\s+English", r.text):
                hate.add(norm(m.group(1)))
            # also simple term captures before "English"
            for m in re.finditer(r">([A-Za-z0-9\-\s']+)\s+</td>\s+<td>\s*English", r.text):
                hate.add(norm(m.group(1)))
    except Exception:
        pass

    # Add LDNOOBW items likely to be slurs (very rough heuristic keys)
    SLUR_HINT = re.compile(r"\b(chink|gook|kike|wetback|beaner|spic|tranny|retard|fag|dyke|abo|paki|gypsy|coon|jap|karan|raghead|queer)\b")
    r = requests.get(
        "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/master/en"
    , timeout=30)
    if r.ok:
        for ln in r.text.splitlines():
            t = norm(ln)
            if SLUR_HINT.search(f" {t} "):
                hate.add(t)

    save_list("hate_speech.txt", hate)

# -----------------------------
# 4) Violence / threats: "Violence Lexicon" datasets
# -----------------------------
def build_violence():
    violence = set()
    # Harvard Dataverse (Violence Lexicon) exports TSV; we'll try to fetch the first file via ?format=original may require redirects.
    # As a fallback, use a curated seed list of violent verbs/nouns.
    try:
        # This URL may require manual token; leave as no-op if blocked.
        pass
    except Exception:
        pass

    # Seed verbs/nouns (will be augmented later if you add a tokenized CSV)
    seed = """
    kill killing killed homicide murder rape assault batter stab stabbing shoot shooting gunfire behead strangl choke chokehold lynch execute execution bomb bombing explode explosion threaten threat violence violent abuse battering
    """
    violence.update(seed.split())
    save_list("violence.txt", violence)

# -----------------------------
# 5) Blasphemy / occult: manual curation (starter seed only; expand per doctrine)
# -----------------------------
def build_blasphemy():
    # STARTER seed; adjust with your doctrinal guidance.
    seed = """
    blaspheme blasphemy sacrilege profane profanity desecrate desecration damnation damned dammit hellish satan satanic lucifer devil occult witchcraft ouija seance necromancy
    """
    save_list("blasphemy.txt", seed.split())

# -----------------------------
# 6) Substance / self-harm: DrugAbuse lexicon + SuicideWatch keywords (seed from open papers)
# -----------------------------
def build_substance():
    subs = set()
    # RedMed / drug-abuse lexicons are in papers; we'll seed with common substances + slang.
    seed = """
    heroin smack fentanyl fent benzo benzodiazepine xanax alprazolam oxy oxycodone oxycontin methamphetamine meth crystal meth mdma molly cocaine coke crack ketamine k-hole lsd acid psilocybin shrooms weed cannabis marijuana pot dope opiate opioid narcotic lean purple drank codeine promethazine hydrocodone vicodin dilaudid morphine suboxone buprenorphine kratom nitrous whippets bath salts spice k2 ghb rohypnol roofies
    """
    subs.update(seed.split())
    # Self-harm indicative phrases (short tokens—keep sparse to avoid overblocking)
    selfharm = """
    selfharm self-harm self injure cutting cut myself overdose od kill myself kms suicidal suicide ideation hang myself end my life
    """
    subs.update(selfharm.split())
    save_list("substance.txt", subs)

# -----------------------------
# 7) Derogatory / insults: NRC resources + LDNOOBW overlap (heuristic)
# -----------------------------
INSULT_HINT = re.compile(r"\b(idiot|moron|stupid|dumbass|loser|bastard|jerk|scum|trash|ugly|worthless|cretin|imbecile|clown|coward|pathetic|disgusting)\b")
def build_derogatory():
    der = set()
    # Use CMU list as base and extract insults via heuristic keys:
    r = requests.get("https://www.cs.cmu.edu/~biglou/resources/bad-words.txt", timeout=30)
    if r.ok:
        for token in r.text.split(","):
            t = norm(token)
            if INSULT_HINT.search(f" {t} "):
                der.add(t)
    # Add a compact seed:
    der.update(["idiot","moron","stupid","dumbass","loser","bastard","jerk","scumbag","trash","ugly","worthless","cretin","imbecile","clown","coward","pathetic","disgusting"])
    save_list("derogatory.txt", der)

if __name__ == "__main__":
    build_profanity()
    build_sexual()
    build_hate()
    build_violence()
    build_blasphemy()
    build_substance()
    build_derogatory()

    print(f"\nOutput directory: {OUT.resolve()}")

