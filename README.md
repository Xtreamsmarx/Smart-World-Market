# Smart World Market

This repository contains:
- Static frontend site in `code/` (deployed to GitHub Pages)
- Python backend (Django/Flask style APIs) for local/server deployment

## Publish to GitHub and run on GitHub Pages

1. Create a new GitHub repository.
2. In this project folder, run:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

3. In GitHub, open: Settings -> Pages.
4. Under "Build and deployment", choose "GitHub Actions".
5. The included workflow `.github/workflows/deploy-pages.yml` will deploy automatically on every push to `main`.

## Important note

GitHub Pages can only host static files. The Python API routes are not executed on Pages.
The static frontend is deployed from `code/`.

If you want all dynamic API features online, deploy the backend separately (for example on Render, Railway, Azure, or a VPS) and point frontend API calls to that backend URL.
