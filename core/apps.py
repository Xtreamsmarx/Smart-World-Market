import os
import json
from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'
    verbose_name = 'Smart World Market'

    def ready(self):
        # Guard against double-import in Django's dev reloader
        if os.environ.get('RUN_MAIN') != 'true':
            return
        self._bootstrap()

    @staticmethod
    def _bootstrap():
        import database as db
        from rag_engine import rag
        import generate_market

        db.init_db()
        if not db.get_all_products():
            CoreConfig._seed(db)

        rag.build_index()
        generate_market.generate_all(skip_existing=True)  # fast: skip already-built pages

        print('\n' + '='*54)
        print('  ⚡  Smart World Market  Universe Marketplace  (Django)')
        print('  http://localhost:5000')
        print('='*54 + '\n')

    @staticmethod
    def _seed(db):
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(base, 'data', 'inventory.json')
        if not os.path.exists(path):
            return
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for i, prod in enumerate(data.get('products', []), 1):
            old = prod.get('id', f'mdl-{i:03d}')
            prod['market_id'] = 'MID-' + old.replace('mdl-', '').zfill(4)
            db.insert_product(prod)
        print(f'[Seed] {len(data["products"])} products loaded.')
