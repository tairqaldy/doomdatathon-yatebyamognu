#!/usr/bin/env python3
"""Conservative transcript quality guard and c01 greeting probe.
Not a replacement for official rubric/LLM; focuses on false negative regressions.
Usage: python transcript_guard.py --self-test; python transcript_guard.py dataset.json
"""
from __future__ import annotations
import argparse, json, re, unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from datetime import datetime

GREETINGS = {
  'ru': ('здравствуйте','здравствуй','добрый день','доброе утро','добрый вечер','привет'),
  'kk': ('сәлеметсіз бе','сәлеметсiз бе','қайырлы күн','қайырлы таң','қайырлы кеш','сәлем'),
  'en': ('hello','good morning','good afternoon','good evening','hi'),
}
SELF_INTROS = {
  'ru': (r'меня зовут\s+[а-яa-zәіңғүұқөһ]+',r'с вами\s+[а-яa-zәіңғүұқөһ]+',r'я\s+(?:оператор|консультант|специалист)\b'),
  'kk': (r'менің атым\s+\S+',r'мен\s+[\wәіңғүұқөһ]+\s*(?:боламын|мын|мін)\b'),
  'en': (r'my name is\s+[a-z]+',r'this is\s+[a-z]+',r'i am\s+(?:an?\s+)?(?:agent|support representative|consultant)'),
}
BRANDS = ('freedom broker','фридом брокер','фридом брокир','фридом брокеръ','фридом бракер','freedom brocker','freedom brokar','freedom brooker','фридом брокр','фридом брокерр')
TRANS = str.maketrans({'ё':'е','ї':'i','ı':'i','’':"'",'‐':'-','‑':'-','–':'-','—':'-'})

def norm(text):
    s = unicodedata.normalize('NFKC', str(text or '')).lower().translate(TRANS)
    s = re.sub(r'[^\w\s\-\']+', ' ',s, flags=re.UNICODE)
    return ' '.join(s.split())

def brand_signal(text):
    """Brand is a supporting signal, NEVER a mandatory rubric component."""
    s = norm(text)
    if any(norm(b) in s for b in BRANDS): return {'detected':True,'method':'known_variant','confidence':'high'}
    words=s.split()
    windows=[' '.join(words[i:i+k]) for k in (2,3) for i in range(max(0,len(words)-k+1))]
    targets=['freedom broker','фридом брокер']
    best=max((SequenceMatcher(None,w,t).ratio() for w in windows for t in targets), default=0)
    if best >= .82: return {'detected':True,'method':'approximate','confidence':'medium'}
    return {'detected':False,'method':'none','confidence':'low'}

def phrase_present(text, phrase):
    return re.search(r'(?<!\w)' + re.escape(norm(phrase)) + r'(?!\w)', text) is not None


def introduction_present(text, language):
    # Masking a name is not evidence that the operator failed to introduce themself.
    name = r'(?:\[имя скрыто\]|\[name hidden\]|[^\W\d_]+)'
    patterns = {
        'ru': [rf'меня зовут\s+{name}', rf'с вами\s+{name}',
               rf'(?:^|[,.!?]\s*)я\s+{name}(?=\s*[,!.?]|$)'],
        'kk': [rf'менің атым\s+{name}',
               rf'(?<!\w)мен\s+{name}(?:мын|мін|пын|пін|бын|бін)?(?=\s*[,!.?]|$)'],
        'en': [rf'my name is\s+{name}', rf'this is\s+{name}',
               rf"(?<!\w)i(?: am|'m)\s+{name}(?=\s*[,!.?]|$)"],
    }
    # Match punctuation before normalization; roles alone do not supply a name.
    clean = unicodedata.normalize('NFKC', str(text or '')).lower().translate(TRANS)
    clean = re.sub(r'«[^»]*»|“[^”]*”|"[^"]*"', '', clean)
    # A role or an apology is not a personal introduction.
    clean = re.sub(r"(?<!\w)(?:я|мен|i am|i'm)\s+(?:оператор|консультант|специалист|sorry|here|ready|agent|consultant|support)(?!\w)", '', clean)
    return any(re.search(p, clean) for p in patterns.get(language, []))


