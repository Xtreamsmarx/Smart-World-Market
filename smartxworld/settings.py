import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = 'swm-dev-secret-key-2026-change-in-production'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = ['core.apps.CoreConfig']

ROOT_URLCONF = 'smartxworld.urls'
WSGI_APPLICATION = 'smartxworld.wsgi.application'

# No Django ORM — we use our own SQLite via database.py
DATABASES = {}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
