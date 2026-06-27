import csv
import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "문서" / "4000 Essential English Words 2 PDF.pdf"
JSON_PATH = ROOT / "docs" / "data" / "words.json"
TOC_PATH = ROOT / "docs" / "data" / "toc.json"
CSV_PATH = ROOT / "data" / "words-review.csv"
SUPPLEMENTAL_FIELDS = [
    "phonetic",
    "koreanMeanings",
    "acceptedKoreanAnswers",
    "dictionaryNotes",
    "exampleKo",
]

UNITS = [
    (1, 8, "The Most Visited Country", "because east expensive flower garden holiday many million mountain place popular ski such total tower town train walk watch world"),
    (2, 14, "The Twelve Months", "anxious awful consist desire eager household intent landscape lift load lung motion pace polite possess rapidly remark seek shine spill"),
    (3, 20, "The Battle of Thermopylae", "arrow battle bow brave chief disadvantage enemy entrance hardly intend laughter log military obey secure steady trust twist unless weapon"),
    (4, 26, "The Deer and His Image", "chest confidence consequence disaster disturb estimate honor impress narrow pale rough satisfy scream sensitive shade strength supplement terror threat victim"),
    (5, 32, "May 29, 1953", "ancestor angle boot border congratulate frame heaven incredible legend praise proceed pure relative senior silent sink superior surround thick wrap"),
    (6, 38, "Ways to Reduce Stress", "also automatically busy can clear close discuss feel listen meet music normal quiet relax sleep stress study talk work write"),
    (7, 44, "The First Peacock", "basis biology cage colleague colony debate depart depress factual fascinate mission nevertheless occupation overseas persuade route ruins scholar significant volcano"),
    (8, 50, "The Friendly Ghost", "broad bush capable cheat concentrate conclude confident considerable convey definite delight destination edge instructions path resort shadow succeed suspect valley"),
    (9, 56, "The Starfish", "against beach damage discover emotion fix identify island ocean perhaps pleasant prevent rock save smile step still taste throw wave"),
    (10, 62, "Blackbeard", "citizen council declare enormous extraordinary fog funeral giant impression intention mad ought resist reveal rid sword tale trap trial violent"),
    (11, 68, "Dinosaur Drawings", "admission astronomy blame chemistry despite dinosaur exhibit fame forecast genius gentle geography interfere lightly principal row shelf spite super wet"),
    (12, 74, "The Mean Chef", "abuse afford bake bean candle convert debt decrease fault fund generous ingredient insist mess metal monitor oppose passive quantity sue"),
    (13, 80, "The Cat and the Fox", "adequate anxiety army billion carve consult emergency fortune guarantee initial intense lend peak potential pride proof quit spin tiny tutor"),
    (14, 86, "The Good Student", "apparent blind calculate chat commit compose dormitory exhaust greenhouse ignore obvious physics portion remind secretary severe talent thesis uniform vision"),
    (15, 92, "The Lucky Knife", "absorb boss charitable committee contract crew devote dig dine donate double flavor foundation generation handle layer mud smooth soil unique"),
    (16, 98, "Adams County's Gold", "academy ancient board century clue concert county dictionary exist flat gentleman hidden maybe officer original pound process publish theater wealth"),
    (17, 104, "Henry Ford's Famous Car", "aim attach bet carriage classic commute confirm criticize differ expense formal height invent junior labor mechanic prime shift signal sincere"),
    (18, 110, "The Priest", "ability agriculture cartoon ceiling convince curious delay diary element faith grain greet investigate joy label monk odd pause priest profession"),
    (19, 116, "Strange and Unusual Jobs", "ball bottom company drink few line pet product responsible sell snake stand strange tea test tongue they type very wait"),
    (20, 122, "Albert Einstein", "accomplish approve approximate barrier detect duty elementary failure gradual immigrant insert instant poverty pretend rank recognition refrigerate rent retire statistic"),
    (21, 128, "From the Earth to the Stars", "accident astronaut awake courage float grant gravity jewel miner mineral participate permission pour raw satellite scale skip stretch telescope underground"),
    (22, 134, "The Farm Festival", "alarm arrest award breed bucket contest convict festival garage journalist pup qualify repair resume rob slip somewhat stable tissue yard"),
    (23, 140, "48 Hours in Hong Kong", "best card crowd day dish easy experience hotel hour light market plan price short shop station surprise system taxi two"),
    (24, 146, "The Doctor's Cure", "bath bend chew disabled fantastic fiction flag inspect journal liquid marvel overcome recall regret soul sufficient surgery tough tube value"),
    (25, 152, "How Comet Got His Tail", "atom beautiful breadth comet cover despair form fragment galaxy gloom large moon radiate roam solitary spectrum sphere star status ugly"),
    (26, 158, "The Two Captains", "accuse adjust amuse coral cotton crash deck engage firm fuel grand hurricane loss plain reef shut strict surf task zone"),
    (27, 164, "The Duke and the Minister", "apology bold bug capture duke expose guilty hire innocent language minister ordinary permanent preserve pronounce resemble symptom tobacco twin witch"),
    (28, 170, "The Fisherman", "accompany bare branch breath bridge cast dare electronic inn net philosophy pot seed sharp sort subtract tight virtual weigh whisper"),
    (29, 176, "Osiris and the Nile", "abstract annual clay cloth curtain deserve feather fertile flood furniture grave ideal intelligence obtain religious romantic shell shore wheel wooden"),
    (30, 182, "The Kitten and the Caterpillar", "appliance basin broom caterpillar cupboard delicate emerge handicap hole hook hop laundry pursue reluctant sleeve spine stain strip swear swing"),
]


