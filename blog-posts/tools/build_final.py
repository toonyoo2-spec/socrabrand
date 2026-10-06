# 원고 + 이미지 프롬프트 + 작업지침을 합쳐 최종 md/zip을 만든다.
import pathlib, re, shutil, sys, zipfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from card_copy import CARDS
CARD = {c["no"]: c for c in CARDS}

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "2026-10"
OUT = ROOT / "2026-10-final"

STYLE = ("Soft flat editorial illustration with subtle paper grain, rounded friendly shapes, "
         "warm natural light, calm and hopeful mood, limited pastel palette dominated by {bg}, "
         "clean composition with generous negative space. People are Korean elementary school "
         "children and parents with simple, friendly faces. Original artwork, not imitating any "
         "existing book or brand. No text, no letters, no numbers, no logos, no watermarks.")
HERO_AR, BODY_AR = "16:9", "3:2"

GRAY = "soft warm gray (#F3F4F6) with a small coral red accent (#F0503C)"
POSTS = [
 dict(no="01", src="01-issue-grade5-system.md", section="ISSUE TRACKER", cat="입시", tags="입시 · 2028 대입 · UPDATE",
      date="기준일 2026.10 · 교육부 발표 기준", summary="(이슈 트래커 카드: 요약 문구 없음)", bg=GRAY,
      hero=("A parent and an elementary school child sitting together at a kitchen table, looking toward a simple staircase of five wide pastel steps that rises to a distant high school building; the top step has a coral accent", "내신 5등급제, 초등 학부모가 알아둘 3가지"),
      imgs=[
       ("## 무엇이 어떻게 바뀌었나요", "Two stacks of soft building blocks side by side as a minimal infographic: the left stack has nine thin layers, the right stack has five wider layers, with a gentle arrow from left to right", "9등급에서 5등급으로, 등급 칸이 넓어졌어요"),
       ("## 알아둘 것 1. '1등급'의 의미가 달라져요", "An open school portfolio folder on a desk with drawings, presentation slides and handwritten essay pages (only abstract squiggle lines) spilling out, representing a record of the learning process", "등급보다 과정이 드러나는 기록이 중요해져요"),
       ("## 알아둘 것 3. 초등 영어 교실도 이미 바뀌고 있어요", "A bright elementary school English classroom where one child stands and presents a hand-drawn picture poster to classmates while the teacher smiles", "보여주고 말하는 활동이 초등 영어 수업에도 들어왔어요"),
       ("## 그래서 지금, 집에서는 무엇을 하면 좋을까요", "A parent and child at home in the evening; the child reads a short sentence aloud from a small notebook while the parent listens attentively under warm lamp light", "하루 한두 문장, 말하고 쓰는 경험부터 시작해요"),
      ]),
 dict(no="02", src="02-issue-credit-system-english.md", section="ISSUE TRACKER", cat="학교", tags="학교 · 고교학점제",
      date="기준일 2026.09 · 교육부 안내 기준", summary="(이슈 트래커 카드: 요약 문구 없음)", bg=GRAY,
      hero=("A high school student standing in a bright hallway in front of a row of colorful doors, each door marked with a different simple icon (globe, open book, microphone, film camera, briefcase, speech bubbles), deciding which door to open", "고교학점제, 영어 선택과목 고르기"),
      imgs=[
       ("## 영어 과목은 이렇게 나뉘어요", "Four neat groups of plain pastel textbooks on a wooden shelf, each group a different color, arranged from thin foundational books to thicker advanced ones, with blank covers", "공통·일반선택·진로선택·융합선택, 영어 과목은 네 묶음이에요"),
       ("## 선택과목, 이 세 가지 기준으로 보세요", "A student standing at a crossroads with three friendly signposts pointing in different directions, each signpost topped with an icon: a compass, a star and a checklist", "진로, 강점, 평가 방식을 함께 보고 골라요"),
       ("## 과목을 고르기 전, 아이와 나눠 볼 대화", "A parent and a teenager sitting on a sofa having a relaxed conversation, with speech bubbles that contain only icons such as an airplane, a microphone and a book", "정답을 정해 주기보다 아이의 생각을 물어봐 주세요"),
       ("## 초등 시기에 준비할 수 있는 것", "An elementary school child choosing a picture book from a low bookshelf by themselves while a parent watches warmly from behind", "선택하는 힘은 작은 선택에서 시작돼요"),
      ]),
 dict(no="03", src="03-issue-essay-assessment-writing.md", section="ISSUE TRACKER", cat="평가", tags="평가 · 수행평가",
      date="기준일 2026.09 · 시·도교육청 자료 기준", summary="(이슈 트래커 카드: 요약 문구 없음)", bg=GRAY,
      hero=("Close-up of a child's hand writing with a pencil on lined paper (only abstract squiggle lines, nothing readable), with soft thought-bubble shapes rising from the page holding small icons: a lightbulb, a sun and a heart", "서술형·논술형 평가 확대와 영어 쓰기"),
      imgs=[
       ("## 서술형과 논술형, 무엇이 다를까요", "A split composition: on the left a multiple-choice bubble answer sheet gently fading out, on the right a lined page with handwritten paragraph lines (abstract squiggles) softly highlighted", "고르는 시험에서 생각을 쓰는 시험으로"),
       ("## 시기별 영어 쓰기 준비 로드맵", "A gentle winding path with four milestones, from colorful plain blocks to a single word card, then a small notebook, then a full page of paragraphs, with a child walking along the path", "시기에 맞춰 한 걸음씩 넓혀 가는 영어 쓰기"),
       ("## 서술형 답안, 이런 점을 봐요", "Top-down view of a teacher's desk with a stack of written answer sheets, a checklist with four check marks, a pencil and a highlighter", "과제 수행, 조건, 정확성, 논리를 함께 봐요"),
       ("## 아이 글을 봐 줄 때 기억할 것", "A parent and child sitting side by side reading the child's short piece of writing; the parent gently points at one spot and smiles, with no red pen in sight", "한 번에 하나만 짚고, 내용에 먼저 반응해 주세요"),
      ]),
 dict(no="04", src="04-article-three-line-diary.md", section="새로운 이야기", cat="아티클", tags="초3-4",
      date="2026.10.05 · 5분 읽기", summary="매일 한 편 쓰기를 부담 없이 시작하는 선생님의 세 줄 공식을 알려드려요.", bg="pale mint green (#E8F8EE)",
      hero=("An open diary on a desk with exactly three handwritten lines (abstract squiggles, nothing readable), a pencil and a small cup of cocoa, in warm evening light", "영어 일기, 세 줄이면 충분해요"),
      imgs=[
       ("## 세 줄 공식: 사실 - 느낌 - 다음", "Three stacked rounded panels: a child playing soccer, a smiling face surrounded by sparkles, and a sunrise beside a blank calendar page", "사실, 느낌, 다음. 세 줄에는 각각 역할이 있어요"),
       ("## 막힐 때 꺼내 쓰는 표현 주머니", "A cute fabric pouch spilling out small colorful tiles that show only icons: emotion faces, a school, a house, a park tree and a library", "막힐 때 꺼내 쓰는 표현 주머니"),
       ("## 부모님이 지켜주시면 좋은 세 가지 약속", "A parent writing a short reply note with a heart doodle under the child's diary entry while the child peeks in happily", "고치기보다 답장으로 반응해 주세요"),
       ("## 꾸준함을 돕는 작은 장치", "A wall calendar filled with a long streak of colorful stickers; a child proudly adds one more sticker", "스티커 달력으로 이어진 날을 눈으로 확인해요"),
      ]),
 dict(no="05", src="05-behind-why-cnn10.md", section="새로운 이야기", cat="아티클", tags="비하인드",
      date="2026.10.02 · 5분 읽기", summary="실제 속도의 영어, 10분 안팎의 길이, 다양한 주제. 뉴스가 아이 영어 교재가 되는 이유를 정리했어요.", bg="soft lavender (#ECE8FB)",
      card_change="제목·요약문 교체 (기존: '선생님들이 CNN 10을 교재로 고른 진짜 이유' / '1만 문장 커리큘럼이 만들어지기까지, 회의실에서 오간 이야기.'). 태그는 '비하인드' 대신 '교재 이야기' 권장",
      hero=("A teacher and two elementary school children leaning in together to watch a generic student news program on a tablet, the screen showing a friendly anchor at a desk and small topic icons; a notebook and pencils on the table. No channel logos or brand marks", "CNN 10, 아이 영어 교재로 좋은 이유"),
      imgs=[
       ("## 교재를 고를 때 먼저 볼 세 가지", "Three large sticky notes on a whiteboard, each with a simple icon: a speaking mouth with sound waves, a stopwatch without numbers, and a globe surrounded by small varied topic icons", "실제 속도, 집중할 수 있는 길이, 다양한 주제"),
       ("## CNN 10은 어떤 프로그램인가요", "A child watching a short generic student news program on a tablet; the screen shows a friendly anchor and small topic icons such as a rocket, a leaf and a soccer ball. No channel logos", "약 10분, 학생을 위한 뉴스 프로그램"),
       ("## 한 편의 뉴스를 공부하는 흐름", "A horizontal four-step flow connected by soft arrows: an eye, an ear with a mouth, two swapping puzzle pieces, and a speech bubble with a lightbulb", "보기, 따라 말하기, 바꿔 말하기, 내 생각 말하기"),
       ("## 집에서 활용할 때의 팁", "A parent and child at home pausing a short news clip on a tablet to chat about it, the child pointing at the screen with curiosity, cozy living room", "한 장면씩, 함께 멈추고 이야기 나누기"),
      ]),
 dict(no="06", src="06-news-speaking-credit-era.md", section="새로운 이야기", cat="뉴스", tags="고교학점제",
      date="2026.09.30 · 5분 읽기", summary="선택과목과 발표 수업이 늘어난 지금, 초등 때 준비할 것.", bg="pale sky blue (#E6EEFD)",
      hero=("An elementary school child speaking confidently into a small microphone, with soft sound-wave shapes around them and a faint silhouette of a future high school discussion classroom in the background", "학점제 시대, 초등 말하기가 더 중요해진 이유"),
      imgs=[
       ("## 고등학교 수업, 무엇이 달라졌나요", "A small high school seminar class sitting in a circle; one student presents with a slide on a screen while the others listen and raise their hands", "듣는 수업에서 참여하는 수업으로"),
       ("## 왜 하필 '초등' 때일까요", "A young child playing and happily talking out loud without any nervousness, with star-shaped speech bubbles floating around", "부담이 적은 초등 시기, 말하는 경험을 편하게 쌓아요"),
       ("## 집에서 해 보는 1분 발표 템플릿", "A living-room stage: a child stands on a small rug and presents a drawing of a bowl of spicy rice cakes to family members on the sofa while a parent films with a phone", "거실에서 시작하는 1분 발표"),
       ("## 말하기와 함께 자라는 힘", "A child watering a growing plant with three large leaves; each leaf holds an icon: an ordered list, an ear and a raised hand", "생각을 정리하고, 듣고, 자기 의견을 내는 힘"),
      ]),
 dict(no="07", src="07-expression-my-style.md", section="새로운 이야기", cat="아티클", tags="1분 표현",
      date="2026.09.28 · 5분 읽기", summary="원어민이 일상에서 즐겨 쓰는 '취향' 표현으로 오늘 저녁 대화해보세요.", bg="warm cream (#FDF1DE)",
      card_change="요약문 교체 (기존: 'CNN 10 앵커가 실제로 쓴 표현으로 오늘 저녁 대화해보세요.' → 본문에 실제 방송 대사가 없어 불일치)",
      hero=("A cheerful child holding a yellow jacket up against themselves in front of a mirror, delighted, with small sparkles around", "“완전 내 스타일이야”를 영어로"),
      imgs=[
       ("## 상황별 '내 스타일' 표현 5가지", "Five small round vignettes in a row: a movie ticket with popcorn, a child in a well-matched outfit, headphones with music notes, a child absorbed in building blocks, and a teacup", "상황에 따라 골라 쓰는 '취향' 표현 다섯 가지"),
       ("## 오늘 저녁, 이렇게 대화해 보세요", "A family dinner table with bowls of curry; the child happily tastes the spicy food and gives a thumbs up while the parents smile", "오늘 저녁 식탁에서 바로 써 보세요"),
       ("## 아이와 함께하는 '취향 퀴즈' 놀이", "A family sitting on the floor playing a card game; the cards show pictures of food, sports and places, and everyone is laughing", "가족이 함께하는 취향 퀴즈 놀이"),
       ("## 함께 알아두면 좋은 '좋아해' 표현의 온도 차", "A friendly thermometer going from cool blue to warm pink, with heart icons that grow bigger along the scale", "'좋아해'에도 온도가 있어요"),
      ]),
 dict(no="08", src="08-starter-3month-roadmap.md", section="새로운 이야기", cat="아티클", tags="Starter",
      date="2026.09.25 · 5분 읽기", summary="파닉스부터 첫 문장까지, 주차별로 무엇을 하면 되는지 정리했어요.", bg="pale lime (#EEF6D8)",
      hero=("Colorful wooden toy blocks decorated only with colors and simple patterns form a stepping path that leads to a small open picture book; a child happily steps along the blocks", "알파벳부터 시작하는 첫 3개월 로드맵"),
      imgs=[
       ("## 1개월 차: 소리와 친해지기", "A parent and child singing together with musical notes floating in the air, picture flashcards of an apple, a ball and a cat scattered on the floor", "노래와 카드로 소리와 친해지는 첫 달"),
       ("## 2개월 차: 소리를 이어 단어 읽기", "Picture cards spread across the floor like a game board; the child joyfully steps on one card as the parent points to it", "놀이처럼 익히는 단어와 사이트 워드"),
       ("## 3개월 차: 첫 문장 만들기", "A child's crayon drawing of a dog stuck to a refrigerator door with a magnet, and the child proudly pointing at it", "3개월의 성과, 냉장고에 붙인 나의 첫 문장"),
       ("## 하루 15분, 이렇게 나눠 보세요", "A simple round clock face without numbers divided into three colored segments, each holding an icon: a music note, a puzzle piece and an open book", "노래, 오늘의 활동, 그림책으로 나눈 15분"),
      ]),
 dict(no="09", src="09-growth-one-minute-speech.md", section="새로운 이야기", cat="아티클", tags="성장 기록",
      date="2026.09.23 · 5분 읽기", summary="말하기를 어려워하던 아이가 1분 스피치까지 가는 단계를, 가상의 아이 '지우'의 이야기로 따라가 봐요.", bg="soft peach (#FCE8E2)",
      card_change="요약문 교체 (기존: '6개월간의 학습 리포트로 따라가 본 한 아이의 변화.' → 실제 사례로 오해될 수 있음). 태그는 '성장 기록' 대신 '말하기 성장' 권장",
      hero=("An elementary school girl standing in front of her classmates giving a short speech while holding up a drawing of a small white dog; classmates smile and listen", "말 한마디 못 하던 아이의 1분 스피치"),
      imgs=[
       ("## 1개월 차: 듣기만 하는 시간", "A quiet child sitting in class and listening intently to the teacher, with gentle sound waves flowing toward the child and turning into tiny sprouting seeds", "말이 없는 시간은 채우는 시간이에요"),
       ("## 2~3개월 차: 한 단어에서 한 문장으로", "A child answering with a small speech bubble that holds a single dog icon, and the teacher replying with a bigger speech bubble holding a dog and heart icons", "한 단어 대답을 문장으로 넓혀 주기"),
       ("## 4개월 차: 따라 말하기가 자신감이 되다", "A child at home wearing headphones and quietly repeating along with a video on a tablet, with small echoing speech bubbles", "따라 말하기가 혼잣말이 되는 시기"),
       ("## 집에서 부모님이 함께할 수 있는 일", "A parent and child watching a tablet together on the sofa; the parent asks a question and the child points excitedly at the screen", "시험이 아니라 함께 보는 이야기로"),
      ]),
 dict(no="10", src="10-news-middle-school-listening.md", section="새로운 이야기", cat="뉴스", tags="중등 대비",
      date="2026.09.19 · 5분 읽기", summary="시험 형식과 출제 경향을 보고 지금부터 할 수 있는 준비를 정리했어요.", bg="light cool gray (#F3F4F6) with soft green accents",
      hero=("A calm middle school classroom with a speaker on the wall sending out soft sound waves; students listen with focus over their answer sheets", "중학교 영어 듣기평가 준비"),
      imgs=[
       ("## 주로 나오는 문제 유형", "A tidy grid of five icon cards: a picture frame, a target, a clock with a price tag, emotion faces, and a speech bubble with an arrow", "자주 나오는 듣기 문제 유형 다섯 가지"),
       ("## 초등 때 해두면 좋은 다섯 가지", "A child wearing headphones in a cozy reading corner at home, listening to a picture book audio with a relaxed smile", "매일 듣는 귀 만들기"),
       ("## 학년별 듣기 루틴 예시", "Three children of increasing age side by side: the youngest sings along to a song, the middle one watches a short cartoon, the oldest takes notes while watching a documentary", "학년에 맞춰 늘려 가는 듣기 루틴"),
       ("## 이렇게 하면 오히려 역효과예요", "A contrast composition: on one side a tired child slumped before a tall stack of workbooks, on the other side a cheerful child listening to music with headphones", "문제집보다 즐겁게 많이 듣기가 먼저예요"),
      ]),
 dict(no="11", src="11-picture-book-questions.md", section="새로운 이야기", cat="아티클", tags="영어 그림책",
      date="2026.09.16 · 5분 읽기", summary="읽어주기에서 함께 말하기로 넘어가는 대화 질문 5가지를 소개해요.", bg="fresh mint green (#C6EBD3)",
      hero=("A parent and child cuddled up in bed at night reading a big colorful picture book; the child points at the page and talks while warm lamp light glows", "영어 그림책, 읽어주기에서 함께 말하기로"),
      imgs=[
       ("## '대화식 읽기'라는 방법이 있어요", "A parent and child facing each other over an open picture book, with speech bubbles bouncing back and forth between them like a friendly ping-pong rally", "질문하고, 대답을 넓혀 주는 대화식 읽기"),
       ("## 함께 말하기로 넘어가는 질문 5가지", "Five question-mark-shaped bookmarks in different pastel colors sticking out of the top of a closed picture book", "그림책 사이에 끼워 두는 다섯 가지 질문"),
       ("## 한 장면으로 보는 실제 대화", "Close-up of an open picture book spread showing a cute green caterpillar munching through an apple and two pears, with a child's finger pointing at the fruit", "한 장면에서 시작되는 영어 대화"),
       ("## 연령별 그림책 고르기 팁", "Three small stacks of picture books growing in size, from chunky board books to thicker storybooks, with a child reaching for the middle stack", "아이 단계에 맞는 그림책 고르기"),
      ]),
 dict(no="12", src="12-parent-guide-child-dislikes-english.md", section="새로운 이야기", cat="아티클", tags="부모 가이드",
      date="2026.09.12 · 5분 읽기", summary="흥미를 잃은 이유부터 살펴보면 다시 시작할 방법이 보여요.", bg="very pale mint (#E8F7EC)",
      hero=("A child sitting with arms crossed and a pouting face beside an English workbook, while a parent kneels next to them with an open, caring expression", "영어 싫다는 아이, 먼저 확인할 것"),
      imgs=[
       ("## '싫다'는 말 뒤에 숨은 진짜 마음", "A large speech bubble gently opening to reveal smaller bubbles inside, each with an icon: a tired face, a worried face, a bored face and a steep mountain", "'싫어' 한마디에 담긴 여러 가지 마음"),
       ("## 억지로 시키기 전에 확인할 다섯 가지", "A parent holding a magnifying glass up to a board with five icon items: a staircase, a broken star, a heavy backpack, a dinosaur and a clock", "억지로 시키기 전에 살펴볼 다섯 가지"),
       ("## 다시 시작하는 작은 방법들", "A child happily reading an easy picture book about dinosaurs, sitting on stepping stones that lead gently upward", "쉬운 책, 좋아하는 주제로 다시 시작해요"),
       ("## 부모님의 마음도 챙겨 주세요", "A parent sitting calmly with a cup of tea, watching the child play in soft late-afternoon light, peaceful atmosphere", "조급한 마음을 내려놓고 아이의 속도에 맞춰요"),
      ]),
]

