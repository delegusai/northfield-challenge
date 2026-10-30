"""Build the 1.1.0 archive with stable timestamps; never rewrites older releases."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
kit = root / 'kit-1.1.0'
names = ['authority.mjs', 'suite.mjs', 'model.mjs', 'runner.mjs', 'diagnostics.mjs', 'server-rules.ts']
manifest = {
    'protocol': 'northfield-authority/1.0.0',
    'suite': 'northfield-starter/1.0.0',
    'kit': '1.1.0',
    'report': 'northfield-report/1.1.0',
    'files': {name: hashlib.sha256((kit / name).read_bytes()).hexdigest() for name in names},
}
(kit / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = root / 'releases/northfield-research-1.1.0.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for name in sorted(names + ['manifest.json', 'README.md', 'CONTRIBUTING.md', 'LICENSE', 'example-agent.mjs']):
        entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        bundle.writestr(entry, (kit / name).read_bytes())
print(f'{archive.name}: {hashlib.sha256(archive.read_bytes()).hexdigest()}')
