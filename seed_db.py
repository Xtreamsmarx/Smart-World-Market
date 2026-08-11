"""Migrate data/inventory.json → SQLite.  Run once: python seed_db.py"""
import json, os
from database import init_db, insert_product, get_all_products

JSON = os.path.join(os.path.dirname(__file__), 'data', 'inventory.json')

def seed():
    init_db()
    if get_all_products():
        print('[Seed] Database already has data — skipping.')
        return
    if not os.path.exists(JSON):
        print(f'[Seed] {JSON} not found.')
        return
    with open(JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for i, p in enumerate(data.get('products', []), 1):
        old_id = p.get('id', f'mdl-{i:03d}')
        num    = old_id.replace('mdl-', '').zfill(4)
        p['market_id'] = f'MID-{num}'
        insert_product(p)
        print(f'[Seed] {p["name"]:30s}  →  {p["market_id"]}')
    print(f'\n[Seed] Done. {len(data["products"])} products seeded.')

if __name__ == '__main__':
    seed()
