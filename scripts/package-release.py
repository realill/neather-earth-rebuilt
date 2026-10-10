"""Create source and static-site ZIPs without dependencies or repository metadata."""
from pathlib import Path
import hashlib, zipfile
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'release'
OUT.mkdir(exist_ok=True)
NAME = 'neather-earth-rebuilt'
files = ['LICENSE', 'NOTICE', '.gitignore', 'README.md', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts']
directories = ['.github', 'src', 'public', 'scripts', 'tests', 'docs']

def add(archive, path, name):
    if path.is_symlink():
        raise ValueError(f'Refusing to package symlink: {path}')
    archive.write(path, name)

source = OUT / f'{NAME}-github.zip'
with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        add(archive, ROOT/name, f'{NAME}/{name}')
    for directory in directories:
        for path in sorted((ROOT/directory).rglob('*')):
            if any(part in {'.git', '__pycache__', 'node_modules'} for part in path.relative_to(ROOT).parts):
                continue
            if path.is_file() and not (path.name in {'extract-original.py','extract-audio.ts','oracle.ts','fidelity.test.ts','input-save.test.ts','ui.test.ts','explosion.test.ts','original.bin','symbols.json'}):
                add(archive, path, f'{NAME}/{path.relative_to(ROOT).as_posix()}')
site = OUT / f'{NAME}-site.zip'
with zipfile.ZipFile(site, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted((ROOT/'dist').rglob('*')):
        if path.is_file():
            add(archive, path, path.relative_to(ROOT/'dist').as_posix())
    add(archive, ROOT/'docs/provenance.md', 'PROVENANCE.md')
    add(archive, ROOT/'LICENSE', 'LICENSE')
    add(archive, ROOT/'NOTICE', 'NOTICE')
checksums = []
for path in [source, site]:
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checksums.append(f'{digest}  {path.name}')
    print(f'{path.name}: {path.stat().st_size:,} bytes')
(OUT/'SHA256SUMS.txt').write_text('\n'.join(checksums)+'\n')
