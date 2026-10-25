"""Create only fictional examples in the explicitly authorized local preview."""
import os
import uuid
import httpx
if os.environ.get('AEGIS_ALLOW_DISPOSABLE_CASH_SEED') != 'yes':
    raise SystemExit('Run only for the isolated disposable cash preview with explicit seed opt-in.')
c=httpx.Client(base_url='http://127.0.0.1:8000',timeout=30)
email='release-preview@aegis.local';password='aegis-preview-local-2026'
r=c.post('/api/auth/register',json={'email':email,'username':'Aegis Preview','password':password})
assert r.status_code in [201,409,400],r.text
r=c.post('/api/auth/login',json={'email':email,'password':password});assert r.status_code==200,r.text
c.headers['Authorization']='Bearer '+r.json()['access_token']
existing=c.get('/api/cash/workspaces').json()
for kind,name,opening,buffer in [('personal','Mina · fictional example',30000,5000),('business','Business X · fictional example',60000,10000)]:
    if any(w['name']==name for w in existing):continue
    w=c.post('/api/cash/workspaces',json={'name':name,'kind':kind,'currency':'THB','buffer':str(buffer),'request_key':str(uuid.uuid4())}).json();rev=w['revision']
    def post(path,body):
        global rev
        r=c.post('/api/cash/workspaces/'+w['id']+'/'+path,json={**body,'revision':rev,'request_key':str(uuid.uuid4())});assert r.status_code in [200,201],r.text
        rev=r.json()['revision'];return r.json()
    a=post('accounts',{'name':'Everyday cash' if kind=='personal' else 'Operating cash'})['id']
    post('anchors',{'account_id':a,'amount':str(opening),'date':'2026-10-01','source':'Fictional example; start of October 1'})
    actuals=[('Salary',35000,'income'),('Rent',18000,'expense')] if kind=='personal' else [('Deposit',50000,'income'),('Studio rent',18000,'expense'),('Operations',3000,'expense')]
    for title,amount,direction in actuals:post('movements',{'account_id':a,'title':title,'amount':str(amount),'direction':direction,'date':'2026-10-01'})
    plans=[('Groceries',2500,'expense','16'),('Freelance payment',8000,'income','18'),('Utilities',1200,'expense','20'),('Transport',1800,'expense','23'),('Subscriptions',600,'expense','26')] if kind=='personal' else [('Client invoice BX-104',90000,'income','15'),('Contractor bill BX-201',65000,'expense','20'),('Hosting & tools',4000,'expense','23'),('Equipment',12000,'expense','26')]
    for title,amount,direction,day in plans:post('commitments',{'account_id':a,'title':title,'amount':str(amount),'direction':direction,'start_date':'2026-10-'+day,'due_date':'2026-10-08' if title.startswith('Client') else '2026-10-'+day})
    print(kind+': fictional example saved to the isolated local preview')
