"""Render code-owned menu artwork; no channel provisioning or messages."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[1]
out=root/'workflows/line';out.mkdir(parents=True,exist_ok=True)
labels=['Add slip','Income / expense','Balances','My budgets','Review pending','Help / tools']
sub=['Camera or photos · one payment','Review before recording','Tracked THB accounts','Spent · remaining · limits','Confirm · edit · cancel','Commands and your accounts']
codes=['slip','entry','balances','budgets','pending','help']
image=Image.new('RGB',(2500,1686),'#0A0C0E');draw=ImageDraw.Draw(image)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
large=ImageFont.truetype(font,58);small=ImageFont.truetype(font,29);brand=ImageFont.truetype(font,25)
areas=[]
for i,(label,note,code) in enumerate(zip(labels,sub,codes)):
 col,row=i%3,i//3;x=col*2500//3;x2=(col+1)*2500//3;y=row*843
 draw.rounded_rectangle((x+16,y+16,x2-16,y+827),radius=28,fill='#101619',outline='#303B3E',width=3)
 draw.text((x+54,y+58),'AEGIS  /  LINE FINANCE',font=brand,fill='#B5BBB9')
 draw.ellipse((x+54,y+206,x+190,y+342),fill='#2E6B72',outline='#8EB9AA',width=3)
 draw.text((x+96,y+239),str(i+1),font=large,fill='#EDE7DC')
 draw.text((x+54,y+430),label,font=large,fill='#EDE7DC')
 draw.text((x+54,y+536),note,font=small,fill='#B5BBB9')
 draw.rounded_rectangle((x+54,y+682,x+270,y+744),radius=12,fill='#E8913C')
 draw.text((x+92,y+694),'OPEN',font=small,fill='#0A0C0E')
 action={'type':'postback','data':'aegis-menu:'+code} if code else {'type':'uri','uri':'https://aegis.example.invalid/review'}
 areas.append({'bounds':{'x':x,'y':y,'width':x2-x,'height':843},'action':action})
image.save(out/'aegis-rich-menu.png',optimize=True)
menu={'size':{'width':2500,'height':1686},'selected':False,'name':'Aegis finance — reviewed setup required','chatBarText':'Aegis finance','areas':areas}
(out/'aegis-rich-menu.template.json').write_text(json.dumps(menu,ensure_ascii=False,indent=2)+'\n')
print('Rendered inactive setup asset: 2500 × 1686; six postback shortcuts; no live menu provisioned.')
