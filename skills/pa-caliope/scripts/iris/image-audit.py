#!/usr/bin/env python3
"""image-audit.py: relatório de imagens raster (dimensões, formato, alpha, peso, cores dominantes, avisos).

Compatível com Python 3.9. Depende só de Pillow (pip install Pillow).

Uso:
  python3 tools/image-audit.py <imagem|pasta> [mais ...] [opções]

Opções:
  --colors N            número de cores dominantes (por defeito 5)
  --display-width PX    largura CSS a que a imagem vai ser mostrada; avisa se faltar resolução para 2x
                        ou se sobrar muito (por defeito: sem verificação)
  --max-bytes N         peso a partir do qual avisa (por defeito 512000, 500 KB)
  --max-dim PX          maior lado a partir do qual avisa "demasiado grande para uso típico" (por defeito 2560)
  --no-recursive        não desce em subpastas
  --json                saída JSON
  -h, --help            esta ajuda

Exemplos:
  python3 tools/image-audit.py assets/hero.png
  python3 tools/image-audit.py assets/ --display-width 600 --json
"""
import argparse
import json
import os
import re
import sys
import warnings

warnings.filterwarnings("ignore", category=UserWarning, module="PIL")

try:
    from PIL import Image, ImageSequence
except ImportError:  # pragma: no cover
    sys.stderr.write("erro: Pillow não está instalado. Instala com: python3 -m pip install --user Pillow\n")
    sys.exit(2)

EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp", ".tif", ".tiff", ".ico", ".heic"}


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return "%.0f %s" % (n, unit) if unit == "B" else "%.1f %s" % (n, unit)
        n /= 1024.0


def to_hex(rgb):
    return "#%02x%02x%02x" % tuple(int(c) for c in rgb[:3])


def has_alpha_channel(im):
    return im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info) or "transparency" in im.info


def alpha_stats(im):
    """Devolve (tem_transparência_real, fração de píxeis não opacos)."""
    if not has_alpha_channel(im):
        return False, 0.0
    a = im.convert("RGBA").getchannel("A")
    hist = a.histogram()
    total = float(sum(hist)) or 1.0
    non_opaque = total - hist[255]
    return non_opaque > 0, non_opaque / total


