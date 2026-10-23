"""Build question pack and cropped images for the live game."""
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path('/Users/nely/Desktop/iq-arena-game')
MEDIA = ROOT / 'public' / 'media'
TEXT = Path('/tmp/iq-game-pdf/IQ-arena-questions.txt')
HI = Path('/tmp/iq-hi')

MEDIA.mkdir(parents=True, exist_ok=True)


def blocks(path: Path, min_w=90, min_h=120, max_gap=6):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    ink = [0] * h
    wide = [False] * h
    for y in range(h):
        xs = []
        count = 0
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r < 246 or g < 246 or b < 246:
                count += 1
                xs.append(x)
        ink[y] = count
        if count >= 18 and xs and xs[-1] - xs[0] >= min_w:
            wide[y] = True
    spans = []
    y = 0
    while y < h:
        if not wide[y]:
            y += 1
            continue
        start = y
        gap = 0
        y += 1
        while y < h:
            if wide[y]:
                gap = 0
                y += 1
            elif gap < max_gap:
                gap += 1
                y += 1
            else:
                break
        end = y - gap
        if end - start >= min_h:
            spans.append((start, end))
    split = []
    for a, b in spans:
        vals = [ink[i] for i in range(a, b) if ink[i] > 0]
        med = sorted(vals)[len(vals) // 2] if vals else 1
        thresh = max(12, med * 0.28)
        s = None
        light = 0
        for yy in range(a, b):
            if ink[yy] >= thresh:
                if s is None:
                    s = yy
                light = 0
            else:
                light += 1
                if s is not None and light >= 10:
                    e = yy - light + 1
                    if e - s >= min_h:
                        split.append((s, e))
                    s = None
        if s is not None:
            e = b
            while e > s and ink[e - 1] < thresh:
                e -= 1
            if e - s >= min_h:
                split.append((s, e))
    return im, split


def save_crop(im: Image.Image, box, dest: Path):
    y0, y1 = box
    crop = im.crop((0, y0, im.width, y1))
    px = crop.load()
    w, h = crop.size
    min_x, max_x = w, 0
    for y in range(h):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r < 246 or g < 246 or b < 246:
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
    if max_x > min_x:
        pad = 12
        crop = crop.crop((max(0, min_x - pad), 0, min(w, max_x + pad), h))
    if crop.width > 1200:
        nh = int(crop.height * 1200 / crop.width)
        crop = crop.resize((1200, nh), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    crop.save(dest, 'JPEG', quality=82, optimize=True)
    return '/' + str(dest.relative_to(ROOT / 'public'))


def page_crops(page: int):
    im, spans = blocks(HI / f'p{page:02d}.png')
    return im, spans


def take(page: int, names, points, sl=None):
    im, spans = page_crops(page)
    chosen = spans if sl is None else spans[sl]
    if len(chosen) != len(names):
        print(f'WARN page {page}: images {len(spans)} chosen {len(chosen)} names {len(names)}')
    out = []
    n = min(len(chosen), len(names))
    for i in range(n):
        dest = MEDIA / 'guess' / f'p{page}-{i}.jpg'
        url = save_crop(im, chosen[i], dest)
        out.append({'points': points, 'image': url, 'answer': names[i]})
    return out


def parse_numbered(block: str):
    block = re.sub(r'=====.*?=====', '\n', block)
    lines = block.splitlines()
    chunks = []
    buf = []

    def flush():
        if buf:
            chunks.append(' '.join(x.strip() for x in buf if x.strip()))

    for line in lines:
        if re.match(r'\s*\d+\s*[.)]', line):
            flush()
            buf = [line]
        elif buf:
            buf.append(line)
    flush()
    items = []
    for chunk in chunks:
        body = re.sub(r'^\d+\s*[.)]\s*', '', chunk).strip()
        body = re.sub(r'\s+', ' ', body)
        answer = ''
        question = body
        m = re.search(r'(?:Պատասխան|պատասխան)\s*[:：․.՝]?\s*(.+)$', body)
        if m and m.start() > 0:
            question = body[: m.start()].strip(' -—–:․.')
            answer = m.group(1).strip()
        else:
            best = -1
            sep_len = 0
            for sep in (' — ', ' – ', ' - ', '—', '–', '։-', '.-'):
                i = body.rfind(sep)
                if i > best and i > 6:
                    best = i
                    sep_len = len(sep)
            if best > 0:
                question = body[:best].strip()
                answer = body[best + sep_len :].strip()
        question = question.strip(' -—–՝')
        answer = re.split(r'[❗🟠🟢✅🏛🌍🏆💻🔬🎭]', answer)[0]
        answer = answer.strip(' .։՝-—–')
        if len(question) < 8 or len(answer) < 1:
            continue
        if len(answer) > 240:
            continue
        items.append({'q': question, 'a': answer})
    return items


def main():
    raw = TEXT.read_text(encoding='utf-8')
    know_raw = raw.split('ՓՈՒԼ 2')[0]
    headers = [
        ('physics', 'Ֆիզիկա'),
        ('language', 'Հայոց լեզու'),
        ('literature', 'Հայ գրականություն'),
        ('biology', 'Կենսաբանություն'),
        ('geography', 'Աշխարհագրություն'),
        ('math', 'Մաթեմատիկա'),
        ('history', 'Հայոց պատմություն'),
        ('informatics', 'Ինֆորմատիկա'),
    ]
    def header_at(text, title, start=0):
        token = '\n' + title + '\n'
        return text.find(token, start)

    know = []
    cursor = 0
    for i, (cid, title) in enumerate(headers):
        start = header_at(know_raw, title, cursor)
        if start < 0:
            print('MISSING', title)
            continue
        end = header_at(know_raw, headers[i + 1][1], start + len(title)) if i + 1 < len(headers) else len(know_raw)
        if end < 0:
            end = len(know_raw)
        cursor = start + len(title)
        items = parse_numbered(know_raw[start:end])
        print(f'know {title}: {len(items)}')
        know.append({'id': cid, 'title': title, 'questions': items})

    films = []
    films += take(18, ['Տիտանիկ', 'Ալադին', 'Տանը մենակ'], 2)
    films += take(19, ['Սարդ մարդը՝ նոր օր', 'Առյուծ արքան'], 2)
    films += take(20, ['Սատանան կրում է Պրադա', 'Կարիբյան ծովի ծովահենները'], 4)
    films += take(21, ['Ֆորսաժ', 'Ավատար', 'Տրանսֆորմերներ'], 4)
    films += take(22, ['Չարլին և շոկոլադի գործարանը', 'Հարրի Փոթերը և Ազկաբանի բանտարկյալը', 'Մատանիների տիրակալը'], 6)
    films += take(23, ['Interstellar', 'Մատրիցա'], 6)

    city_answers = [
        (2, 'Ռուսաստան'), (2, 'Վենետիկ'), (2, 'Ավստրալիա'), (2, 'Մեծ Բրիտանիա'),
        (4, 'ԱՄՆ'), (4, 'Հայաստան'), (4, 'Իտալիա'), (4, 'ԱՄՆ'), (4, 'Հնդկաստան'), (4, 'Իտալիա'),
        (6, 'Մեծ Բրիտանիա'), (6, 'Հունաստան'), (6, 'Եգիպտոս'), (6, 'Վատիկան'), (6, 'Հորդանան'),
    ]
    city_spans = []
    for page in (24, 25, 26, 27, 28):
        im, spans = page_crops(page)
        for span in spans:
            city_spans.append((im, span, page))
    print('city images', len(city_spans), 'answers', len(city_answers))
    cities = []
    for i, ((im, span, page), (points, answer)) in enumerate(zip(city_spans, city_answers)):
        url = save_crop(im, span, MEDIA / 'guess' / f'city-{i}.jpg')
        cities.append({'points': points, 'image': url, 'answer': answer})

    people_answers = [
        (2, 'Կրիշտիանու Ռոնալդու'), (2, 'Լիոնել Մեսսի'), (2, 'Ջեքի Չան'), (2, 'Թեյլոր Սվիֆթ'),
        (4, 'Ալբերտ Էյնշտեյն'), (4, 'Սթիվ Ջոբս'), (4, 'Վինսենթ վան Գոգ'), (4, 'Բարաք Օբամա'), (4, 'Մարկ Ցուկերբերգ'),
        (6, 'Պաբլո Պիկասո'), (6, 'Սթիվեն Հոքինգ'), (6, 'Բիլ Գեյթս'), (6, 'Չարլի Չապլին'), (6, 'Լեոնարդո դա Վինչի'),
    ]
    people_spans = []
    for page in (29, 30, 31, 32, 33):
        im, spans = page_crops(page)
        for span in spans:
            people_spans.append((im, span))
    print('people images', len(people_spans), 'answers', len(people_answers))
    people = []
    for i, ((im, span), (points, answer)) in enumerate(zip(people_spans, people_answers)):
        url = save_crop(im, span, MEDIA / 'guess' / f'person-{i}.jpg')
        people.append({'points': points, 'image': url, 'answer': answer})

    emoji = [
        {'points': 2, 'emoji': '🦁👑', 'answer': 'Առյուծ արքան'},
        {'points': 2, 'emoji': '❄️👸⛄', 'answer': 'Սառցե սիրտ'},
        {'points': 2, 'emoji': '🐠🔍🌊', 'answer': 'Նեմոյին գտնելը'},
        {'points': 2, 'emoji': '🚗🏁⚡', 'answer': 'Մեքենաներ'},
        {'points': 2, 'emoji': '🐼🥋', 'answer': 'Կունգ ֆու պանդա'},
        {'points': 4, 'emoji': '🟢👹🏰🫏', 'answer': 'Շրեկ'},
        {'points': 4, 'emoji': '🐀👨‍🍳🍲', 'answer': 'Ռատատույ'},
        {'points': 4, 'emoji': '🐞🐱', 'answer': 'Լեդի Բագը և Սուպեր Կատուն'},
        {'points': 4, 'emoji': '🎈🏠👴', 'answer': 'Վեր'},
        {'points': 4, 'emoji': '🧸🤠🚀', 'answer': 'Խաղալիքների պատմություն'},
        {'points': 4, 'emoji': '🐉👦🏹', 'answer': 'Ինչպես ընտելացնել վիշապին'},
        {'points': 6, 'emoji': '🧠😊😢😡😱🤢', 'answer': 'Գլուխկոտրուկ'},
        {'points': 6, 'emoji': '🤖🌱🚀', 'answer': 'Վոլի'},
        {'points': 6, 'emoji': '🐉🏮👧', 'answer': 'Ռայան և վերջին վիշապը'},
        {'points': 6, 'emoji': '🎸💀🌼', 'answer': 'Կոկո'},
        {'points': 6, 'emoji': '🕷️🕸️🌌', 'answer': 'Սարդ-մարդ. տիեզերքի միջով'},
    ]

    brain = [
        {'id': 'n1', 'group': 'Թվեր', 'seconds': 30, 'prompt': '3, 6, 12, 24, __', 'answer': '48', 'note': 'Յուրաքանչյուր թիվը նախորդի կրկնապատիկն է։'},
        {'id': 'n2', 'group': 'Թվեր', 'seconds': 30, 'prompt': '1, 4, 9, 16, 25, __', 'answer': '36', 'note': 'Բնական թվերի քառակուսիներն են։'},
        {'id': 'n3', 'group': 'Թվեր', 'seconds': 30, 'prompt': '3, 7, 15, 31, __', 'answer': '63', 'note': 'Բազմապատկիր 2-ով և ավելացրու 1։'},
        {'id': 'n4', 'group': 'Թվեր', 'seconds': 30, 'prompt': '4, 9, 19, 39, 79, __', 'answer': '159', 'note': 'Բազմապատկիր 2-ով և ավելացրու 1։'},
        {'id': 'n5', 'group': 'Թվեր', 'seconds': 30, 'prompt': '7, 14, 28, 56, __', 'answer': '112', 'note': 'Յուրաքանչյուր թիվը կրկնապատկվում է։'},
        {'id': 'r1', 'group': 'Հանելուկ', 'seconds': 45, 'prompt': 'Մութ սենյակում կա մոմ, լամպ և բուխարի։ Ունես միայն մեկ լուցկի։ Ի՞նչը կվառես առաջինը։', 'answer': 'Լուցկին', 'note': ''},
        {'id': 'r2', 'group': 'Հանելուկ', 'seconds': 45, 'prompt': 'Հայրը 40 տարեկան է, որդին՝ 10։ Քանի՞ տարի հետո հայրը որդուց երկու անգամ մեծ կլինի։', 'answer': '20 տարի', 'note': 'Հայրը կլինի 60, որդին՝ 30։'},
        {'id': 'r3', 'group': 'Հանելուկ', 'seconds': 45, 'prompt': '3 հավը 3 օրում ածում է 3 ձու։ Քանի՞ ձու կածեն 6 հավը 6 օրում։', 'answer': '12 ձու', 'note': ''},
        {'id': 'r4', 'group': 'Հանելուկ', 'seconds': 45, 'prompt': 'Մրցավազքում դու անցնում ես երկրորդ տեղում վազող մասնակցին։ Ո՞ր տեղում ես հիմա։', 'answer': 'Երկրորդ տեղում', 'note': 'Դու զբաղեցնում ես նրա տեղը, ում անցար։'},
        {'id': 'r5', 'group': 'Հանելուկ', 'seconds': 45, 'prompt': 'Երկու հայր և երկու որդի գնացին ձկնորսության։ Յուրաքանչյուրը մեկ ձուկ բռնեց, բայց ընդամենը 3 ձուկ եղավ։ Ինչպե՞ս։', 'answer': '3 հոգի էին', 'note': 'Պապը, հայրը և որդին։'},
    ]
    visual_answers = ['1', '7', '2', '1', '4']
    visual_pages = [(36, None), (37, None), (38, None)]
    vi = 0
    for page, _ in visual_pages:
        im, spans = page_crops(page)
        for span in spans:
            if vi >= len(visual_answers):
                break
            url = save_crop(im, span, MEDIA / 'brain' / f'v{vi + 1}.jpg')
            brain.append({
                'id': f'v{vi + 1}',
                'group': 'Նկար',
                'seconds': 30,
                'prompt': 'Գտիր օրինաչափությունը',
                'image': url,
                'answer': visual_answers[vi],
                'note': 'Պատասխանը տարբերակների համարն է։',
            })
            vi += 1
    print('visual', vi)
    mi = 0
    for page in (39, 40, 41):
        im, spans = page_crops(page)
        for span in spans:
            mi += 1
            url = save_crop(im, span, MEDIA / 'brain' / f'm{mi}.jpg')
            brain.append({
                'id': f'm{mi}',
                'group': 'Լուցկի',
                'seconds': 45,
                'prompt': 'Տեղափոխիր լուցկիները, որ հավասարումը ճիշտ դառնա',
                'image': url,
                'answer': 'Ստուգիր թերթիկը',
                'note': 'Պատասխանը ֆայլում գրված չէ. համեմատիր թիմի լուծումը նկարի հետ։',
            })
    print('matches', mi)

    buzzer_raw = raw.split('ՓՈՒԼ 4')[1].split('ՓՈՒԼ 5')[0]
    buzzer_headers = [
        ('science', 'Գիտություն'),
        ('sport', 'Սպորտ'),
        ('tech', 'Տեխնոլոգիաներ'),
        ('culture', 'Մշակույթ'),
        ('past', 'Պատմություն'),
        ('geo', 'Աշխարհագրություն'),
    ]
    buzzer_marks = [
        ('science', 'Գիտություն', '🔬 Գիտություն'),
        ('sport', 'Սպորտ', '🏆 Սպորտ'),
        ('tech', 'Տեխնոլոգիաներ', '💻 Տեխնոլոգիաներ և AI'),
        ('culture', 'Մշակույթ', '🎭 Մշակույթ և արվեստ'),
        ('past', 'Պատմություն', '🏛 Պատմություն'),
        ('geo', 'Աշխարհագրություն', '🌍 Աշխարհագրություն'),
    ]
    buzzer = []
    for i, (cid, title, mark) in enumerate(buzzer_marks):
        start = buzzer_raw.find(mark)
        end = buzzer_raw.find(buzzer_marks[i + 1][2]) if i + 1 < len(buzzer_marks) else len(buzzer_raw)
        items = parse_numbered(buzzer_raw[start:end])
        print(f'buzz {title}: {len(items)}')
        buzzer.append({'id': cid, 'title': title, 'questions': items})

    final = [
        {
            'id': 'robot',
            'title': 'ROBOT',
            'word': 'ROBOT',
            'tasks': [
                {'prompt': 'Վերադասավորիր տառերը և կազմիր բառ', 'letters': 'K O O B', 'answer': 'BOOK', 'take': 'երկու կրկնվող տառերը՝ O O'},
                {'prompt': 'Ո՞րն է Իտալիայի մայրաքաղաքը', 'letters': '', 'answer': 'ROME', 'take': 'առաջին տառը՝ R'},
                {'prompt': 'Յուրաքանչյուր տառը մեկ դիրքով հետ տար', 'letters': 'C P V U', 'answer': 'BOUT', 'take': 'առաջին և վերջին տառերը՝ B, T'},
            ],
        },
        {
            'id': 'brain',
            'title': 'BRAIN',
            'word': 'BRAIN',
            'tasks': [
                {'prompt': 'Վերադասավորիր տառերը։ Հուշում հարցին՝ երկրի անուն չէ', 'letters': 'I N R A', 'answer': 'RAIN', 'take': 'առաջին երկու տառերը՝ R A'},
                {'prompt': 'Ո՞րն է Բրազիլիայի մայրաքաղաքը', 'letters': '', 'answer': 'BRAZILIA', 'take': 'առաջին տառը՝ B'},
                {'prompt': 'Յուրաքանչյուր տառը մեկ դիրքով հետ տար', 'letters': 'C Y J O', 'answer': 'BXIN', 'take': 'վերջին երկու տառերը՝ I N'},
            ],
        },
        {
            'id': 'logic',
            'title': 'LOGIC',
            'word': 'LOGIC',
            'tasks': [
                {'prompt': 'Վերադասավորիր տառերը և կազմիր բառ', 'letters': 'D C O L', 'answer': 'COLD', 'take': 'առաջին երկու տառերը՝ C O'},
                {'prompt': 'Ո՞ր երկրի մայրաքաղաքն է Բեռլինը', 'letters': '', 'answer': 'GERMANY', 'take': 'առաջին տառը՝ G'},
                {'prompt': 'Յուրաքանչյուր տառը մեկ դիրքով առաջ տար', 'letters': 'K P G H', 'answer': 'LQHI', 'take': 'առաջին և վերջին տառերը՝ L, I'},
            ],
        },
        {
            'id': 'quest',
            'title': 'QUEST',
            'word': 'QUEST',
            'tasks': [
                {'prompt': 'Վերադասավորիր տառերը և կազմիր բառ', 'letters': 'M J P U', 'answer': 'JUMP', 'take': 'երկրորդ տառը՝ U'},
                {'prompt': 'Ո՞ր երկրի մայրաքաղաքն է Դոհան', 'letters': '', 'answer': 'QATAR', 'take': 'առաջին և երրորդ տառերը՝ Q, T'},
                {'prompt': 'Յուրաքանչյուր տառը մեկ դիրքով առաջ տար', 'letters': 'R H Y D', 'answer': 'SIZE', 'take': 'առաջին և վերջին տառերը՝ S, E'},
            ],
        },
    ]

    pack = {
        'know': know,
        'guess': [
            {'id': 'films', 'title': 'Ֆիլմ', 'items': films},
            {'id': 'cities', 'title': 'Քաղաք', 'items': cities},
            {'id': 'people', 'title': 'Հայտնի մարդ', 'items': people},
            {'id': 'emoji', 'title': 'Մուլտֆիլմ', 'items': emoji},
        ],
        'brain': brain,
        'buzzer': buzzer,
        'final': final,
    }
    for cat in pack['guess']:
        for i, item in enumerate(cat['items']):
            item['id'] = f"{cat['id']}-{item['points']}-{i}"
    out = ROOT / 'src' / 'data' / 'pack.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding='utf-8')
    print('wrote', out, 'films', len(films), 'cities', len(cities), 'people', len(people))


if __name__ == '__main__':
    main()
