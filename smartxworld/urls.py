from django.urls import path
from core import views

urlpatterns = [
    # ── Pages ────────────────────────────────────────────────────
    path('',                  views.home),
    path('login',             views.login_page),
    path('vitrin',            views.vitrin),
    path('search-page',       views.search_page),
    path('member',            views.member),
    path('profile',           views.profile),
    path('sell',              views.sell),
    path('compare',           views.compare),
    path('product/<str:mid>', views.product_page),
    path('payment/<str:mid>', views.payment_page),

    # ── Assets ───────────────────────────────────────────────────
    path('code/<path:fp>',              views.serve_code),
    path('market/<str:mid>/',           views.market_page),
    path('market/<str:mid>/<str:fname>',views.market_file),
    path('manifest.json',               views.pwa_manifest),
    path('sw.js',                       views.pwa_sw),

    # ── API ──────────────────────────────────────────────────────
    path('api/search',              views.api_search),
    path('api/suggest',             views.api_suggest),
    path('api/product/<str:mid>',   views.api_product),
    path('api/rag',                 views.api_rag),
    path('api/sell',                views.api_sell),
    path('api/review',              views.api_review),
    path('api/payment',             views.api_payment),
    path('api/stats',               views.api_stats),
    path('api/register',            views.api_register),
    path('api/login-user',          views.api_login_user),

    # ── REST API v1 ──────────────────────────────────────────────
    path('api/v1/models',                views.api_v1_models),
    path('api/v1/models/<str:mid>',      views.api_v1_model_info),
    path('api/v1/rent/<str:mid>',        views.api_v1_rent),
    path('api/v1/purchase/<str:mid>',    views.api_v1_purchase),
    path('api/v1/infer/<str:mid>',       views.api_v1_infer),
    path('api/v1/keys/<str:key_id>',     views.api_v1_key_status),

    # ── Product image ────────────────────────────────────────────
    path('product/<str:mid>/image.svg',  views.product_image),

    # ── API Dashboard page ───────────────────────────────────────
    path('api-dashboard',           views.api_dashboard),
    path('compose',                 views.compose),
    path('api/compose',             views.api_compose),
]