def clean_text(value: str) -> str:
    value = value.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def split_sentences(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", value) if part.strip()]


def definition_tail(sentence: str, word: str) -> str:
    starters = [
        rf"\b{re.escape(word)}\b",
        rf"\bA\s+{re.escape(word)}\b",
        rf"\bAn\s+{re.escape(word)}\b",
        rf"\bThe\s+{re.escape(word)}\b",
        rf"\bTo\s+{re.escape(word)}\b",
    ]
    best = ""
    for starter in starters:
        for match in re.finditer(starter, sentence, flags=re.IGNORECASE):
            tail = sentence[match.start() :].strip()
            if re.search(r"\b(is|are|means|shows|introduces|costs?)\b", tail[:90], flags=re.IGNORECASE):
                if not best or len(tail) < len(best):
                    best = tail
    return best


def find_word_position(text: str, word: str) -> int:
    matches = list(re.finditer(rf"\b{re.escape(word)}\b", text, flags=re.IGNORECASE))
    if not matches:
        return -1

    def score(match: re.Match[str]) -> int:
        after = text[match.end() : match.end() + 120].lower()
        before = text[max(0, match.start() - 8) : match.start()].lower()
        value = 0
        if "[" in after[:35]:
            value += 80
        if before.endswith("to "):
            value += 30
        if re.search(r"\b(is|are|means|shows|introduces|costs?)\b", after):
            value += 25
        if match.group(0).islower():
            value += 5
        return value

    return max(matches, key=score).start()


PART_PATTERNS = [
    (re.compile(r"\badj\.?\b|adi\b|ad//\b|ac//\b", flags=re.IGNORECASE), "adj."),
    (re.compile(r"\badv\.?\b", flags=re.IGNORECASE), "adv."),
    (re.compile(r"\bconj\.?\b|con/\b|conj\b", flags=re.IGNORECASE), "conj."),
    (re.compile(r"\bv\.?\b| u | z | 丁 ", flags=re.IGNORECASE), "v."),
    (re.compile(r"\bn\.?\b| fl |『|）", flags=re.IGNORECASE), "n."),
]


def extract_part_of_speech(chunk: str, definition: str) -> str:
    search_area = chunk
    if definition and definition in chunk:
        search_area = chunk[: chunk.index(definition)]
    search_area = search_area[:140]
    for pattern, value in PART_PATTERNS:
        if pattern.search(search_area):
            return value
    return ""


def extract_entry(text: str, words: list[str], index: int) -> tuple[str, str, str, bool]:
    word = words[index]
    start = find_word_position(text, word)
    if start < 0:
        return "", f"Study the word '{word}' from this unit.", "", True

    next_positions = [find_word_position(text[start + len(word) :], next_word) for next_word in words[index + 1 :]]
    next_positions = [pos + start + len(word) for pos in next_positions if pos >= 0]
    end = min(next_positions) if next_positions else min(len(text), start + 420)
    chunk = clean_text(text[start:end])
    sentences = split_sentences(chunk)

    clean_sentences = [sentence for sentence in sentences if len(sentence) > 16]
    definition = ""
    example = ""
    definition_pattern = re.compile(r"\b(is|are|means|shows|introduces|costs?)\b", flags=re.IGNORECASE)

    for sentence in clean_sentences:
        candidate = definition_tail(sentence, word) or sentence
        lower = candidate.lower()
        mentions_word = (
            lower.startswith(word)
            or lower.startswith(f"a {word}")
            or lower.startswith(f"an {word}")
            or lower.startswith(f"the {word}")
            or lower.startswith(f"to {word}")
            or f" {word} " in f" {lower} "[:100]
        )
        if not definition and mentions_word and definition_pattern.search(candidate):
            definition = candidate
            continue
        if definition and word in sentence.lower():
            example = sentence
            break

    if not definition and clean_sentences:
        definition = definition_tail(clean_sentences[0], word) or clean_sentences[0]
    if not example:
        for sentence in clean_sentences:
            if sentence != definition and word in sentence.lower():
                example = sentence
                break
    if not example and len(clean_sentences) > 1:
        example = clean_sentences[1]

    definition = clean_text(definition)[:260]
    example = clean_text(example)[:220]
    part_of_speech = extract_part_of_speech(chunk, definition)
    needs_review = (
        definition.startswith("Study the word")
        or len(definition) < 18
        or "[" in definition
        or not definition_pattern.search(definition)
    )
    return part_of_speech, definition, example, needs_review


def has_exercises_heading(text: str) -> bool:
    return bool(re.search(r"\bEXERCISES\b", text, flags=re.IGNORECASE))


def detect_unit_pages(reader: PdfReader, start_page: int, next_start_page: int | None) -> dict:
    unit_end_page = (next_start_page - 1) if next_start_page else start_page + 5
    exercise_start = None

    for page_number in range(start_page, unit_end_page + 1):
        text = clean_text(reader.pages[page_number - 1].extract_text() or "")
        if has_exercises_heading(text):
            exercise_start = page_number
            break

    if exercise_start is None:
        exercise_start = min(start_page + 2, unit_end_page + 1)

    word_list_end = max(start_page, exercise_start - 1)
    word_list_pages = [start_page, word_list_end]
    exercise_end = min(exercise_start + 1, unit_end_page)
    reading_start = min(exercise_end + 1, unit_end_page)

    return {
        "wordListPages": word_list_pages,
        "exercisePages": [exercise_start, exercise_end] if exercise_start <= unit_end_page else [],
        "readingPages": [reading_start, unit_end_page] if reading_start <= unit_end_page else [],
        "allPages": [start_page, unit_end_page],
    }


def pages_in_range(page_range: list[int]) -> list[int]:
    if not page_range:
        return []
    return list(range(page_range[0], page_range[1] + 1))


def find_word_page(page_texts: dict[int, str], word: str, fallback_page: int) -> int:
    best_page = fallback_page
    best_position = None
    for page_number, text in page_texts.items():
        position = find_word_position(text, word)
        if position < 0:
            continue
        if best_position is None or position < best_position:
            best_page = page_number
            best_position = position
    return best_page


def build_toc(reader: PdfReader) -> list[dict]:
    toc = []
    for index, (unit, start_page, title, word_string) in enumerate(UNITS):
        next_start_page = UNITS[index + 1][1] if index + 1 < len(UNITS) else None
        page_ranges = detect_unit_pages(reader, start_page, next_start_page)
        toc.append(
            {
                "unit": unit,
                "title": title,
                "wordCount": len(word_string.split()),
                **page_ranges,
            }
        )
    return toc


def load_supplemental_fields() -> dict[str, dict]:
    if not JSON_PATH.exists():
        return {}
    try:
        entries = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    supplemental = {}
    for entry in entries:
        word = entry.get("word")
        if not word:
            continue
        supplemental[word] = {field: entry.get(field, "" if field in {"phonetic", "dictionaryNotes", "exampleKo"} else []) for field in SUPPLEMENTAL_FIELDS}
    return supplemental


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    entries = []
    review_rows = []
    supplemental_by_word = load_supplemental_fields()
    toc = build_toc(reader)
    toc_by_unit = {item["unit"]: item for item in toc}

    for unit, start_page, title, word_string in UNITS:
        words = word_string.split()
        word_pages = pages_in_range(toc_by_unit[unit]["wordListPages"])
        page_texts = {
            page_number: clean_text(reader.pages[page_number - 1].extract_text() or "")
            for page_number in word_pages
        }
        page_text = " ".join(page_texts.values())
        for index, word in enumerate(words):
            part_of_speech, definition, example, needs_review = extract_entry(page_text, words, index)
            fallback_index = min(index * max(len(word_pages), 1) // len(words), max(len(word_pages) - 1, 0))
            fallback_page = word_pages[fallback_index]
            book_page = find_word_page(page_texts, word, fallback_page)
            pdf_page = book_page
            entry = {
                "unit": unit,
                "unitTitle": title,
                "wordOrder": index + 1,
                "bookPage": book_page,
                "pdfPage": pdf_page,
                "section": "word-list",
                "word": word,
                "partOfSpeech": part_of_speech,
                "definition": definition,
                "example": example,
                "needsReview": needs_review,
                **supplemental_by_word.get(
                    word,
                    {
                        "phonetic": "",
                        "koreanMeanings": [],
                        "acceptedKoreanAnswers": [],
                        "dictionaryNotes": "",
                        "exampleKo": "",
                    },
                ),
            }
            entries.append(entry)
            review_rows.append(entry)

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    TOC_PATH.write_text(json.dumps(toc, ensure_ascii=False, indent=2), encoding="utf-8")

    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "unit",
                "unitTitle",
                "wordOrder",
                "bookPage",
                "pdfPage",
                "section",
                "word",
                "partOfSpeech",
                "definition",
                "example",
                "needsReview",
                *SUPPLEMENTAL_FIELDS,
            ],
        )
        writer.writeheader()
        writer.writerows(review_rows)

    review_count = sum(1 for item in entries if item["needsReview"])
    print(f"Wrote {len(entries)} words to {JSON_PATH}")
    print(f"Wrote {len(toc)} toc rows to {TOC_PATH}")
    print(f"Wrote review CSV to {CSV_PATH}")
    print(f"Needs review: {review_count}")


if __name__ == "__main__":
    main()
