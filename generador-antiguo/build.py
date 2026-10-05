#!/usr/bin/env python3
"""
Genera la web de Oasis Kafe como un unico HTML autocontenido.

Frente al script original:
  - rutas por CLI (nada de rutas fijas de Windows) y creacion del directorio de salida
  - las plantillas viven en src/*.{html,css,js}: se acabaron las llaves escapadas de las f-strings
  - las imagenes extraidas se USAN de verdad (antes se calculaban y se tiraban)
  - toda extraccion valida antes de indexar: nada de AttributeError/KeyError cripticos
  - escritura atomica y reporte final de que ha entrado y que falta

Uso:
    python3 build.py                       # build normal
    python3 build.py --out dist/oasis.html
    python3 build.py --bundle "ruta/al/oasis-kafe-web-con imagenes.html"
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import gzip
import io
import json
import mimetypes
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

try:
    from PIL import Image, ImageOps
    TIENE_PILLOW = True
except ImportError:
    TIENE_PILLOW = False

RAIZ = Path(__file__).resolve().parent

# --------------------------------------------------------------------------
# Configuracion del negocio. Todo lo editable vive aqui arriba.
# --------------------------------------------------------------------------
SITE = {
    "nombre": "Oasis Kafe",
    "url": "https://oasiskafe.example",          # <- pon aqui el dominio real
    "calle": "Jose Goikoa Kalea, 1",
    "cp": "20018",
    "ciudad": "Donostia / San Sebastián",
    "region": "Gipuzkoa",
    "pais": "ES",
    "telefono_e164": "+34943501867",
    "telefono_txt": "943 50 18 67",
    "whatsapp_e164": "34747478194",
    "whatsapp_txt": "747 478 194",
    "instagram": "https://www.instagram.com/oasiskafe_bentaberri",
    "timezone": "Europe/Madrid",
    # Verificadas por dos vias independientes: ficha de lugar de Google Maps
    # (campos !3d/!4d) y su Plus Code local (8X5V+V9), que coincide.
    "coords": (43.3097313, -2.0065578),
}

HORARIO = [
    {"d": 1, "ranges": [["08:00", "14:30"], ["16:30", "19:00"]]},
    {"d": 2, "ranges": [["08:00", "14:30"], ["16:30", "19:00"]]},
    {"d": 3, "ranges": [["08:00", "14:30"], ["16:30", "19:00"]]},
    {"d": 4, "ranges": [["08:00", "14:30"], ["16:30", "19:00"]]},
    {"d": 5, "ranges": [["08:00", "14:30"], ["16:30", "19:00"]]},
    {"d": 6, "ranges": [["09:00", "13:30"]]},
    {"d": 0, "ranges": [["09:00", "13:30"]]},
]

# Fotos del local. 'pos' es el object-position del recorte: encuadra el motivo
# principal sin tocar el JPEG original.
FOTOS_LOCAL = [
    {"file": "01-vitrina-tartas", "pos": "center 38%",
     "caption": {"es": "La vitrina de tartas", "eu": "Tarten erakusleihoa",
                 "en": "The cake counter", "fr": "La vitrine à gâteaux"}},
    {"file": "02-vitrina-bolleria", "pos": "center 52%",
     "caption": {"es": "Bizcochos y dulces del día", "eu": "Bizkotxoak eta eguneko gozoak",
                 "en": "Loaf cakes and today's bakes", "fr": "Gâteaux et douceurs du jour"}},
    {"file": "03-rincon", "pos": "center 44%",
     "caption": {"es": "El rincón para sentarse", "eu": "Esertzeko txokoa",
                 "en": "The corner to sit in", "fr": "Le coin pour s'asseoir"}},
    {"file": "04-barra", "pos": "center 66%",
     "caption": {"es": "La barra", "eu": "Barra", "en": "The bar", "fr": "Le comptoir"}},
]

# Fotos de producto para la zona de tartas. La clave 'file' debe coincidir con
# el campo "photo" del item en src/data/menu.json.
FOTOS_PRODUCTO = [
    {"file": "bizcocho-vegano", "pos": "center 58%",
     "alt": {"es": "Bizcocho vegano recién horneado junto a su caja Oasis Kafe",
             "eu": "Labetik atera berri den bizkotxo begana, Oasis Kafe kutxarekin",
             "en": "Freshly baked vegan loaf cake next to its Oasis Kafe box",
             "fr": "Gâteau vegan tout juste cuit à côté de sa boîte Oasis Kafe"}},
    {"file": "plancha-cole", "pos": "center 62%",
     "alt": {"es": "Plancha de bizcocho con azúcar glas, formato para colegios",
             "eu": "Bizkotxo plantxa azukre-hautsarekin, ikastetxeetarako formatua",
             "en": "Sheet cake dusted with icing sugar, school format",
             "fr": "Génoise en plaque saupoudrée de sucre glace, format école"}},
    {"file": "tres-leches-completo", "pos": "center",
     "alt": {"es": "Tres Leches completo con merengue tostado y fresas",
             "eu": "Tres Leches osoa, merenge txigortua eta marrubiekin",
             "en": "Full Tres Leches tray with toasted meringue and strawberries",
             "fr": "Tres Leches entier avec meringue toastée et fraises"}},
    {"file": "tres-leches-pequeno", "pos": "45% 40%",
     "alt": {"es": "Tarrina individual de Tres Leches con fresa",
             "eu": "Tres Leches banakako ontzia marrubiarekin",
             "en": "Individual Tres Leches tub with strawberry",
             "fr": "Pot individuel de Tres Leches à la fraise"}},
]

EXT_IMG = (".jpg", ".jpeg", ".png", ".webp", ".avif")
AVISOS: list[str] = []

# Las fotos se muestran en tarjetas de ~310px de ancho (o el lightbox, algo
# mayor). Los originales llegan directos del movil a 1200-1600px de lado: son
# 4-8x mas pixeles de los que se van a pintar nunca. Sin reducirlos, un
# telefono de gama baja puede quedarse sin memoria de composicion con varias
# fotos grandes a la vez en pantalla y pintar la tarjeta en blanco.
FOTO_LADO_MAX = 900
FOTO_CALIDAD = 82


def aviso(msg: str) -> None:
    AVISOS.append(msg)


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def leer(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f"ERROR: falta el fichero de plantilla {path}")
    return path.read_text(encoding="utf-8")


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def svg_data_uri(path: Path) -> str:
    return data_uri(path)


def foto_data_uri(path: Path) -> str:
    """Como data_uri(), pero redimensiona fotos de camara al tamano en que se
    muestran de verdad. El original en assets/ no se toca: esto solo afecta a
    lo que se incrusta en el HTML."""
    if not TIENE_PILLOW:
        aviso(f"Pillow no está instalado: {path.name} se incrusta a tamaño completo (más pesado de lo necesario)")
        return data_uri(path)

    try:
        img = Image.open(path)
        img = ImageOps.exif_transpose(img)  # respeta la orientacion del movil antes de medir
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        lado_largo = max(img.size)
        if lado_largo > FOTO_LADO_MAX:
            factor = FOTO_LADO_MAX / lado_largo
            nuevo = (round(img.width * factor), round(img.height * factor))
            img = img.resize(nuevo, Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=FOTO_CALIDAD, method=6)
        return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:                                  # noqa: BLE001
        aviso(f"no se pudo procesar '{path.name}' con Pillow ({e}), se incrusta el original")
        return data_uri(path)


def buscar_imagen(carpeta: Path, base: str) -> Path | None:
    """Devuelve la primera imagen <base>.<ext> que exista, sea cual sea la extension."""
    for ext in EXT_IMG:
        p = carpeta / (base + ext)
        if p.exists():
            return p
    return None


# --------------------------------------------------------------------------
# Extraccion del bundle antiguo (opcional). Version saneada del script original.
# --------------------------------------------------------------------------
def extraer_bundle(bundle: Path) -> dict[str, str]:
    """Saca los assets del HTML empaquetado. Nunca revienta: avisa y sigue."""
    salida: dict[str, str] = {}
    if not bundle.exists():
        aviso(f"bundle no encontrado, se ignora: {bundle}")
        return salida

    texto = bundle.read_text(encoding="utf-8", errors="replace")

    m_manifest = re.search(r'<script type="__bundler/manifest">(.*?)</script>', texto, re.DOTALL)
    m_template = re.search(r'<script type="__bundler/template">(.*?)</script>', texto, re.DOTALL)
    if not m_manifest and not m_template:
        aviso("el bundle no contiene bloques __bundler/*, se ignora")
        return salida

    # --- SVGs del manifest ---
    if m_manifest:
        try:
            manifest = json.loads(m_manifest.group(1))
        except json.JSONDecodeError as e:
            aviso(f"manifest ilegible ({e}), se ignora")
            manifest = {}
        for uuid, nombre in {
            "20327171-c6ca-4ced-b01a-031e9438ab07": "logo_cup",
            "56a54c1e-d318-492a-813b-3b58be4f395a": "icon_quote",
        }.items():
            entrada = manifest.get(uuid)
            if not isinstance(entrada, dict) or "data" not in entrada:
                aviso(f"asset '{nombre}' ({uuid}) no está en el manifest")
                continue
            try:
                crudo = base64.b64decode(entrada["data"])
                if crudo[:2] == b"\x1f\x8b":          # cabecera gzip
                    crudo = gzip.decompress(crudo)
                salida[nombre] = "data:image/svg+xml;base64," + base64.b64encode(crudo).decode("ascii")
            except Exception as e:                     # noqa: BLE001
                aviso(f"no se pudo decodificar '{nombre}': {e}")

    # --- imagenes incrustadas en el template ---
    if m_template:
        try:
            tmpl = json.loads(m_template.group(1))
        except json.JSONDecodeError as e:
            aviso(f"template ilegible ({e}), se ignoran sus imágenes")
            tmpl = ""
        uris = re.findall(r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+", tmpl if isinstance(tmpl, str) else "")
        nombres = ["donut_artesano", "cookies_vitrina", "cookies_galletas", "bizcocho_kilo",
                   "tarta_zanahoria", "tarta_lotus", "tarta_frutos_rojos", "tarta_chocolate",
                   "tarta_oreo", "tarta_maracuya", "cheesecake"]
        if len(uris) != len(nombres):
            aviso(f"el bundle trae {len(uris)} imágenes y la lista de nombres tiene "
                  f"{len(nombres)}: se emparejan solo las coincidentes, revisa el orden")
        for nombre, uri in zip(nombres, uris):
            salida[nombre] = uri

    return salida


# --------------------------------------------------------------------------
# Fotos
# --------------------------------------------------------------------------
def recoger_fotos(dir_local: Path, dir_prod: Path) -> tuple[dict, list[str], list[str]]:
    encontradas: list[str] = []
    faltan: list[str] = []

    local = []
    for f in FOTOS_LOCAL:
        p = buscar_imagen(dir_local, f["file"])
        if p:
            encontradas.append(str(p.relative_to(RAIZ)))
            local.append({"src": foto_data_uri(p), "pos": f["pos"], "caption": f["caption"], "alt": f["caption"]})
        else:
            faltan.append(f"assets/fotos/{f['file']}.jpg")
            local.append({"src": None, "pos": f["pos"], "caption": f["caption"], "alt": f["caption"],
                          "file": f"{f['file']}.jpg"})

    productos = {}
    for f in FOTOS_PRODUCTO:
        p = buscar_imagen(dir_prod, f["file"])
        if p:
            encontradas.append(str(p.relative_to(RAIZ)))
            productos[f["file"]] = {"src": foto_data_uri(p), "pos": f["pos"], "alt": f["alt"]}
        else:
            faltan.append(f"assets/productos/{f['file']}.jpg")
            productos[f["file"]] = {"src": None, "pos": f["pos"], "alt": f["alt"], "file": f"{f['file']}.jpg"}

    return {"local": local, "productos": productos}, encontradas, faltan


# --------------------------------------------------------------------------
# Mapa
# --------------------------------------------------------------------------
def url_como_llegar() -> str:
    destino = f"{SITE['nombre']}, {SITE['calle']}, {SITE['cp']} {SITE['ciudad'].split(' /')[0]}"
    return "https://www.google.com/maps/dir/?api=1&destination=" + quote(destino)


def bloque_mapa(logo: str, dir_url: str) -> str:
    """Devuelve el HTML del mapa.

    Con coordenadas usa OpenStreetMap: su /export/embed.html es un endpoint
    pensado para incrustar, gratuito y sin clave. El de Google
    (maps?q=...&output=embed) no es oficial y ha dejado de cargar.
    Se omite el parametro &marker= a proposito: asi el mapa no dibuja ningun
    marcador propio y el unico pin es nuestra chapa con el logo, centrada
    exactamente sobre las coordenadas.

    Sin coordenadas no se incrusta ningun iframe (mejor un panel correcto que
    un mapa roto o apuntando a otro sitio).
    """
    coords = SITE.get("coords")
    if not coords:
        aviso("SIN COORDENADAS: el mapa no se incrusta. Rellena SITE['coords'] "
              "(Google Maps → clic derecho sobre el local → copiar coordenadas)")
        # Sin CTA ni direccion completa: ambos ya salen justo debajo en la
        # tarjeta de contacto, repetirlos aqui solo anade ruido.
        barrio = "Antiguo · Benta Berri"
        return f"""<div class="map-frame map-frame--sin-mapa">
            <div class="map-fallback">
              <span class="map-fallback-pin"><img src="{logo}" alt="" width="26" height="26"></span>
              <p class="map-fallback-addr">{barrio}</p>
            </div>
          </div>"""

    lat, lng = coords
    # ~150 m alrededor del punto; la longitud se corrige por la latitud
    import math
    dlat = 150 / 111320
    dlon = 150 / (111320 * math.cos(math.radians(lat)))
    bbox = f"{lng - dlon:.6f},{lat - dlat:.6f},{lng + dlon:.6f},{lat + dlat:.6f}"
    src = f"https://www.openstreetmap.org/export/embed.html?bbox={bbox}&layer=mapnik"

    return f"""<div class="map-frame">
            <iframe class="map-embed" src="{src}" title="{{{{MAP_TITLE}}}}" data-i18n-title="mapAria"
                    loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            <a class="map-pin" href="{dir_url}" target="_blank" rel="noopener">
              <span class="map-pin-badge"><img src="{logo}" alt="" width="30" height="30"></span>
              <span class="map-pin-stem" aria-hidden="true"></span>
              <span class="sr-only">Oasis Kafe — <span data-i18n="ctaMap">Cómo llegar</span></span>
            </a>
          </div>"""


def jsonld(menu: dict) -> str:
    dias = {0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
            4: "Thursday", 5: "Friday", 6: "Saturday"}
    horas = []
    for e in HORARIO:
        for r in e["ranges"]:
            horas.append({
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": dias[e["d"]],
                "opens": r[0], "closes": r[1],
            })
    doc = {
        "@context": "https://schema.org",
        "@type": "CafeOrCoffeeShop",
        "name": SITE["nombre"],
        "url": SITE["url"],
        "telephone": SITE["telefono_e164"],
        "servesCuisine": ["Coffee", "Bakery"],
        "priceRange": "€",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": SITE["calle"],
            "postalCode": SITE["cp"],
            "addressLocality": SITE["ciudad"],
            "addressRegion": SITE["region"],
            "addressCountry": SITE["pais"],
        },
        "sameAs": [SITE["instagram"]],
        "openingHoursSpecification": horas,
    }
    if SITE.get("coords"):
        doc["geo"] = {"@type": "GeoCoordinates",
                      "latitude": SITE["coords"][0], "longitude": SITE["coords"][1]}
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":"))


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------
def build(out: Path, bundle: Path | None) -> None:
    src = RAIZ / "src"
    plantilla = leer(src / "index.html")
    estilos = leer(src / "styles.css")
    app_js = leer(src / "app.js")

    menu = json.loads(leer(src / "data" / "menu.json"))
    i18n = json.loads(leer(src / "data" / "i18n.json"))

    assets_bundle = extraer_bundle(bundle) if bundle else {}

    logo = assets_bundle.get("logo_cup") or svg_data_uri(RAIZ / "assets" / "logo-oasis.svg")
    quote_svg = assets_bundle.get("icon_quote") or svg_data_uri(RAIZ / "assets" / "icon-quote.svg")

    fotos, encontradas, faltan = recoger_fotos(RAIZ / "assets" / "fotos",
                                               RAIZ / "assets" / "productos")

    dir_url = url_como_llegar()
    map_block = bloque_mapa(logo, dir_url)

    primera_foto = next((f["src"] for f in fotos["local"] if f["src"]), None)
    favicon = ("data:image/svg+xml;base64," + base64.b64encode(
        ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
         '<circle cx="32" cy="32" r="32" fill="#775B43"/>'
         '<g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
         '<path d="M23.8 26.4V15.6c0-4.3 3.6-6.9 8.2-6.9s8.2 2.6 8.2 6.9v10.8"/>'
         '<path d="M23.8 24.6C13.4 25.4 6.4 27.4 6.4 29.4M40.2 24.6c10.4.8 17.4 2.8 17.4 4.8"/>'
         '<path d="M6.4 29.4c0 3.9 11.5 7 25.6 7s25.6-3.1 25.6-7"/>'
         '<path d="M25.9 26.6c0 7.4 2.7 12.2 6.1 12.2s6.1-4.8 6.1-12.2"/>'
         '<path d="M25.4 37.6v14.2M38.6 37.6v14.2"/></g></svg>'
         ).encode()).decode("ascii"))

    site_js = {
        "timezone": SITE["timezone"],
        "waBase": "https://wa.me/" + SITE["whatsapp_e164"],
        "phone": SITE["telefono_e164"],
    }

    tokens = {
        "STYLES": estilos,
        "APP_JS": app_js,
        "MENU_JSON": json.dumps(menu, ensure_ascii=False, separators=(",", ":")),
        "I18N_JSON": json.dumps(i18n, ensure_ascii=False, separators=(",", ":")),
        "PHOTOS_JSON": json.dumps(fotos, ensure_ascii=False, separators=(",", ":")),
        "HOURS_JSON": json.dumps(HORARIO, separators=(",", ":")),
        "SITE_JSON": json.dumps(site_js, ensure_ascii=False, separators=(",", ":")),
        "JSONLD": jsonld(menu),
        "LOGO_SVG": logo,
        "QUOTE_SVG": quote_svg,
        "FAVICON": favicon,
        "OG_IMAGE": primera_foto or logo,
        "SITE_URL": SITE["url"],
        "MAP_BLOCK": map_block,
        "MAPS_DIR_URL": dir_url,
        "MAP_TITLE": f"Mapa de {SITE['nombre']}",
        "PHONE_E164": SITE["telefono_e164"],
        "PHONE_DISPLAY": SITE["telefono_txt"],
        "WA_URL": "https://wa.me/" + SITE["whatsapp_e164"],
        "WA_DISPLAY": SITE["whatsapp_txt"],
        "IG_URL": SITE["instagram"],
        "YEAR": str(dt.date.today().year),
    }

    html = plantilla
    for k, v in tokens.items():
        html = html.replace("{{" + k + "}}", v)

    sobrantes = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", html)))
    if sobrantes:
        raise SystemExit(f"ERROR: quedaron marcadores sin sustituir: {', '.join(sobrantes)}")

    def escribir_atomico(destino: Path) -> None:
        destino.parent.mkdir(parents=True, exist_ok=True)
        tmp = destino.with_suffix(destino.suffix + ".tmp")
        tmp.write_text(html, encoding="utf-8")
        os.replace(tmp, destino)

    escribir_atomico(out)

    # docs/index.html NO se toca: lo genera desplegar.ps1 copiando oasis_kafe.html,
    # que es el fichero maestro que se edita a mano y el que publica Cloudflare Pages.
    # Este generador quedo desfasado el 2-sep-2026: ver generador-antiguo/LEEME.md.
    pages_out = RAIZ / "docs" / "index.html"

    # ---- reporte ----
    kb = out.stat().st_size / 1024
    n_items = sum(len(c["items"]) for c in menu["categorias"])
    print(f"OK  {out}  ({kb:,.0f} KB)")
    if pages_out.exists():
        print(f"    nota: {pages_out.relative_to(RAIZ)} NO se toca (versión editada a mano)")
    print(f"    {len(menu['categorias'])} categorías · {n_items} productos · {len(i18n)} idiomas")
    print(f"    fotos incrustadas: {len(encontradas)}/{len(FOTOS_LOCAL) + len(FOTOS_PRODUCTO)}")
    for f in faltan:
        print(f"    falta foto -> {f}")
    for a in AVISOS:
        print(f"    aviso: {a}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Construye la web de Oasis Kafe.")
    ap.add_argument("--out", default="dist/oasis-kafe.html", help="fichero HTML de salida")
    ap.add_argument("--bundle", default=None,
                    help="HTML empaquetado del que reutilizar logo/iconos (opcional)")
    a = ap.parse_args()
    build(Path(a.out) if os.path.isabs(a.out) else RAIZ / a.out,
          Path(a.bundle).expanduser() if a.bundle else None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