def greeting_probe(text, language='ru', first_agent_turn=True, asr_uncertain=False):
    """Tri-state probe: supported / not_supported / needs_review. Does not award final score."""
    lang = str(language).lower().replace('_', '-').split('-')[0]
    lang = {'kz': 'kk', 'kaz': 'kk'}.get(lang, lang)
    if lang not in GREETINGS:
        return {'status': 'needs_review', 'evidence': {'language': lang},
                'note': 'Unsupported language; do not apply an automatic penalty.'}
    clean = re.sub(r'«[^»]*»|“[^”]*”|"[^"]*"', '', str(text or ''))
    s=norm(clean)
    greeting=any(phrase_present(s, g) for g in GREETINGS[lang])
    if re.search(r'\b(?:не сказал|не говорил|did not say|never said)\b', s):
        greeting=False
    # Fuzzy for ASR spelling of short salutations; avoid short common words.
    fuzzy=False
    if not greeting:
        for phrase in GREETINGS[lang]:
            if len(norm(phrase))<7: continue
            target=norm(phrase).split()
            for window in (s.split()[i:i+len(target)] for i in range(len(s.split())-len(target)+1)):
                if SequenceMatcher(None,' '.join(window),norm(phrase)).ratio() >= .87:
                    fuzzy=True
    introduced=introduction_present(clean, lang)
    brand=brand_signal(s)
    evidence={'greeting':greeting,'fuzzy_greeting':fuzzy,'self_introduction':introduced,'brand':brand,'first_agent_turn':first_agent_turn,'language':lang}
    if not first_agent_turn: status='not_supported'
    elif greeting and introduced and not asr_uncertain: status='supported'
    elif asr_uncertain or fuzzy or (greeting and brand['detected'] and not introduced): status='needs_review'
    else: status='not_supported'
    return {'status':status,'evidence':evidence,'note':'Probe only: needs_review must not become an automatic penalty.'}

def transcript_quality(messages):
    flags=[]
    last_timestamp=None
    for i,m in enumerate(messages):
        if not isinstance(m,dict): flags.append({'index':i,'kind':'invalid_message'}); continue
        txt = m.get('text',m.get('content',m.get('message')))
        if txt is None or not str(txt).strip(): flags.append({'index':i,'kind':'empty_text'})
        if not (m.get('role') or m.get('speaker') or m.get('sender')): flags.append({'index':i,'kind':'missing_role'})
        if isinstance(m.get('asr_confidence'), (float,int)) and not isinstance(m['asr_confidence'], bool) and 0 <= m['asr_confidence'] < .75:
            flags.append({'index':i,'kind':'low_asr_confidence','confidence':m['asr_confidence']})
        ts=timestamp_value(m.get('timestamp'))
        if isinstance(ts,(int,float)) and last_timestamp is not None and ts<last_timestamp:
            flags.append({'index':i,'kind':'out_of_order_timestamp'})
        if isinstance(ts,(int,float)): last_timestamp=ts
    return flags


def timestamp_value(value):
    if isinstance(value, (float, int)) and not isinstance(value, bool): return value
    if not isinstance(value, str): return None
    if re.fullmatch(r'\d+:\d{2}(?:\.\d+)?', value):
        minutes, seconds = value.split(':')
        return int(minutes)*60+float(seconds) if float(seconds)<60 else None
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.timestamp() if dt.tzinfo else None
    except ValueError: return None

def get_dialogs(data):
    if isinstance(data,list): return data
    if isinstance(data,dict):
        if isinstance(data.get('data'), dict) and isinstance(data['data'].get('records'), list):
            return data['data']['records']
        for key in ('conversations','dialogs','dialogues','items','data'):
            if isinstance(data.get(key),list):return data[key]
    raise ValueError('Unknown schema: expected array or an object containing conversations/dialogs/dialogues/items/data array')