def dominant_colors(im, k):
    """Cores dominantes por quantização (median cut) numa miniatura; ignora píxeis quase transparentes."""
    thumb = im.copy()
    thumb.thumbnail((200, 200))
    rgba = thumb.convert("RGBA")
    pixels = [p for p in rgba.getdata() if p[3] > 16]
    if not pixels:
        return []
    flat = Image.new("RGB", (len(pixels), 1))
    flat.putdata([p[:3] for p in pixels])
    # pede mais cores do que k e funde as quase iguais (ruído de compressão), para não repetir tons
    q = flat.quantize(colors=min(256, k * 3), method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    merged = []  # [count, [r, g, b]]
    for count, idx in sorted(q.getcolors(), reverse=True):
        rgb = pal[idx * 3: idx * 3 + 3]
        for m in merged:
            if sum((a - b) ** 2 for a, b in zip(m[1], rgb)) < 18 ** 2:
                m[0] += count
                break
        else:
            merged.append([count, rgb])
    merged.sort(key=lambda m: -m[0])
    total = float(len(pixels))
    return [{"hex": to_hex(rgb), "percentagem": round(100 * c / total, 1)} for c, rgb in merged[:k]]


def unique_colors(im):
    thumb = im.copy()
    thumb.thumbnail((256, 256))
    c = thumb.convert("RGB").getcolors(maxcolors=1 << 20)
    return len(c) if c else 1 << 20


def find_variant(path, scale):
    """Procura irmão com sufixo @2x/@3x (ou sem sufixo quando o ficheiro já é @2x)."""
    d, name = os.path.split(path)
    stem, ext = os.path.splitext(name)
    base = re.sub(r"@\dx$", "", stem)
    target = base + ("" if scale == 1 else "@%dx" % scale)
    # compara com a listagem real (macOS é insensível a maiúsculas e devolveria nomes que não existem)
    wanted = target.lower() + ext.lower()
    try:
        names = os.listdir(d or ".")
    except OSError:
        return None
    for n in sorted(names):
        if n.lower() == wanted and n != name:
            return os.path.join(d, n)
    return None


def audit(path, args):
    size = os.path.getsize(path)
    r = {"ficheiro": path, "bytes": size, "peso": human(size), "avisos": [], "dicas": []}
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:  # noqa: BLE001
        r["erro"] = "não consegui abrir: %s" % e
        return r
    w, h = im.size
    fmt = im.format or os.path.splitext(path)[1][1:].upper()
    frames = getattr(im, "n_frames", 1)
    real_alpha, frac = alpha_stats(im)
    icc = im.info.get("icc_profile")
    icc_desc = None
    if icc:
        try:
            from PIL import ImageCms
            import io
            icc_desc = ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(icc))).strip()
        except Exception:  # noqa: BLE001
            icc_desc = "perfil ICC presente"
    exif_orient = None
    try:
        exif_orient = im.getexif().get(0x0112)
    except Exception:  # noqa: BLE001
        pass
    uniq = unique_colors(im)
    m = re.search(r"@(\d)x$", os.path.splitext(os.path.basename(path))[0])
    scale = int(m.group(1)) if m else 1
    r.update({
        "formato": fmt, "modo": im.mode, "largura": w, "altura": h,
        "proporcao": "%d:%d" % (w // _gcd(w, h), h // _gcd(w, h)) if _gcd(w, h) > 1 else "%.3f:1" % (w / float(h)),
        "megapixeis": round(w * h / 1e6, 2), "bitsPorPixel": round(size * 8.0 / (w * h), 2),
        "frames": frames, "canalAlpha": has_alpha_channel(im), "transparenciaReal": real_alpha,
        "fracaoNaoOpaca": round(frac, 4), "perfilICC": icc_desc, "orientacaoEXIF": exif_orient,
        "coresUnicasAprox": uniq, "escalaNoNome": scale,
        "coresDominantes": dominant_colors(im, args.colors),
    })
    A, D = r["avisos"], r["dicas"]
    photographic = uniq > 4096

    if fmt == "PNG" and not real_alpha and photographic:
        A.append("PNG sem transparência e com aspeto fotográfico (%d cores): JPEG/WebP/AVIF pesa tipicamente bastante menos" % uniq)
    elif fmt == "PNG" and not real_alpha and has_alpha_channel(im):
        D.append("canal alpha sem píxeis transparentes: pode ser removido (RGB) para poupar peso")
    if fmt == "PNG" and real_alpha and size > 200 * 1024:
        D.append("PNG com transparência e %s: WebP/AVIF com alpha costuma ser mais leve" % human(size))
    if fmt in ("JPEG", "MPO") and not photographic and uniq < 256:
        A.append("JPEG com poucas cores (%d): gráfico/ilustração plana fica mais nítido e leve em PNG/WebP lossless ou SVG" % uniq)
    if fmt == "GIF" and frames > 1:
        A.append("GIF animado (%d frames): vídeo (MP4/WebM) ou WebP/AVIF animado pesa muito menos" % frames)
    if im.mode == "CMYK":
        A.append("modo CMYK: converter para sRGB antes de usar em ecrã")
    if im.mode in ("I;16", "I;16B", "I", "F") or (fmt == "PNG" and im.info.get("bits") == 16):
        D.append("16 bits por canal: desnecessário para web na maioria dos casos")
    if icc_desc and "srgb" not in icc_desc.lower():
        D.append("perfil de cor '%s': confirmar se é intencional (Display P3 ok para web moderna; outros convém converter para sRGB)" % icc_desc)
    if exif_orient and exif_orient != 1:
        A.append("orientação EXIF %s: alguns contextos ignoram-na; aplicar a rotação aos píxeis" % exif_orient)
    if max(w, h) > args.max_dim:
        A.append("maior lado %dpx > %dpx: demasiado grande para uso típico; gerar variantes (srcset) ou reduzir" % (max(w, h), args.max_dim))
    if size > args.max_bytes:
        A.append("peso %s > %s" % (human(size), human(args.max_bytes)))
    if r["bitsPorPixel"] > 4 and fmt in ("JPEG", "WEBP", "AVIF"):
        D.append("%.1f bits/píxel: compressão pouco agressiva para %s (fotos web costumam ficar entre 0.5 e 2)" % (r["bitsPorPixel"], fmt))

    # variantes de densidade
    if scale == 1:
        v2 = find_variant(path, 2)
        r["variante2x"] = v2
        if not v2 and max(w, h) <= 1200 and not photographic:
            D.append("sem variante @2x ao lado: em ecrãs de alta densidade vai parecer desfocada se for mostrada a %dx%d CSS px" % (w, h))
    else:
        v1 = find_variant(path, 1)
        r["variante1x"] = v1
        if v1:
            try:
                w1, h1 = Image.open(v1).size
                if (w1 * scale, h1 * scale) != (w, h):
                    A.append("@%dx tem %dx%d mas a versão 1x tem %dx%d (esperado %dx%d)" % (scale, w, h, w1, h1, w1 * scale, h1 * scale))
            except Exception:  # noqa: BLE001
                pass

    if args.display_width:
        need = args.display_width * 2
        if w < args.display_width:
            A.append("largura %dpx < largura de exibição %dpx: vai ser ampliada e desfocar" % (w, args.display_width))
        elif w < need:
            D.append("largura %dpx < %dpx (2x de %d CSS px): pouco nítida em ecrãs de alta densidade" % (w, need, args.display_width))
        elif w > args.display_width * 3:
            A.append("largura %dpx > 3x a largura de exibição (%dpx): peso desperdiçado; redimensionar para ~%dpx" % (w, args.display_width, need))
    return r


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def collect(paths, recursive):
    out = []
    for p in paths:
        if os.path.isdir(p):
            for root, dirs, files in os.walk(p):
                dirs.sort()
                for f in sorted(files):
                    if os.path.splitext(f)[1].lower() in EXTS:
                        out.append(os.path.join(root, f))
                if not recursive:
                    break
        elif os.path.exists(p):
            out.append(p)
        else:
            sys.stderr.write("aviso: não existe: %s\n" % p)
    return out


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--colors", type=int, default=5)
    ap.add_argument("--display-width", type=int, default=0)
    ap.add_argument("--max-bytes", type=int, default=512000)
    ap.add_argument("--max-dim", type=int, default=2560)
    ap.add_argument("--no-recursive", action="store_true")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("-h", "--help", action="store_true")
    args = ap.parse_args()
    if args.help:
        print(__doc__.strip())
        return 0
    if not args.paths:
        sys.stderr.write("erro: indica pelo menos uma imagem ou pasta. Ver --help.\n")
        return 2
    files = collect(args.paths, not args.no_recursive)
    if not files:
        sys.stderr.write("erro: nenhuma imagem encontrada\n")
        return 2
    results = [audit(f, args) for f in files]
    if args.json:
        print(json.dumps({"imagens": results}, ensure_ascii=False, indent=2))
        return 0
    for r in results:
        print("\n" + r["ficheiro"])
        if "erro" in r:
            print("  ERRO   " + r["erro"])
            continue
        alpha = "não"
        if r["canalAlpha"]:
            alpha = "sim, %.1f%% de píxeis não opacos" % (100 * r["fracaoNaoOpaca"]) if r["transparenciaReal"] else "canal presente mas tudo opaco"
        print("  %s %s, %dx%d (%s, %s MP), %s, %.2f bits/px%s" % (
            r["formato"], r["modo"], r["largura"], r["altura"], r["proporcao"], r["megapixeis"], r["peso"], r["bitsPorPixel"],
            ", %d frames" % r["frames"] if r["frames"] > 1 else ""))
        print("  alpha: %s; cores únicas (aprox.): %s; ICC: %s" % (alpha, r["coresUnicasAprox"] if r["coresUnicasAprox"] < (1 << 20) else ">1M", r["perfilICC"] or "-"))
        print("  dominantes: " + ", ".join("%s %s%%" % (c["hex"], c["percentagem"]) for c in r["coresDominantes"]))
        for a in r["avisos"]:
            print("  aviso  " + a)
        for d in r["dicas"]:
            print("  dica   " + d)
        if not r["avisos"] and not r["dicas"]:
            print("  sem avisos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
