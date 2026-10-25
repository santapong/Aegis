"""Fresh local HTTPS Compose installation; fictional users, no provider calls."""
import hashlib
import json
import re
import socket
import ssl
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

BASE = 'https://localhost:3444'
OUT = Path('/mnt/data/company/apps/Aegis/docs/validation/2026-10-02-all-m/compose-local-tls/tls-probe-r2.json')
CA = Path('/mnt/data/aegis-all-m-2026-10-02/compose-local-tls/root-r2.crt')
assert not OUT.exists(), 'Retain outcomes; do not replay fixture writes blindly.'
context = ssl.create_default_context(cafile=str(CA))
report = {'started_at': datetime.now(timezone.utc).isoformat(), 'scope': 'actual Caddy local-CA HTTPS; client trusts only the generated public root; fictional records, no real channel', 'checks': {}}
client = httpx.Client(base_url=BASE, verify=context, timeout=25, trust_env=False)


def call(method, path, body=None, status=200, params=None, owner=client):
    response = owner.request(method, path, json=body, params=params)
    assert response.status_code == status, (method, path, response.status_code, response.text[:600])
    return response.json() if response.content else None


def register(owner, label):
    payload = {'email': label + '@aegis.local', 'username': label, 'password': 'fictional-local-tls-only-20261002'}
    user = call('POST', '/api/auth/register', payload, 201, owner=owner)
    response = owner.post('/api/auth/login', json={k: payload[k] for k in ['email', 'password']})
    assert response.status_code == 200
    cookie = next(c for c in owner.cookies.jar if c.name == 'aegis_session')
    assert cookie.secure and cookie.has_nonstandard_attr('HttpOnly')
    assert 'samesite=lax' in response.headers['set-cookie'].lower()
    return user['id']


class Workspace:
    def __init__(self, kind, name):
        self.workspace = call('POST', '/api/cash/workspaces', {'name': name, 'kind': kind, 'currency': 'THB', 'request_key': str(uuid.uuid4())}, 201)
        self.root = '/api/cash/workspaces/' + self.workspace['id'] + '/'
        self.revision = 0
        self.account = self.post('accounts', {'name': 'Fictional local TLS cash'})['id']

    def post(self, path, body, status=201):
        result = call('POST', self.root + path, {**body, 'revision': self.revision, 'request_key': str(uuid.uuid4())}, status)
        self.revision = result['revision']
        return result

    def get(self, path='', **params):
        return call('GET', self.root + path if path else self.root[:-1], params=params)

    def forecast(self):
        return call('GET', '/api/cash/forecast', params={'workspace_id': self.workspace['id'], 'as_of': '2026-10-02', 'end': '2026-10-31'})['base']

    def anchor(self, amount, day):
        return self.post('anchors', {'account_id': self.account, 'amount': amount, 'date': day, 'source': 'Fictional reviewed local TLS opening'})

    def movement(self, title, amount):
        return self.post('movements', {'account_id': self.account, 'title': title, 'amount': amount, 'direction': 'income', 'date': '2026-10-02'})


