import os, json, uuid, mimetypes, time
import urllib.request, urllib.error
from datetime import datetime

from django.http import FileResponse, JsonResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

import database as db
from rag_engine import rag
import generate_market

BASE     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODE_DIR = os.path.join(BASE, 'code')
APP_DIR  = os.path.join(BASE, 'app')
MKT_DIR  = os.path.join(BASE, 'market')


# ── Helpers ────────────────────────────────────────────────────────────────────
def _file(path, ct='text/html; charset=utf-8'):
    if not os.path.isfile(path):
        raise Http404(f'File not found: {os.path.basename(path)}')
    return FileResponse(open(path, 'rb'), content_type=ct)

def _page(folder):
    return _file(os.path.join(CODE_DIR, folder, 'index.html'))

def _sort(products, sort):
    if sort == 'price_asc':  products.sort(key=lambda p: p['price'])
    elif sort == 'price_desc': products.sort(key=lambda p: p['price'], reverse=True)
    elif sort == 'rating':   products.sort(key=lambda p: p['rating'], reverse=True)
    elif sort == 'popular':  products.sort(key=lambda p: p['downloads'], reverse=True)
    elif sort == 'newest':   products.sort(key=lambda p: p.get('created_at',''), reverse=True)


# ── Page views ─────────────────────────────────────────────────────────────────
def home(request):           return _page('home')
def login_page(request):     return _page('login')
def vitrin(request):         return _page('vitrin')
def search_page(request):    return _page('search')
def member(request):         return _page('member')
def profile(request):        return _page('profile')
def sell(request):           return _page('sell')
def compare(request):        return _page('compare')
def product_page(request, mid):  return _page('product')
def payment_page(request, mid):  return _page('payment')


# ── Asset serving ──────────────────────────────────────────────────────────────
def serve_code(request, fp):
    full = os.path.join(CODE_DIR, fp)
    ct, _ = mimetypes.guess_type(full)
    return _file(full, ct or 'application/octet-stream')

def market_page(request, mid):
    return _file(os.path.join(MKT_DIR, mid, 'index.html'))

def market_file(request, mid, fname):
    full = os.path.join(MKT_DIR, mid, fname)
    ct, _ = mimetypes.guess_type(full)
    return _file(full, ct or 'application/octet-stream')

def pwa_manifest(request):
    return _file(os.path.join(APP_DIR, 'manifest.json'), 'application/json')

def pwa_sw(request):
    return _file(os.path.join(APP_DIR, 'sw.js'), 'application/javascript')


# ── API ─────────────────────────────────────────────────────────────────────────
@require_GET
def api_search(request):
    q    = request.GET.get('q', '').strip()
    cat  = request.GET.get('category', 'all')
    sort = request.GET.get('sort', 'default')
    minp = request.GET.get('min_price', None)
    maxp = request.GET.get('max_price', None)
    minr = request.GET.get('min_rating', None)
    prods = db.search_products(
        q, cat,
        float(minp) if minp else None,
        float(maxp) if maxp else None,
        float(minr) if minr else None,
    )
    _sort(prods, sort)
    return JsonResponse({'results': prods, 'total': len(prods)})


@require_GET
def api_suggest(request):
    q = request.GET.get('q', '').lower().strip()
    if len(q) < 2:
        return JsonResponse({'suggestions': []})
    sugg, seen = [], set()
    for p in db.get_all_products():
        if q in p['name'].lower() and p['name'] not in seen:
            sugg.append({'text': p['name'], 'type': 'model', 'id': p['market_id']}); seen.add(p['name'])
        for tag in p.get('tags', []):
            if q in tag.lower() and tag not in seen:
                sugg.append({'text': tag, 'type': 'tag', 'id': None}); seen.add(tag)
        cat = p.get('category', '')
        if q in cat.lower() and cat not in seen:
            sugg.append({'text': cat, 'type': 'category', 'id': None}); seen.add(cat)
    return JsonResponse({'suggestions': sugg[:8]})