# 기본: 섹션 첫 블록 바로 아래. 소제목이 바로 이어지는 섹션 등은 여기서 위치를 직접 지정한다.
#   ("top",)          -> 섹션 제목 바로 아래
#   ("after", prefix) -> 섹션 안에서 prefix로 시작하는 줄이 속한 블록 바로 아래
PLACE = {
    ("02", 2): ("top",), ("03", 2): ("top",), ("08", 1): ("top",),
    ("10", 2): ("top",), ("11", 2): ("top",), ("12", 2): ("top",),
    ("07", 1): ("after", "**5. It's my cup of tea.**"),
    ("08", 2): ("after", "== 한 주가 끝나면"),
    ("08", 3): ("after", "아이가 만든 문장을 그림과 함께"),
}

def place_desc(no, k, head):
    rule = PLACE.get((no, k))
    sec = f"`{head[3:]}`"
    if rule is None:
        return f"{sec} 섹션 첫 문단 바로 아래"
    if rule[0] == "top":
        return f"{sec} 섹션 제목 바로 아래(첫 소제목보다 위)"
    return f"{sec} 섹션 안, \"{rule[1].strip('*= ')[:18]}…\" 블록 바로 아래"

def prompt(scene, bg, ar):
    orient = "Horizontal 16:9 composition." if ar == "16:9" else "Horizontal 3:2 composition."
    return f"{scene}. {STYLE.format(bg=bg)} {orient}"

