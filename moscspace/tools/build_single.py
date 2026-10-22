"""Собирает весь сайт MoscSpace в один файл index.html.

Все страницы попадают в <template data-page>, стили, скрипты, Leaflet и картинки
встраиваются внутрь. Переходы между страницами работают через хеш (#/offers),
этим занимается assets/app.js.

Запуск: python3 tools/build_single.py путь/к/index.html
"""
import base64
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent
ASSETS = SITE / "assets"
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "moscspace-single.html")


def read(p):
    return p.read_text(encoding="utf-8")


def to_hash(m):
    page, query, anchor = m.group(1), m.group(2) or "", m.group(3) or ""
    return 'href="#/' + page + ("/" + anchor if anchor else "") + query + '"'


def rewrite_links(html):
    return re.sub(r'href="([a-z-]+)\.html(\?[^"#]*)?(?:#([^"]*))?"', to_hash, html)


def inline_images(css):
    def repl(m):
        data = base64.b64encode((ASSETS / m.group(1)).read_bytes()).decode()
        return 'url("data:image/jpeg;base64,' + data + '")'
    return re.sub(r'url\("([\w-]+\.jpg)"\)', repl, css)


def script(js):
    return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"


pages = sorted(SITE.glob("*.html"))
index = read(SITE / "index.html")
header = re.search(r"<header class=\"site-header\">.*?</header>", index, re.S).group(0)
footer = re.search(r"<footer class=\"site-footer\">.*?</footer>", index, re.S).group(0)
favicon = re.search(r'<link rel="icon"[^>]*>', index).group(0)

templates = []
for p in pages:
    html = read(p)
    title = re.search(r"<title>(.*?)</title>", html).group(1)
    body = re.search(r"<main>(.*?)</main>", html, re.S).group(1)
    templates.append(f'<template data-page="{p.stem}" data-title="{title}">{rewrite_links(body)}</template>')

css = read(ASSETS / "vendor/leaflet/leaflet.css") + "\n" + inline_images(read(ASSETS / "style.css"))

doc = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Аренда помещений в Москве — MoscSpace</title>
<meta name="description" content="Аренда офисов, складов, торговых помещений и залов для встреч в Москве — MoscSpace">
{favicon}
<style>
{css}
</style>
</head>
<body>
{rewrite_links(header)}
<main></main>
{rewrite_links(footer)}
{chr(10).join(templates)}
{script(read(ASSETS / "vendor/leaflet/leaflet.js"))}
{script(read(ASSETS / "app.js"))}
</body>
</html>
"""
out.write_text(doc, encoding="utf-8")
print(f"{out}: {len(pages)} страниц, {out.stat().st_size / 1024 / 1024:.1f} МБ")