@require_GET
def api_product(request, mid):
    p = db.get_product(mid)
    if not p:
        return JsonResponse({'error': 'Not found'}, status=404)
    all_p   = db.get_all_products()
    related = [x for x in all_p if x['category'] == p['category'] and x['market_id'] != mid][:4]
    reviews = db.get_reviews(mid)
    return JsonResponse({'product': p, 'related': related, 'reviews': reviews})


@csrf_exempt
def api_rag(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    q = data.get('question', '').strip()
    if not q:
        return JsonResponse({'error': 'No question'}, status=400)
    return JsonResponse(rag.ask(q))


@csrf_exempt
def api_sell(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    mid  = 'MID-' + str(uuid.uuid4())[:6].upper()
    tags = [t.strip() for t in data.get('tags', '').split(',') if t.strip()]
    prod = {
        'market_id':         mid,
        'name':              data.get('name', ''),
        'short_description': data.get('short_description', ''),
        'description':       data.get('description', ''),
        'category':          data.get('category', 'Custom'),
        'price':             float(data.get('price', 0)),
        'currency':          'USD',
        'billing':           data.get('billing', 'monthly'),
        'seller':            data.get('seller_name', 'Anonymous'),
        'seller_avatar':     (data.get('seller_name', 'A') or 'A')[:2].upper(),
        'seller_verified':   False, 'rating': 0, 'review_count': 0, 'downloads': 0,
        'parameters':        data.get('parameters', 'N/A'),
        'accuracy':          data.get('accuracy', 'N/A'),
        'api_calls_per_month': int(data.get('api_calls', 10000)),
        'response_time':     data.get('response_time', 'N/A'),
        'tags':              tags,
        'license':           data.get('license', 'Commercial'),
        'featured':          False,
        'gradient':          'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
        'created_at':        datetime.now().isoformat(),
        'specs': {
            'framework':   data.get('framework', 'N/A'),
            'input':       data.get('input_format', 'N/A'),
            'output':      data.get('output_format', 'N/A'),
            'gpu_required': bool(data.get('gpu_required')),
            'api_available': True,
        },
        'source': 'manual',
    }
    db.insert_product(prod)
    rag.rebuild()
    p = db.get_product(mid)
    if p:
        generate_market.generate_product_page_to_disk(p)
    return JsonResponse({'success': True, 'market_id': mid})


@csrf_exempt
def api_review(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    mid = data.get('product_id')
    if not mid or not db.get_product(mid):
        return JsonResponse({'error': 'Not found'}, status=404)
    db.add_review(mid, data.get('author', 'Anonymous'), data.get('rating', 5), data.get('text', ''))
    return JsonResponse({'success': True})


@csrf_exempt
def api_payment(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    txn = 'SXW-' + str(uuid.uuid4())[:8].upper()
    return JsonResponse({'success': True, 'transaction_id': txn})


@require_GET
def api_stats(request):
    return JsonResponse(db.get_stats())


# ── AI Composer — combine products into bundles ────────────────────────────────
@csrf_exempt
def api_compose(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    data = json.loads(request.body or '{}')
    goal = data.get('goal', '').strip()
    if not goal:
        return JsonResponse({'error': 'goal required'}, status=400)

    # Find relevant products via RAG
    products = rag.retrieve(goal, top_k=5)
    if not products:
        products = db.get_all_products()[:5]

    product_lines = '\n'.join(
        f"- {p['name']} [{p['market_id']}]: {p.get('short_description','')}"
        for p in products
    )
    prompt = (
        f'You are an AI product architect on a universe marketplace.\n'
        f'User goal: "{goal}"\n\nAvailable products:\n{product_lines}\n\n'
        f'Create a bundle combining these products. '
        f'Reply with ONLY valid JSON (no markdown), this exact schema:\n'
        f'{{"bundle_name":"Creative bundle name","tagline":"One-line value prop",'
        f'"description":"2-3 sentences","connections":['
        f'{{"from":"MID-XXXX","to":"MID-XXXX","label":"feeds into"}}],'
        f'"capabilities":["cap1","cap2","cap3"],'
        f'"use_cases":["uc1","uc2"],"architecture":"how they integrate"}}'
    )

    raw = rag._call_ollama(prompt)
    try:
        s = raw.find('{'); e = raw.rfind('}') + 1
        synthesis = json.loads(raw[s:e]) if s >= 0 and e > s else None
        assert synthesis and 'bundle_name' in synthesis
    except Exception:
        names = [p['name'] for p in products[:3]]
        synthesis = {
            'bundle_name':  ' + '.join(n.split()[0] for n in names[:2]) + ' System',
            'tagline':      f'Integrated AI solution for: {goal[:60]}',
            'description':  f'This bundle combines {", ".join(names)} into a powerful pipeline for {goal}.',
            'connections':  [{'from': products[i]['market_id'], 'to': products[i+1]['market_id'],
                              'label': 'feeds data to'} for i in range(min(3, len(products)-1))],
            'capabilities': [f'{p["category"]} pipeline' for p in products[:3]],
            'use_cases':    [f'Enterprise {goal[:30]}', f'Research-grade {goal[:30]}'],
            'architecture': f'Sequential {len(products)}-model pipeline',
        }

    total     = sum(float(p.get('price', 0)) for p in products)
    bundle_px = round(total * 0.80)  # 20% bundle discount
    rent_px   = round(bundle_px * 0.08, 2)  # weekly rent ≈ 8% of monthly

    return JsonResponse({
        'goal': goal,
        'products': products,
        'synthesis': synthesis,
        'pricing': {
            'individual_total': total,
            'bundle_price': bundle_px,
            'savings': round(total - bundle_px),
            'rent_7d_price': rent_px,
            'currency': 'USD',
        }
    })


# ── API Dashboard page ─────────────────────────────────────────────────────────
def api_dashboard(request):
    return _page('api')

def compose(request):
    return _page('compose')


# ══════════════════════════════════════════════════════════════════════════════
#  REST API v1 — AI Model Inference with API Keys
# ══════════════════════════════════════════════════════════════════════════════

# Ollama model mapping by product category
OLLAMA_CAT_MAP = {
    'Language Model':      'llama3.2',
    'Code Generation':     'codellama',
    'Data Analysis':       'llama3.2',
    'Healthcare AI':       'llama3.2',
    'Financial AI':        'llama3.2',
    'Cybersecurity':       'llama3.2',
    'Human Services':      'llama3.2',
    'default':             'llama3.2',
}

# Products that map to specific Ollama models
PRODUCT_OLLAMA_MAP = {
    'MID-0006': 'llama3.2',    # LangMaster GPT 70B
    'MID-0011': 'llama3.2',    # TranslateX
    'MID-0002': 'codellama',   # CodeGen Ultra
}

RENT_PRICING = {
    '24h': {'calls': 100,    'price': 4.99,  'label': '24-Hour Trial'},
    '7d':  {'calls': 1000,   'price': 14.99, 'label': '7-Day Access'},
    '30d': {'calls': 10000,  'price': 39.99, 'label': '30-Day Full Access'},
}


def _get_bearer(request):
    auth = request.headers.get('Authorization', '')
    return auth[7:] if auth.startswith('Bearer ') else None


def _ollama_infer(product, prompt: str, system_override: str = None):
    """Call local Ollama and return {text, latency_ms, model, source}."""
    cat   = product.get('category', 'default')
    model = PRODUCT_OLLAMA_MAP.get(product['market_id'], OLLAMA_CAT_MAP.get(cat, 'llama3.2'))

    system = system_override or (
        f"You are {product['name']}, a specialized AI model for {cat}. "
        f"You have {product.get('parameters','N/A')} parameters and "
        f"{product.get('accuracy','N/A')} accuracy. "
        f"Respond helpfully and concisely. Max 300 words."
    )

    payload = json.dumps({
        'model':   model,
        'prompt':  prompt,
        'system':  system,
        'stream':  False,
        'options': {'temperature': 0.7, 'num_predict': 400}
    }).encode()

    t0 = time.time()
    try:
        req = urllib.request.Request(
            'http://localhost:11434/api/generate',
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return {
                'text':       result.get('response', '').strip(),
                'latency_ms': int((time.time() - t0) * 1000),
                'model':      model,
                'source':     'ollama',
            }
    except Exception as e:
        return {
            'text':       f'[Ollama unavailable] Install Ollama and run: ollama pull {model}\n\nMock response for: {prompt[:100]}',
            'latency_ms': 50,
            'model':      model,
            'source':     'mock',
        }


@require_GET
def api_v1_models(request):
    """GET /api/v1/models — list all models with API info."""
    prods = db.get_all_products()
    return JsonResponse({
        'models': [{
            'market_id':   p['market_id'],
            'name':        p['name'],
            'category':    p['category'],
            'accuracy':    p['accuracy'],
            'parameters':  p['parameters'],
            'response_time': p['response_time'],
            'price_monthly': p['price'],
            'rent_options': {k: v for k, v in RENT_PRICING.items()},
            'endpoint':    f'/api/v1/infer/{p["market_id"]}',
            'ollama_model': PRODUCT_OLLAMA_MAP.get(p['market_id'],
                           OLLAMA_CAT_MAP.get(p['category'], 'llama3.2')),
        } for p in prods],
        'total': len(prods),
        'base_url': 'http://localhost:5000',
        'auth': 'Bearer <swm_live_...>',
    })


@require_GET
def api_v1_model_info(request, mid):
    """GET /api/v1/models/<mid> — single model details."""
    p = db.get_product(mid)
    if not p:
        return JsonResponse({'error': 'Model not found'}, status=404)
    ollama_model = PRODUCT_OLLAMA_MAP.get(mid, OLLAMA_CAT_MAP.get(p['category'], 'llama3.2'))
    return JsonResponse({
        'market_id':  mid,
        'name':       p['name'],
        'category':   p['category'],
        'description': p.get('description',''),
        'specs':      p.get('specs', {}),
        'accuracy':   p['accuracy'],
        'parameters': p['parameters'],
        'response_time': p['response_time'],
        'price_monthly': p['price'],
        'license':    p['license'],
        'seller':     p['seller'],
        'ollama_model': ollama_model,
        'rent_options': RENT_PRICING,
        'endpoint':   f'/api/v1/infer/{mid}',
        'code_examples': {
            'curl': f'curl -X POST http://localhost:5000/api/v1/infer/{mid} \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"input": "Your prompt here"}\'',
            'python': f'import requests\n\nresponse = requests.post(\n    "http://localhost:5000/api/v1/infer/{mid}",\n    headers={{"Authorization": "Bearer YOUR_KEY"}},\n    json={{"input": "Your prompt here"}}\n)\nprint(response.json())',
            'javascript': f'const res = await fetch("http://localhost:5000/api/v1/infer/{mid}", {{\n  method: "POST",\n  headers: {{\n    "Authorization": "Bearer YOUR_KEY",\n    "Content-Type": "application/json"\n  }},\n  body: JSON.stringify({{input: "Your prompt here"}})\n}});\nconst data = await res.json();\nconsole.log(data);',
        }
    })


@csrf_exempt
def api_v1_rent(request, mid):
    """POST /api/v1/rent/<mid> — create a time-limited API key."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    p = db.get_product(mid)
    if not p:
        return JsonResponse({'error': 'Model not found'}, status=404)

    data = json.loads(request.body or '{}')
    user_email  = data.get('email', 'anonymous@swm.demo')
    rent_period = data.get('period', '24h')  # '24h' | '7d' | '30d'

    if rent_period not in RENT_PRICING:
        return JsonResponse({'error': f'Invalid period. Choose: {list(RENT_PRICING)}'}, status=400)

    key_id = db.create_api_key(mid, user_email, 'rent', rent_period)
    cfg    = RENT_PRICING[rent_period]
    ollama = PRODUCT_OLLAMA_MAP.get(mid, OLLAMA_CAT_MAP.get(p['category'], 'llama3.2'))

    return JsonResponse({
        'success':    True,
        'api_key':    key_id,
        'access_type': 'rent',
        'model':      mid,
        'model_name': p['name'],
        'period':     rent_period,
        'period_label': cfg['label'],
        'calls_included': cfg['calls'],
        'price':      cfg['price'],
        'endpoint':   f'/api/v1/infer/{mid}',
        'ollama_model': ollama,
        'code_examples': {
            'python': f'import requests\n\nAPI_KEY = "{key_id}"\nresponse = requests.post(\n    "http://localhost:5000/api/v1/infer/{mid}",\n    headers={{"Authorization": f"Bearer {{API_KEY}}"}},\n    json={{"input": "Your prompt here"}}\n)\nprint(response.json())',
            'curl': f'curl -X POST http://localhost:5000/api/v1/infer/{mid} \\\n  -H "Authorization: Bearer {key_id}" \\\n  -H "Content-Type: application/json" \\\n  -d \'{{"input": "Your prompt here"}}\'',
            'javascript': f'const res = await fetch("http://localhost:5000/api/v1/infer/{mid}", {{\n  method: "POST",\n  headers: {{"Authorization": "Bearer {key_id}", "Content-Type": "application/json"}},\n  body: JSON.stringify({{input: "Your prompt"}})\n}});\nconst data = await res.json();',
        }
    })


@csrf_exempt
def api_v1_purchase(request, mid):
    """POST /api/v1/purchase/<mid> — create unlimited key + weights download info."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    p = db.get_product(mid)
    if not p:
        return JsonResponse({'error': 'Model not found'}, status=404)

    data       = json.loads(request.body or '{}')
    user_email = data.get('email', 'anonymous@swm.demo')
    key_id     = db.create_api_key(mid, user_email, 'purchase')
    ollama     = PRODUCT_OLLAMA_MAP.get(mid, OLLAMA_CAT_MAP.get(p['category'], 'llama3.2'))

    return JsonResponse({
        'success':     True,
        'api_key':     key_id,
        'access_type': 'purchase',
        'model':       mid,
        'model_name':  p['name'],
        'calls_limit': 'unlimited',
        'endpoint':    f'/api/v1/infer/{mid}',
        'ollama_model': ollama,
        'weights_download': {
            'method':  'ollama',
            'command': f'ollama pull {ollama}',
            'docs':    'https://ollama.com/library/' + ollama,
            'note':    f'Full model weights for {p["name"]} via Ollama. Run the command above to download locally.',
        },
        'license':  p.get('license', 'Commercial'),
        'code_examples': {
            'python': f'import requests\n\nAPI_KEY = "{key_id}"\nresponse = requests.post(\n    "http://localhost:5000/api/v1/infer/{mid}",\n    headers={{"Authorization": f"Bearer {{API_KEY}}"}},\n    json={{"input": "Your prompt here"}}\n)\nprint(response.json())',
            'curl':   f'curl -X POST http://localhost:5000/api/v1/infer/{mid} \\\n  -H "Authorization: Bearer {key_id}" \\\n  -H "Content-Type: application/json" \\\n  -d \'{{"input": "Your prompt"}}\'',
            'local':  f'# Run locally with Ollama (after purchase)\nollama pull {ollama}\nollama run {ollama} "Your prompt here"',
        }
    })


@csrf_exempt
def api_v1_infer(request, mid):
    """POST /api/v1/infer/<mid> — real AI inference via Ollama."""
    if request.method != 'POST':
        return JsonResponse({
            'error': 'POST only',
            'usage': {
                'method': 'POST',
                'url': f'/api/v1/infer/{mid}',
                'headers': {'Authorization': 'Bearer YOUR_KEY', 'Content-Type': 'application/json'},
                'body': {'input': 'your prompt here', 'system': '(optional) system prompt'},
            }
        }, status=405)

    # Validate API key
    key_id = _get_bearer(request)
    if not key_id:
        return JsonResponse({
            'error': 'API key required',
            'code':  'UNAUTHORIZED',
            'hint':  'Add header: Authorization: Bearer swm_live_...',
            'get_key': f'/api/v1/rent/{mid}',
        }, status=401)

    key_rec = db.validate_api_key(key_id, mid)
    if not key_rec:
        return JsonResponse({
            'error': 'Invalid, expired, or exhausted API key',
            'code':  'INVALID_KEY',
            'renew': f'/api/v1/rent/{mid}',
        }, status=401)

    p = db.get_product(mid)
    if not p:
        return JsonResponse({'error': 'Model not found'}, status=404)

    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    prompt = body.get('input', body.get('prompt', '')).strip()
    if not prompt:
        return JsonResponse({'error': 'Field "input" is required'}, status=400)

    system_override = body.get('system', None)

    # Run Ollama inference
    result = _ollama_infer(p, prompt, system_override)

    # Track usage
    db.increment_key_usage(key_id)
    output_tokens = len(result['text'].split())
    db.log_api_call(key_id, mid, prompt[:200], output_tokens, result['latency_ms'], result['model'])

    calls_remaining = -1
    if key_rec['calls_limit'] >= 0:
        calls_remaining = key_rec['calls_limit'] - key_rec['calls_used'] - 1

    return JsonResponse({
        'model_id':     mid,
        'model_name':   p['name'],
        'input':        prompt,
        'output':       result['text'],
        'meta': {
            'latency_ms':       result['latency_ms'],
            'output_tokens':    output_tokens,
            'ollama_model':     result['model'],
            'inference_source': result['source'],
            'model_accuracy':   p['accuracy'],
            'model_parameters': p['parameters'],
        },
        'api_key': {
            'calls_used':      key_rec['calls_used'] + 1,
            'calls_limit':     key_rec['calls_limit'],
            'calls_remaining': calls_remaining,
            'expires_at':      key_rec['expires_at'],
            'access_type':     key_rec['access_type'],
        }
    })


@require_GET
def api_v1_key_status(request, key_id):
    """GET /api/v1/keys/<key_id> — check key status and usage."""
    data = db.get_key_usage(key_id)
    if not data['key']:
        return JsonResponse({'error': 'Key not found'}, status=404)
    return JsonResponse({
        'key_id':      key_id,
        'product_id':  data['key']['product_id'],
        'access_type': data['key']['access_type'],
        'calls_used':  data['key']['calls_used'],
        'calls_limit': data['key']['calls_limit'],
        'is_active':   bool(data['key']['is_active']),
        'created_at':  data['key']['created_at'],
        'expires_at':  data['key']['expires_at'],
        'recent_calls': data['recent_calls'][:10],
    })


# ── Product image (on-the-fly SVG) ────────────────────────────────────────────
def product_image(request, mid):
    """Serve a dynamically generated SVG image for a product."""
    from django.http import HttpResponse
    p = db.get_product(mid)
    if not p:
        raise Http404
    svg = generate_market.make_product_svg(p)
    resp = HttpResponse(svg, content_type='image/svg+xml')
    resp['Cache-Control'] = 'public, max-age=3600'
    return resp


# ── User auth ──────────────────────────────────────────────────────────────────
@csrf_exempt
def api_register(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    name     = data.get('name', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    acc_type = data.get('account_type', 'buyer')

    if not name or not email or not password:
        return JsonResponse({'error': 'Name, email and password are required'}, status=400)
    if len(password) < 6:
        return JsonResponse({'error': 'Password must be at least 6 characters'}, status=400)
    if '@' not in email:
        return JsonResponse({'error': 'Invalid email address'}, status=400)

    user = db.create_user(name, email, password, acc_type)
    if user is None:
        return JsonResponse({'error': 'That email is already registered'}, status=409)
    return JsonResponse({'success': True, 'user': user})


@csrf_exempt
def api_login_user(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return JsonResponse({'error': 'Email and password required'}, status=400)

    user = db.login_user(email, password)
    if user is None:
        return JsonResponse({'error': 'Incorrect email or password'}, status=401)
    return JsonResponse({'success': True, 'user': user})