def insert_images(body, p):
    lines = body.split("\n")
    for k, (head, _, cap) in enumerate(p["imgs"], 1):
        idx = lines.index(head)
        rule = PLACE.get((p["no"], k))
        if rule and rule[0] == "top":
            i = idx + 1
        else:
            i = idx + 1
            if rule:  # 지정한 줄까지 이동
                while not lines[i].startswith(rule[1]):
                    assert not lines[i].startswith("## "), (p["no"], k)
                    i += 1
            while i < len(lines) and not lines[i].strip():   # 빈 줄 건너뛰기
                i += 1
            while i < len(lines) and lines[i].strip():       # 블록 끝까지
                i += 1
        lines[i:i] = ["", f"![M:{cap}](IMAGE-URL-{p['no']}-{k})"]
    return "\n".join(lines)

def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for p in POSTS:
        body = (SRC / p["src"]).read_text(encoding="utf-8").rstrip("\n")
        title = body.split("\n", 1)[0][2:]
        heads = [h for h, _, _ in p["imgs"]]
        assert all(h in body.split("\n") for h in heads), p["no"]
        out = [f"# [작업지침] {p['no']}. {title}", "",
               "> 이 파일은 **작업지침 → 이미지 프롬프트 → 본문** 순서로 되어 있어요. 에디터에는 맨 아래 `▼ 본문 시작` 줄 **다음부터** 붙여 넣어 주세요.", "",
               "## 1. 게시 정보", "",
               "| 항목 | 내용 |", "|---|---|",
               f"| 영역 | {p['section']} |", f"| 제목 | {title} |",
               f"| 기존 제목 | {CARD[p['no']]['old_title']} (사이트 카드 교체 필요) |",
               f"| 카드 요약문 | {CARD[p['no']]['summary'] or CARD[p['no']]['old_summary'] + ' (유지)'} |",
               f"| 태그 | {CARD[p['no']]['tags']} |",
               f"| 날짜/표기 | {CARD[p['no']]['meta'] or p['date']} |",
               f"| 카드·이미지 기준 색 | {p['bg']} |",
               "| 카드 문구·카드뉴스 표지 | `98-카드문구-교체안.md` 참고 |", "",
               "## 2. 이미지 작업 목록 (총 5장)", "",
               "| # | 파일명 | 용도 | 비율 | 넣을 위치 | 캡션 |", "|---|---|---|---|---|---|",
               f"| 0 | {p['no']}-hero.png | 대표(썸네일) | {HERO_AR} | 게시글 대표 이미지 칸 (본문에 넣지 않음) | {title} |"]
        for k, (h, _, cap) in enumerate(p["imgs"], 1):
            out.append(f"| {k} | {p['no']}-{k}.png | 본문 (M) | {BODY_AR} | {place_desc(p['no'], k, h)} (`IMAGE-URL-{p['no']}-{k}` 자리) | {cap} |")
        out += ["", "## 3. 영문 프롬프트", "",
                f"### 대표 이미지 — {p['no']}-hero.png ({HERO_AR})", "", "```", prompt(p["hero"][0], p["bg"], HERO_AR), "```", ""]
        for k, (h, scene, cap) in enumerate(p["imgs"], 1):
            out += [f"### 본문 이미지 {k} — {p['no']}-{k}.png ({BODY_AR})",
                    f"- 위치: {place_desc(p['no'], k, h)}", f"- 캡션: {cap}", "",
                    "```", prompt(scene, p["bg"], BODY_AR), "```", ""]
        out += ["## 4. 작업 순서", "",
                "1. 위 프롬프트로 이미지 5장을 생성해요. 비율은 표대로 맞추고, 글자가 생긴 컷은 다시 생성해요.",
                "2. 이미지를 업로드해서 URL을 받아요.",
                f"3. 본문의 `IMAGE-URL-{p['no']}-1` ~ `IMAGE-URL-{p['no']}-4`를 업로드한 URL로 바꿔요.",
                f"4. `{p['no']}-hero.png`는 게시글 대표 이미지(썸네일) 칸에 등록해요.",
                "5. 미리보기로 이미지 위치와 캡션을 확인한 뒤 발행해요.", "",
                "▼ 본문 시작 (이 줄 아래부터 에디터에 붙여넣기) ▼", "", insert_images(body, p), ""]
        name = (SRC / p["src"]).name
        (OUT / name).write_text("\n".join(out), encoding="utf-8")
    for doc in (ROOT / "docs").glob("*.md"):   # README, 검수리포트
        shutil.copy(doc, OUT / doc.name)
    zpath = ROOT / "blog-posts-2026-10-final.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(OUT.glob("*.md")):
            z.write(f, f.name)

if __name__ == "__main__":
    build()
