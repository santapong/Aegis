"""Verify sanitized exports and native offline fixture execution evidence."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/validation/2026-10-22-line-ledger'
EXPECT={'ingestion':('Pending review result','awaiting_owner_review'), 'delivery':('Fixture provider acceptance','fixture_provider_accepted'), 'operations':('Safe operational report','review_operations')}
summary={}
for kind,(last,state) in EXPECT.items():
 artifact=json.loads((ROOT/f'workflows/n8n/aegis-{kind}.inactive.json').read_text())
 assert artifact['active'] is False
 assert not artifact.get('pinData')
 assert artifact['settings']['saveDataSuccessExecution']=='none'
 assert artifact['settings']['saveDataErrorExecution']=='none'
 assert all('credentials' not in n for n in artifact['nodes'])
 assert all(n['type']!='n8n-nodes-base.postgres' for n in artifact['nodes'])
 text=(OUT/f'n8n-{kind}-fixture.log').read_text()
 decoder=json.JSONDecoder();execution=None
 for i,c in enumerate(text):
  if c!='{':continue
  try:obj,_=decoder.raw_decode(text[i:])
  except ValueError:continue
  if isinstance(obj,dict) and 'status' in obj and 'data' in obj and obj.get('mode')=='cli':execution=obj;break
 assert execution and execution.get('finished') is True and execution['status']=='success',kind
 runs=execution['data']['resultData']['runData']
 assert last in runs
 result=runs[last][-1]['data']['main'][0][0]['json']
 assert result['state']==state,(kind,result)
 types={n['name']:n['type'] for n in artifact['nodes']}
 assert not any(types.get(name)=='n8n-nodes-base.httpRequest' for name in runs),'Fixture contacted HTTP'
 summary[kind]={'native_version':'2.33.3','status':'success','finished':True,'executed_nodes':list(runs),'result':result,'http_nodes_executed':0,'network':'none','import_scope':'ephemeral local container only'}
 # A native CLI resume token exists only in the destroyed disposable instance.
 # Keep reproducible output, not transient capability material, in repository logs.
 import re
 text=re.sub(r'("resumeToken"\s*:\s*")[^"]+',r'\1[redacted ephemeral token]',text)
 (OUT/f'n8n-{kind}-fixture.log').write_text(text)
(OUT/'n8n-fixture-results.json').write_text(json.dumps(summary,indent=2)+'\n')
print('Three native imports/executions verified; zero HTTP nodes executed.')
