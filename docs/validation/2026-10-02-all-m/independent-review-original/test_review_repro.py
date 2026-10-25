import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event

from sqlalchemy import event
from sqlalchemy.engine import Engine

from tests.test_cashflow import Cash, client as cash_client
from tests.test_cashflow_m3 import business, document

client = cash_client


def legacy(c):
    r = c.client.post('/api/transactions/', headers=c.headers,
        json={'amount':65, 'type':'expense', 'date':'2026-10-01','category':'Food'})
    assert r.status_code == 201
    return r.json()['id']


def test_key_is_bound_to_resource(client):
    c = business(client)
    a = document(c, reference='A')
    b = document(c, reference='B')
    body={'revision':c.rev,'request_key':str(uuid.uuid4()),'reason':'cancel reviewed unpaid plan'}
    ra=client.post(f"/api/cash/workspaces/{c.w['id']}/business/documents/{a['id']}/cancel", headers=c.headers,json=body)
    rb=client.post(f"/api/cash/workspaces/{c.w['id']}/business/documents/{b['id']}/cancel", headers=c.headers,json=body)
    assert ra.status_code == 200
    assert rb.status_code == 409, {'second_status':rb.status_code,'second_returned_document':rb.json()['id'],'actual_second_document':b['id']}


def test_parallel_adoption_cannot_assign_twice(client):
    c = Cash(client)
    second=client.post('/api/cash/workspaces',headers=c.headers,json={'name':'Second business','kind':'business','currency':'THB','request_key':str(uuid.uuid4())}).json()
    second_account=client.post(f"/api/cash/workspaces/{second['id']}/accounts",headers=c.headers,json={'name':'Second bank','revision':0,'request_key':str(uuid.uuid4())}).json()
    tid=legacy(c)
    both_reads=Barrier(2, timeout=15)
    def hold(conn,cursor,statement,params,context,many):
        if statement.startswith('SELECT transactions.') and 'WHERE transactions.id =' in statement and tid in params.values():
            both_reads.wait()
    event.listen(Engine,'after_cursor_execute',hold)
    try:
        targets=[(c.w['id'],c.account,c.rev),(second['id'],second_account['id'],1)]
        def adopt(target):
            wid,aid,rev=target
            return client.post(f'/api/cash/workspaces/{wid}/legacy/adopt',headers=c.headers,json={'revision':rev,'request_key':str(uuid.uuid4()),'account_id':aid,'transaction_ids':[tid],'confirmed_currency':'THB'})
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(adopt,targets))
    finally:
        event.remove(Engine,'after_cursor_execute',hold)
    assert sorted(r.status_code for r in results)==[200,409], {'responses':[{'status':r.status_code,'result':r.json()} for r in results], 'workspace_movements':[len(client.get(f'/api/cash/workspaces/{t[0]}',headers=c.headers).json()['movements']) for t in targets]}


def test_legacy_edit_cannot_change_adopted_matched_record(client):
    c=Cash(client)
    tid=legacy(c)
    c.commitment('Food plan','65','expense','2026-10-20')
    oid=c.occurrence('Food plan')['id']
    read=Event(); release=Event()
    def hold(conn,cursor,statement,params,context,many):
        if statement.startswith('SELECT transactions.') and 'transactions.workspace_id IS NULL' in statement and 'WHERE transactions.id =' in statement and tid in params.values():
            read.set()
            assert release.wait(15), 'Timed out waiting for cash assignment'
    event.listen(Engine,'after_cursor_execute',hold)
    try:
        with ThreadPoolExecutor(1) as pool:
            future=pool.submit(client.put,f'/api/transactions/{tid}',headers=c.headers,json={'amount':10})
            assert read.wait(10), 'Legacy writer did not read the row'
            c.post('legacy/adopt',{'account_id':c.account,'transaction_ids':[tid],'confirmed_currency':'THB'},status=200)
            c.post('settlements',{'transaction_id':tid,'occurrence_id':oid,'amount':'65'})
            release.set()
            result=future.result(timeout=15)
    finally:
        release.set()
        event.remove(Engine,'after_cursor_execute',hold)
    state=c.state()
    assert result.status_code == 404, {'legacy_status':result.status_code,'cash_amount':state['movements'][0]['amount'],'settled_amount':state['settlements'][0]['amount'],'cash_revision':state['workspace']['revision']}


def test_variance_uses_the_anchor_frozen_in_the_forecast(client):
    from tests.test_cashflow_m3 import snapshot, get
    c=business(client)
    c.post('anchors',{'account_id':c.account,'amount':'5500','date':'2026-10-02','source':'Reviewed later opening'})
    saved=snapshot(c)
    variance=get(c,f"business/snapshots/{saved['id']}/variance",reviewed_through='2026-10-10')
    assert variance['expected_cash']=='5000.00' and variance['recorded_cash']=='5500.00'
    assert variance['components']['opening_balance_revision']=='500.00' and variance['components']['unclassified']=='0.00', variance['components']
