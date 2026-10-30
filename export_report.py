"""Create an offline, self-contained dashboard from a synthetic evaluation report."""
import argparse
import base64
import html
import json
from pathlib import Path
import re

WEB = Path(__file__).parent / 'web'


def build(report):
    if report.get('version') != 2:
        raise ValueError('An expanded evaluation report (version 2) is required.')
    page = (WEB / 'results.html').read_text()
    fonts = (WEB / 'assets/fonts.css').read_text()
    def font(match):
        data = (WEB / match[1].lstrip('/')).read_bytes()
        return "url('data:font/woff2;base64," + base64.b64encode(data).decode() + "')"
    fonts = re.sub(r"url\('(/assets/fonts/[a-z0-9-]+\.woff2)'\)",font,fonts)
    css = fonts + (WEB / 'style.css').read_text() + (WEB / 'results.css').read_text()
    page = re.sub(r'<link rel="stylesheet"[^>]+>', '', page)
    page = page.replace('<script src="/results.js" defer></script>', '')
    page = page.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; font-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">\n<style>'+css+'</style>\n</head>')
    logo = base64.b64encode((WEB / 'assets/delegus-mark.svg').read_bytes()).decode()
    page = page.replace('/assets/delegus-mark.svg', 'data:image/svg+xml;base64,'+logo)
    page = page.replace('href="/"','href="#"').replace('<a class="quiet" href="#">Payment lab</a>', '<span class="local">Saved report</span>')
    page = page.replace('Results are read from a local report. Refreshing this page does not make model calls or change payment authority.', 'This saved report works offline. No model calls, payment actions, or external requests are available.')
    data = json.dumps(report).replace('&','\\u0026').replace('<','\\u003c').replace('>','\\u003e')
    notices = '\n\n'.join(p.name+'\n'+p.read_text() for p in sorted((WEB/'assets/fonts/licenses').glob('*')) if p.is_file())
    page = page.replace('</main>', '<details><summary>Font license notices</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+html.escape(notices)+'</pre></details></main>')
    page = page.replace('</body>', '<script type="application/json" id="embedded-report">'+data+'</script>\n<script>'+(WEB/'results.js').read_text()+'</script>\n</body>')
    return page


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--input', default='reports/live-evaluation.json')
    parser.add_argument('--output', default='reports/evaluation-dashboard.html')
    args=parser.parse_args()
    report=json.loads(Path(args.input).read_text())
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(build(report))
    print('Saved offline dashboard: '+str(output))