def summarize_dataset(path):
    data=json.loads(Path(path).read_text(encoding='utf-8'))
    dialogs=get_dialogs(data)
    report={'dialog_count':len(dialogs),'warnings':[],'flags_by_kind':{},'c01_candidates':[], 'c01_probes':[],
            'scope': 'Heuristic review signals only; no score changes or confirmed ASR errors without audio review.'}
    seen=set()
    for j,d in enumerate(dialogs):
        if not isinstance(d,dict):report['warnings'].append({'dialog_index':j,'kind':'invalid_dialog'});continue
        did=d.get('conversation_id',d.get('id',str(j)))
        if did in seen:report['warnings'].append({'dialog_index':j,'kind':'duplicate_id','id':did})
        seen.add(did)
        messages=d.get('messages',d.get('turns',d.get('transcript',[])))
        if isinstance(messages,dict):messages=messages.get('messages',[])
        if not isinstance(messages,list):report['warnings'].append({'dialog_index':j,'kind':'non_list_transcript'});continue
        for flag in transcript_quality(messages):
            report['flags_by_kind'][flag['kind']]=report['flags_by_kind'].get(flag['kind'],0)+1
            report['warnings'].append({'dialog_index':j,'id':did,**flag})
        found_operator=False
        for i,m in enumerate(messages):
            if not isinstance(m,dict):continue
            who=norm(m.get('role',m.get('speaker',m.get('sender',''))))
            if who in ('agent','operator','staff','support','оператор','сотрудник'):
                found_operator=True
                text=m.get('text',m.get('content',m.get('message','')))
                lang=d.get('language',m.get('language','ru'))
                lang={'kz':'kk','kaz':'kk','ru':'ru','en':'en'}.get(str(lang).lower(),str(lang).lower())
                confidence=m.get('asr_confidence')
                uncertain=bool(m.get('asr_uncertain')) or (isinstance(confidence,(int,float)) and not isinstance(confidence,bool) and 0<=confidence<.75)
                result=greeting_probe(text,lang,True,uncertain)
                if d.get('channel') == 'voice call' and result['status'] == 'not_supported':
                    result['status']='needs_review'
                    result['note']='Voice opening is incomplete or unsupported in text; check audio before penalizing.'
                item={'id':did,'message_index':i,**result}
                report['c01_probes'].append(item)
                if result['status'] in ('supported','needs_review'):
                    report['c01_candidates'].append({'id':did,'message_index':i,'status':result['status'],'evidence':result['evidence']})
                break
        if not found_operator:
            report['warnings'].append({'dialog_index':j,'id':did,'kind':'missing_operator'})
    return report

def self_test():
    fixtures=[
        ('ru full','Здравствуйте, меня зовут Айдар, Freedom Broker, чем могу помочь?','ru',True,'supported'),
        ('ru brand asr','Здравствуйте, меня зовут Айдар, Фридом Брокир, чем могу помочь?','ru',True,'supported'),
        ('ru brand typo','Здраствуйте, меня зовут Айдар, Фридом Бракер, чем могу помочь?','ru',True,'needs_review'),
        ('ru missing intro','Здравствуйте, чем могу помочь?','ru',True,'not_supported'),
        ('ru intro no greet','Меня зовут Айдар, чем помочь?','ru',True,'not_supported'),
        ('ru later turn','Здравствуйте, меня зовут Айдар','ru',False,'not_supported'),
        ('ru no brand','Здравствуйте, меня зовут Айдар','ru',True,'supported'),
        ('kk greeting','Сәлеметсіз бе, менің атым Айдар, көмектесейін бе?','kk',True,'supported'),
        ('en greeting','Hello, my name is Aydar. How may I help?','en',True,'supported'),
        ('en no introduction','Hello! How can I help you?','en',True,'not_supported'),
        ('client quote','Клиент говорит: «здравствуйте»','ru',True,'not_supported'),
        ('empty','', 'ru',True,'not_supported'),
    ]
    fail=[]
    for name,text,lang,first,expect in fixtures:
        result=greeting_probe(text,lang,first)['status']
        if result!=expect:fail.append({'case':name,'expected':expect,'actual':result})
    quality=transcript_quality([{'role':'agent','text':'ok','timestamp':8,'asr_confidence':.6}, {'role':'customer','text':'','timestamp':7}, {'text':'test'}])
    quality_kinds={f['kind'] for f in quality}
    for k in ('low_asr_confidence','out_of_order_timestamp','empty_text','missing_role'):
        if k not in quality_kinds:fail.append({'case':'quality '+k})
    return {'passed':len(fixtures)+4-len(fail),'total':len(fixtures)+4,'failures':fail,'fixtures':len(fixtures)}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('dataset',nargs='?');p.add_argument('--self-test',action='store_true');p.add_argument('--output');args=p.parse_args()
    result=self_test() if args.self_test or not args.dataset else summarize_dataset(args.dataset)
    txt=json.dumps(result,ensure_ascii=False,indent=2)
    if args.output:Path(args.output).write_text(txt,encoding='utf-8')
    print(txt)
    if args.self_test and result['failures']:raise SystemExit(1)
