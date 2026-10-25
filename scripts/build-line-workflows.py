"""Build inactive n8n 2.33.3 exports. Node versions checked against installed source.

Manual triggers and fixture_mode=true are intentional activation boundaries.
Credential associations, private IDs, pinned data and execution data are omitted.
"""
import json
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'workflows/n8n'


def node(name, kind, version, parameters, x, y=0, **extra):
    return {'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'aegis-line-v1/' + name)), 'name': name,
            'type': 'n8n-nodes-base.' + kind, 'typeVersion': version,
            'position': [x, y], 'parameters': parameters, **extra}


def code(name, script, x, y=0):
    return node(name, 'code', 2, {'jsCode': script}, x, y)


def condition(name, expression, x, y=0):
    return node(name, 'if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'strict', 'version': 2},
        'conditions': [{'id': str(uuid.uuid5(uuid.NAMESPACE_URL, name)), 'leftValue': expression, 'rightValue': True,
        'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'options': {}}, x, y)


def http(name, path, x, y=0, *, body=None, auth='service', lease_source=None, full=False, url=None):
    p = {'method': 'GET' if body is None else 'POST', 'url': url or "={{ $('Settings').first().json.api_base + '" + path + "' }}",
         'options': {'timeout': 45000}}
    if auth in {'service', 'delivery', 'line'}:
        p.update(authentication='genericCredentialType', genericAuthType='httpHeaderAuth')
    if lease_source:
        p.update(sendHeaders=True, headerParameters={'parameters': [{'name': 'Authorization', 'value': "={{ 'Bearer ' + $('" + lease_source + "').first().json." + ('delivery' if lease_source == 'Claim delivery' else 'job') + ".lease_token }}"}]})
    if body is not None:
        p.update(sendBody=True, specifyBody='json', jsonBody=body)
    if full:
        p['options']['response'] = {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'json'}}
    return node(name, 'httpRequest', 4.5, p, x, y, continueOnFail=True)


def base(title):
    nodes = [node('Manual start', 'manualTrigger', 1, {}, 0),
             code('Settings', "return [{json:{fixture_mode:true,api_base:'https://aegis.example.invalid'}}];", 220),
             node('Operator setup', 'stickyNote', 1, {'content': '## INACTIVE — fictional fixture by default\nTarget: n8n 2.33.3. Manual trigger only. Set Settings.fixture_mode=false only after G1/G2 review. Select separate Header Auth credentials for ingestion claim, delivery claim and LINE push. Lease headers are server issued. Never add direct ledger/database writes. Save execution data: none. Do not pin real financial data.', 'height': 250, 'width': 650}, 100, -330)]
    return {'name': title, 'active': False, 'nodes': nodes, 'connections': {}, 'settings': {'timezone': 'Asia/Bangkok', 'executionOrder': 'v1', 'saveDataSuccessExecution': 'none', 'saveDataErrorExecution': 'none', 'saveExecutionProgress': False}, 'pinData': {}}


def wire(w, source, target, branch=0):
    c=w['connections'].setdefault(source, {'main': []})['main']
    while len(c)<=branch:c.append([])
    c[branch].append({'node':target,'type':'main','index':0})


def save(w, filename):
    wire(w,'Manual start','Settings')
    (OUT/filename).write_text(json.dumps(w, indent=2)+'\n')


w=base('Aegis — ingestion processing (inactive)')
w['nodes'] += [condition('Fixture ingestion?', '={{ $json.fixture_mode === true }}', 440),
 code('Fixture claim', "return [{json:{job:{id:'fixture-text-job',kind:'text',generation:1,lease_token:'fixture-only-capability',source:{text:'expense 150.25 food account:main'}},fixture_mode:true}}];",660,-150),
 http('Claim job','/api/integrations/jobs/claim',660,150,body='{"kinds":["text","extract"]}'),
 condition('Job available?', '={{ !!$json.job && !$json.error }}',880,150),
 code('No job or claim failure', "return [{json:{state:$json.error?'claim_failed':'idle',no_money_posted:true,action:'Inspect safe operations state; never repost a financial command'}}];",1100,350),
 code('Validate job', "const j=$json.job;if(!j || !['text','extract'].includes(j.kind) || !Number.isInteger(j.generation) || j.generation<1 || typeof j.lease_token!=='string')throw new Error('Invalid source-bound job');return [{json:{job:j,fixture_mode:$('Settings').first().json.fixture_mode}}];",1100),
 condition('Fixture processor?', '={{ $json.fixture_mode === true }}',1320),
 code('Fixture draft response', "return [{json:{draft_id:'fixture-pending-draft',version:1,no_money_posted:true,mode:'fictional_fixture'}}];",1540,-150),
 http('Process source job','',1540,150,body="={{ JSON.stringify({generation:$('Validate job').first().json.job.generation}) }}",auth=None,lease_source='Claim job',full=True,url="={{ $('Settings').first().json.api_base + '/api/integrations/jobs/' + $('Validate job').first().json.job.id + '/process' }}"),
 condition('Processing failed?', '={{ $json.process_error === true }}',1760,150),
 http('Fail same job','',1980,300,body="={{ JSON.stringify({generation:$('Validate job').first().json.job.generation,retryable:$json.retryable,code:$json.code}) }}",auth=None,lease_source='Claim job',url="={{ $('Settings').first().json.api_base + '/api/integrations/jobs/' + $('Validate job').first().json.job.id + '/fail' }}"),
 code('Pending review result', "if(!$json.draft_id)throw new Error('Missing durable draft result');return [{json:{state:'awaiting_owner_review',draft_id:$json.draft_id,version:$json.version,no_money_posted:true}}];",1980,-80)]
w['nodes'] += [code('Normalize process response', "const r=$json;if(r.error)return [{json:{process_error:true,stop:false,retryable:true,code:'PROVIDER_UNAVAILABLE'}}];const status=r.statusCode||200;const body=r.body||{};if(status>=200&&status<300)return [{json:{...body,process_error:false}}];const d=body.detail||{};const allowed=['EXTRACTION_FAILED','CAPTURE_FAILED','INVALID_MEDIA','PROVIDER_UNAVAILABLE','INVALID_TEXT'];return [{json:{process_error:true,stop:[401,403,409].includes(status),retryable:typeof d.retryable==='boolean'?d.retryable:status>=500,code:allowed.includes(d.code)?d.code:'EXTRACTION_FAILED'}}];",1760,150), condition('Can finish lease?', '={{ $json.stop !== true }}',1980,300), code('Stale capability stopped', "return [{json:{state:'stale_capability_stopped',no_money_posted:true,note:'Read current review state; never overwrite a newer worker'}}];",2200,450)]
for a,b,i in [('Settings','Fixture ingestion?',0),('Fixture ingestion?','Fixture claim',0),('Fixture ingestion?','Claim job',1),('Claim job','Job available?',0),('Job available?','Validate job',0),('Job available?','No job or claim failure',1),('Fixture claim','Validate job',0),('Validate job','Fixture processor?',0),('Fixture processor?','Fixture draft response',0),('Fixture processor?','Process source job',1),('Fixture draft response','Pending review result',0),('Process source job','Normalize process response',0),('Normalize process response','Processing failed?',0),('Processing failed?','Can finish lease?',0),('Can finish lease?','Fail same job',0),('Can finish lease?','Stale capability stopped',1),('Processing failed?','Pending review result',1)]:wire(w,a,b,i)
next(n for n in w['nodes'] if n['name']=='Process source job')['parameters']['options']['timeout']=70000
save(w,'aegis-ingestion.inactive.json')

w=base('Aegis — LINE delivery (inactive)')
w['nodes'] += [condition('Fixture delivery?', '={{ $json.fixture_mode === true }}',440),
 code('Fixture delivery claim', "return [{json:{delivery:{id:'00000000-0000-4000-8000-000000000001',generation:1,lease_token:'fixture-delivery-capability',retry_key:'00000000-0000-4000-8000-000000000001',payload:{to:'U00000000000000000000000000000000',messages:[{type:'text',text:'FICTIONAL fixture: draft awaiting review. Nothing recorded.'}]}}}}];",660,-150),
 http('Claim delivery','/api/integrations/delivery/claim',660,150,body='{}',auth='delivery'),
 condition('Delivery available?', '={{ !!$json.delivery && !$json.error }}',880,150),
 code('Delivery idle or blocked', "return [{json:{state:$json.error?'delivery_blocked':'idle_or_budget_exhausted',no_financial_write:true}}];",1100,350),
 code('Frozen LINE request', "const d=$json.delivery;if(!d||typeof d.payload?.to!=='string'||!Array.isArray(d.payload.messages)||!d.retry_key)throw new Error('Invalid frozen delivery');return [{json:{delivery:d,payload:d.payload,fixture_mode:$('Settings').first().json.fixture_mode}}];",1100),
 condition('Fixture provider?', '={{ $json.fixture_mode === true }}',1320),
 code('Fixture provider acceptance', "return [{json:{state:'fixture_provider_accepted',real_message_sent:false,no_financial_write:true}}];",1540,-150),
 http('LINE push frozen body','',1540,150,body='={{ JSON.stringify($json.payload) }}',auth='line',full=True,url='https://api.line.me/v2/bot/message/push'),
 condition('Network uncertain?', '={{ !!$json.error }}',1760,150),
 http('Delivery uncertain','',1980,300,body="={{ JSON.stringify({generation:$('Frozen LINE request').first().json.delivery.generation}) }}",auth=None,lease_source='Claim delivery',url="={{ $('Settings').first().json.api_base + '/api/integrations/delivery/' + $('Frozen LINE request').first().json.delivery.id + '/fail' }}"),
 http('Record provider outcome','',1980,0,body="={{ JSON.stringify({generation:$('Frozen LINE request').first().json.delivery.generation,provider_status:$json.statusCode,provider_ack:($json.headers||{})['x-line-accepted-request-id']||null}) }}",auth=None,lease_source='Claim delivery',url="={{ $('Settings').first().json.api_base + '/api/integrations/delivery/' + $('Frozen LINE request').first().json.delivery.id + '/complete' }}")]
# A retry key is sent on the FIRST request and retained by the backend forever.
line=next(n for n in w['nodes'] if n['name']=='LINE push frozen body')
line['parameters'].update(sendHeaders=True,headerParameters={'parameters':[{'name':'X-Line-Retry-Key','value':'={{ $json.delivery.retry_key }}'}]})
for a,b,i in [('Settings','Fixture delivery?',0),('Fixture delivery?','Fixture delivery claim',0),('Fixture delivery?','Claim delivery',1),('Claim delivery','Delivery available?',0),('Delivery available?','Frozen LINE request',0),('Delivery available?','Delivery idle or blocked',1),('Fixture delivery claim','Frozen LINE request',0),('Frozen LINE request','Fixture provider?',0),('Fixture provider?','Fixture provider acceptance',0),('Fixture provider?','LINE push frozen body',1),('LINE push frozen body','Network uncertain?',0),('Network uncertain?','Delivery uncertain',0),('Network uncertain?','Record provider outcome',1)]:wire(w,a,b,i)
save(w,'aegis-delivery.inactive.json')

w=base('Aegis — operational checks (inactive)')
w['nodes'] += [condition('Fixture operations?', '={{ $json.fixture_mode === true }}',440),
 code('Fixture safe counts', "return [{json:{jobs:{queued:2,failed:1},outbox:{pending:1},reconciliation:{unresolved:1},fixture:true}}];",660,-150),
 http('Read safe operations','/api/integrations/operations',660,150),
 code('Safe operational report', "if($json.error)return [{json:{state:'operations_unavailable',notify:false}}];return [{json:{state:'review_operations',counts:$json,notify:false,note:'Manual report only. Scheduling or owner notification needs deliberate setup.'}}];",900)]
for a,b,i in [('Settings','Fixture operations?',0),('Fixture operations?','Fixture safe counts',0),('Fixture operations?','Read safe operations',1),('Fixture safe counts','Safe operational report',0),('Read safe operations','Safe operational report',0)]:wire(w,a,b,i)
save(w,'aegis-operations.inactive.json')
print('Built three sanitized inactive workflows for n8n 2.33.3')