try:
    with socket.create_connection(('127.0.0.1', 3444), timeout=10) as raw:
        with context.wrap_socket(raw, server_hostname='localhost') as tls:
            report['checks']['tls'] = {'version': tls.version(), 'certificate_hostname_verified': True, 'generated_ca_sha256': hashlib.sha256(CA.read_bytes()).hexdigest()}
    health = call('GET', '/api/health')
    assert health['status'] == 'ok' and health['db'] == 'ok'
    report['checks']['https_api_health'] = health
    pages, assets = {}, set()
    for path in ['/landing', '/login', '/docs', '/docs/developers/local-setup', '/demo', '/changelog', '/cashflow']:
        response = client.get(path)
        assert response.status_code == 200, (path, response.status_code)
        pages[path] = response.status_code
        assets.update(re.findall(r'(?:src|href)="(/_next/static/[^" ]+)"', response.text))
    assert assets
    for asset in assets:
        assert client.get(asset).status_code == 200, asset
    report['checks']['https_pages'] = pages
    report['checks']['https_static_assets'] = len(assets)
    call('GET', '/api/cash/workspaces', status=401)
    register(client, 'local-tls-personal')
    report['checks']['production_session_cookie'] = {'secure': True, 'http_only': True, 'same_site': 'lax'}
    personal = Workspace('personal', 'Local TLS Mina · fictional')
    assert personal.forecast()['cash_today'] is None
    personal.anchor('5000', '2026-10-01')
    movement_body = {'account_id': personal.account, 'title': 'Fictional received freelance', 'amount': '100', 'direction': 'income', 'date': '2026-10-02', 'revision': personal.revision, 'request_key': str(uuid.uuid4())}
    movement = call('POST', personal.root + 'movements', movement_body, 201)
    assert call('POST', personal.root + 'movements', movement_body, 201) == movement
    personal.revision = movement['revision']
    plan = personal.post('commitments', {'account_id': personal.account, 'title': 'Fictional expected freelance', 'amount': '200', 'direction': 'income', 'start_date': '2026-10-05'})
    occurrence = next(o for o in personal.get()['occurrences'] if o['commitment_id'] == plan['id'])
    before = personal.forecast()
    assert before['cash_today'] == '5100.00' and before['closing_cash'] == '5300.00'
    personal.post('settlements', {'transaction_id': movement['id'], 'occurrence_id': occurrence['id'], 'amount': '100'})
    after = personal.forecast()
    assert after['cash_today'] == '5100.00' and after['closing_cash'] == '5200.00'
    personal.post('goal-allocations', {'account_id': personal.account, 'name': 'Fictional reserve', 'amount': '100', 'mode': 'reserved', 'confirmed_currency': 'THB'})
    after_reserve = personal.forecast()
    assert after_reserve['cash_today'] == '5100.00' and after_reserve['reserved_cash'] == '100.00'
    report['checks']['personal'] = {'missing_opening_unknown': True, 'same_key_movement_once': True, 'cash_before_and_after_match': '5100.00', 'closing_before_match': '5300.00', 'closing_after_match': '5200.00', 'reserve_does_not_post_cash': True}
    business = Workspace('business', 'Local TLS Business X · fictional')
    business.anchor('5000', '2026-10-01')
    business.anchor('5500', '2026-10-02')
    document = business.post('business/documents', {'account_id': business.account, 'kind': 'receivable', 'counterparty': 'Fictional local TLS customer', 'reference': 'LOCAL-TLS-R2', 'amount': '1000', 'due_date': '2026-10-05', 'expected_date': '2026-10-05', 'confirmed_currency': 'THB'})
    saved = business.post('business/snapshots', {'name': 'Local TLS October 1 · fictional', 'as_of': '2026-10-01', 'end': '2026-10-31'})
    original = business.get('business/snapshots/' + saved['id'])
    variance = business.get('business/snapshots/' + saved['id'] + '/variance', reviewed_through='2026-10-02')
    assert variance['expected_cash'] == '5000.00' and variance['recorded_cash'] == '5500.00'
    assert variance['components']['opening_balance_revision'] == '500.00' and variance['components']['unclassified'] == '0.00'
    receipt = business.movement('Fictional received customer cash', '200')
    matched = business.post('business/documents/' + document['id'] + '/settle', {'transaction_id': receipt['id'], 'amount': '200'})
    assert matched['cash_effect'] == '0.00' and matched['document']['remaining_amount'] == '800.00'
    assert business.forecast()['cash_today'] == '5700.00'
    assert len(business.get('business/weeks', as_of='2026-10-02')['weeks']) == 13
    assert business.get('business/snapshots/' + saved['id']) == original
    report['checks']['business'] = {'matching_cash_effect': '0.00', 'remaining_receivable': '800.00', 'cash': '5700.00', 'weeks': 13, 'opening_variance': '500.00', 'unclassified': '0.00', 'saved_payload_immutable': True}
    with httpx.Client(base_url=BASE, verify=context, timeout=25, trust_env=False) as other:
        register(other, 'local-tls-other-owner')
        call('GET', business.root[:-1], status=404, owner=other)
        call('GET', business.root + 'business/snapshots/' + saved['id'], status=404, owner=other)
    call('POST', '/api/auth/logout', status=204)
    call('GET', '/api/cash/workspaces', status=401)
    report['checks']['session_and_isolation'] = {'anonymous_and_after_logout': 401, 'other_owner_workspace_and_snapshot': 404}
    report['status'] = 'passed'
except Exception as error:
    report['status'] = 'failed'
    report['error'] = str(error)
    raise
finally:
    client.close()
    report['finished_at'] = datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
