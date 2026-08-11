"""
RAG engine — TF-IDF retrieval + Ollama LLM (local, no API key needed).
Install Ollama from https://ollama.com then run: ollama pull llama3.2
"""
import re, math, json
import urllib.request, urllib.error
from database import get_all_products


class RAGEngine:
    OLLAMA_URL = 'http://localhost:11434/api/generate'
    LLM_MODEL  = 'llama3.2'  # small fast local model; change to 'mistral' if preferred

    def __init__(self):
        self._products = []
        self._vocab    = {}
        self._doc_vecs = []
        self._built    = False

    # ── Index ─────────────────────────────────────────────────────
    def _tok(self, text):
        return re.findall(r'[a-z0-9]+', text.lower())

    def _corpus(self, p):
        return ' '.join([
            (p.get('name','') + ' ') * 4,
            (p.get('category','') + ' ') * 3,
            (' '.join(p.get('tags',[])) + ' ') * 3,
            p.get('short_description',''),
            p.get('description',''),
            p.get('seller',''),
        ])

    def build_index(self):
        self._products = get_all_products()
        if not self._products:
            self._built = True
            return
        corpus = [self._tok(self._corpus(p)) for p in self._products]

        self._vocab = {}
        for doc in corpus:
            for w in doc:
                if w not in self._vocab:
                    self._vocab[w] = len(self._vocab)

        N  = len(corpus)
        df = {}
        for doc in corpus:
            for w in set(doc):
                df[w] = df.get(w, 0) + 1

        self._doc_vecs = []
        for doc in corpus:
            tf = {}
            for w in doc:
                tf[w] = tf.get(w, 0) + 1
            total = len(doc) or 1
            vec   = {}
            for w, cnt in tf.items():
                idf = math.log((N + 1) / (df.get(w, 0) + 1))
                vec[self._vocab[w]] = (cnt / total) * idf
            self._doc_vecs.append(vec)
        self._built = True

    def rebuild(self):
        self._built = False
        self.build_index()

    # ── Retrieval ─────────────────────────────────────────────────
    def retrieve(self, query, top_k=5):
        if not self._built:
            self.build_index()
        if not self._doc_vecs:
            return self._products[:top_k]
        qv = {}
        for w in self._tok(query):
            if w in self._vocab:
                qv[self._vocab[w]] = qv.get(self._vocab[w], 0) + 1

        def cosine(v1, v2):
            dot = sum(v1.get(k, 0) * v2.get(k, 0) for k in v1)
            n1  = math.sqrt(sum(x*x for x in v1.values()))
            n2  = math.sqrt(sum(x*x for x in v2.values()))
            return dot / (n1 * n2) if n1 and n2 else 0.0

        scored = [(cosine(qv, dv), i) for i, dv in enumerate(self._doc_vecs)]
        scored.sort(reverse=True)
        return [self._products[i] for s, i in scored[:top_k] if s > 0]

    # ── LLM ───────────────────────────────────────────────────────
    def ask(self, question, top_k=4):
        context_products = self.retrieve(question, top_k=top_k)
        context = '\n\n'.join(
            f"• {p['name']}  [{p['market_id']}]\n"
            f"  Category: {p['category']}  |  Price: ${p['price']}/mo\n"
            f"  {p.get('short_description','')}\n"
            f"  Accuracy: {p.get('accuracy','N/A')}  |  Params: {p.get('parameters','N/A')}"
            for p in context_products
        ) or 'No relevant models found in inventory.'

        prompt = (
            "You are the AI assistant of SmartXWorld — the world's first AI model marketplace.\n"
            "Help users find and understand AI models. Be enthusiastic, helpful, and concise.\n\n"
            f"INVENTORY CONTEXT:\n{context}\n\n"
            f"USER QUESTION: {question}\n\n"
            "Answer in 2-3 sentences. Mention model names and Market IDs (like MID-0001) when relevant."
        )

        answer = self._call_ollama(prompt)
        return {'answer': answer, 'products': context_products,
                'ollama_active': self._ping_ollama()}

    def _ping_ollama(self):
        try:
            urllib.request.urlopen('http://localhost:11434', timeout=1)
            return True
        except Exception:
            return False

    def _call_ollama(self, prompt):
        payload = json.dumps({
            'model': self.LLM_MODEL, 'prompt': prompt,
            'stream': False, 'options': {'temperature': 0.7, 'num_predict': 220}
        }).encode()
        try:
            req = urllib.request.Request(
                self.OLLAMA_URL, data=payload,
                headers={'Content-Type': 'application/json'}, method='POST'
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.loads(resp.read()).get('response', '').strip()
        except Exception:
            return self._fallback(prompt)

    def _fallback(self, prompt):
        q = prompt.split('USER QUESTION:')[-1].strip()
        products = self.retrieve(q, top_k=3)
        if not products:
            return ("No models matched your query. Try browsing the Vitrin gallery "
                    "or use different keywords.")
        names = ', '.join(f"{p['name']} ({p['market_id']})" for p in products)
        return (f"Based on your query, I found: {names}. "
                "These are the best matches in our inventory. "
                "Click any model to view full specifications and purchase access. "
                "(Tip: Install Ollama locally for smarter AI answers!)")


# Module-level singleton used by app.py
rag = RAGEngine()
