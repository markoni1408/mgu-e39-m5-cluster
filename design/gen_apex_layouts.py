import json
OUT='apps/apex_dash/hud/layouts/'
def T(id,x,y,w,h,text,font,color=None,align=None,**kw):
    d={'id':id,'type':'text','z':5,'x':x,'y':y,'w':w,'h':h,'text':text,'font':font}
    if color: d['color']=color
    if align: d['align']=align
    d.update(kw); return d
def prompts():
    # SHIFT flashes red either side of the lights at the shift point (empty text the rest of the time)
    return [T('prompt_l',352,60,110,37,'{{shiftPrompt}}','unit','hot','right'),T('prompt_r',1462,60,100,37,'{{shiftPrompt}}','unit','hot')]
def lights(): return {'id':'lights','type':'lights','z':1,'x':470,'y':34,'w':980,'h':34,'count':18,'tail':3,'round':True,'off':0.12,'from':3000}

# ===== APEX =====
CW=280; L,R=120,1610; rows=[215,371,527]
W=[]
spec=[(L,0,'rpm'),(L,1,'oil'),(L,2,'water'),(R,0,'fuel'),(R,1,'shift'),(R,2,'time')]
boxes=[{'id':n+'_box','x':x,'y':rows[r],'w':CW,'h':140,'radius':18} for x,r,n in spec]
W.append({'id':'frame','type':'boxes','class':'ambient','z':-10,'x':0,'y':0,'w':1920,'h':720,'color':'bg','boxes':boxes})
W.append(lights())
W.append({'id':'revs','type':'revbar','x':440,'y':444,'w':1040,'h':48,'top':6,'barH':28,'slant':16,'over':1000})
W.append({'id':'revs_scale','type':'scale','x':440,'y':496,'w':1040,'h':26,'font':'scale','color':'dim','redFrom':True,'over':1000})
W.append(T('rpm_label',1490,496,110,27,'X1000','head','dim'))
W.append(T('gear',520,64,240,244,'{{gearnum}}','gear','accent','center',hotWhen='now'))
W.append(T('speed',800,64,560,244,'{{speed}}','gear','fg','right'))
W.append(T('speed_unit',1368,250,130,37,'{{u:speed}}','unit','dim'))
def card(x,y,head,val,font='big',unit=None,tog=None,hot=False,warn=None):
    kw={'toggle':tog} if tog else {}
    o=[T(head[0],x+18,y+10,CW-30,27,head[1],'head','dim',**kw)]
    big=font=='big'
    vw=(214 if (unit and not big) else 190) if unit else CW-24
    v=T(val[0],x+10,y+(44 if big else 56),vw,93 if big else 70,val[1],font,'fg','right' if unit else 'left',**kw)
    if hot: v['hotWhen']='now'
    if warn: v['warn']=warn
    o.append(v)
    if unit: o.append(T(unit[0],x+(206 if big else 228),y+(88 if big else 82),(64 if big else 50),37,unit[1],'unit','dim',**kw))
    return o
W+=card(L,rows[0],('rpm_head','RPM'),('rpm','{{rpm10}}'),hot=True)
W+=card(L,rows[1],('oil_head','OIL'),('oil','{{oil}}'),unit=('oil_unit','{{u:temp}}'),warn={'signal':'oil','above':125})
W+=card(L,rows[2],('water_head','WATER'),('water','{{coolant}}'),unit=('water_unit','{{u:temp}}'),warn={'signal':'coolant','above':112})
W+=card(R,rows[0],('fuel_head','FUEL'),('fuel','{{fuelPct}}'),unit=('fuel_unit','%'),warn={'signal':'fuel','below':0.15})
W+=card(R,rows[1],('shift_head','SHIFT AT'),('shift_at','{{shiftAt}}'))
W+=card(R,rows[2],('time_head','TIME'),('time','{{time}}'),font='value',unit=('time_ampm','{{ampm}}'))
W+=prompts()
W.append(T('mode',L+18,178,260,27,'{{mode}}','head','accent'))
W.append(T('last_head',690,544,250,27,'LAST SHIFT  {{lastGears}}','head','dim'))
W.append(T('last_rpm',950,536,110,45,'{{lastShift}}','small','fg'))
W.append(T('last_verdict',1068,540,170,37,'{{verdict}}','unit',None,colorBy='verdict'))
APEX=W
json.dump({'schemaVersion':2,'name':'Apex','theme':'apex','_about':"Apex: hero gear and speed up top (above the black box BMW paints over the middle, y ~300-420), cards at the sides clear of it (x < 1406 or > 1597 where it matters), rev bar and last-shift line below. Nothing sits in the bottom-centre warning strip (y > 585, x 570-1150).",'widgets':W},open(OUT+'apex.json','w'),indent=1)

import copy
R=copy.deepcopy(APEX); R.append({'id':'stripe','type':'stripe','z':1,'x':440,'y':526,'w':1040,'h':5})
json.dump({'schemaVersion':2,'name':'Apex Red','theme':'apexred','_about':'Apex in race red with the tricolour stripe.','widgets':R},open(OUT+'apex_red.json','w'),indent=1)
# ===== CIRCUIT =====
W=[]
cells=[('oil',560,'OIL','{{oil}}','{{u:temp}}'),('water',835,'WATER','{{coolant}}','{{u:temp}}'),('fuel',1110,'FUEL','{{fuelPct}}','%')]
boxes=[{'id':n+'_box','x':x,'y':440,'w':250,'h':104,'radius':16} for n,x,_,_,_ in cells]
W.append({'id':'frame','type':'boxes','class':'ambient','z':-10,'x':0,'y':0,'w':1920,'h':720,'color':'bg','boxes':boxes})
W.append(lights())
W+=prompts()
W.append(T('mode',140,222,260,27,'{{mode}}','head','accent','center'))
W.append({'id':'ring_rpm','type':'arc','z':2,'x':120,'y':262,'w':280,'h':280,'signal':'rpm','min':0,'max':7500,'width':14})
W.append({'id':'ring_speed','type':'arc','z':2,'x':1610,'y':262,'w':280,'h':280,'signal':'speed','min':0,'max':300,'width':14})
W.append(T('gear',760,64,400,244,'{{gearnum}}','gear','fg','center',hotWhen='now'))
W.append(T('rpm',140,356,240,93,'{{rpm10}}','big','fg','center',hotWhen='now'))
W.append(T('rpm_cap',140,452,240,27,'RPM','head','dim','center'))
W.append(T('speed',1630,356,240,93,'{{speed}}','big','fg','center'))
W.append(T('speed_unit',1630,452,240,37,'{{u:speed}}','unit','dim','center'))
W.append(T('shift_head',140,584,240,27,'SHIFT AT','head','dim','center'))
W.append(T('shift_at',140,614,240,70,'{{shiftAt}}','value','accent','center'))
W.append(T('time_head',1630,584,240,27,'TIME','head','dim','center'))
W.append(T('time',1630,614,240,70,'{{time}}','value','accent','center'))
for n,x,head,val,unit in cells:
    kw={}
    if n=='oil': kw['warn']={'signal':'oil','above':125}
    if n=='water': kw['warn']={'signal':'coolant','above':112}
    if n=='fuel': kw['warn']={'signal':'fuel','below':0.15}
    W.append(T(n+'_head',x+16,452,220,27,head,'head','dim',**kw))
    W.append(T(n,x+10,484,(150 if unit else 226),45,val,'small','fg','right' if unit else 'left',**kw))
    if unit: W.append(T(n+'_unit',x+168,488,70,37,unit,'unit','dim',**kw))
W.append(T('last_head',690,556,250,27,'LAST SHIFT  {{lastGears}}','head','dim'))
W.append(T('last_rpm',950,548,110,45,'{{lastShift}}','small','fg'))
W.append(T('last_verdict',1068,552,170,37,'{{verdict}}','unit',None,colorBy='verdict'))
json.dump({'schemaVersion':2,'name':'Circuit','theme':'circuit','_about':"Circuit: a rev ring and a speed ring at the sides (clear of BMW's black box), the gear big in the middle, oil/water/boost cells under it, nothing in the bottom-centre warning strip.",'widgets':W},open(OUT+'circuit.json','w'),indent=1)
print('ok')

# ===== APEX RED: same cards, slanted rev bar + M stripe =====
a=json.load(open(OUT+'apex.json'))
Wr=[w for w in a['widgets'] if w['id'] not in('revs','revs_scale','rpm_label')]
i=[w['id'] for w in Wr].index('lights')+1
Wr.insert(i,{'id':'revbar','type':'revbar','x':440,'y':440,'w':1040,'h':56,'top':8,'barH':34,'slant':16,'over':1000})
Wr.insert(i+1,{'id':'rpm_scale','type':'scale','font':'scale','x':440,'y':500,'w':1040,'h':22,'over':1000,'redFrom':True,'color':'dim'})
Wr.insert(i+2,{'id':'stripe','type':'stripe','x':440,'y':526,'w':1040,'h':6})
for w in Wr:
    if w['id'] in('last_head','last_rpm','last_verdict'): w['y']+=10
json.dump({'schemaVersion':2,'name':'Apex Red','theme':'apexred','_about':'Apex Red: the Apex cards with a slanted race rev bar and the M tricolour stripe.','widgets':Wr},open(OUT+'apex_red.json','w'),indent=1)

# ===== SPRINT: speed left, gear right, rpm top =====
W=[]
cells=[('oil',655,'OIL','{{oil}}','{{u:temp}}'),('water',865,'WATER','{{coolant}}','{{u:temp}}'),('fuel',1075,'FUEL','{{fuelPct}}','%')]
boxes=[{'id':n+'_box','x':x,'y':450,'w':190,'h':104,'radius':16} for n,x,_,_,_ in cells]
W.append({'id':'frame','type':'boxes','class':'ambient','z':-10,'x':0,'y':0,'w':1920,'h':720,'color':'bg','boxes':boxes})
W.append(lights())
W+=prompts()
W.append(T('mode',110,200,300,27,'{{mode}}','head','accent'))
W.append({'id':'revbar','type':'revbar','x':440,'y':76,'w':1040,'h':56,'top':8,'barH':34,'slant':16,'over':1000})
W.append({'id':'rpm_scale','type':'scale','font':'scale','x':440,'y':136,'w':1040,'h':22,'over':1000,'redFrom':True,'color':'dim'})
W.append(T('rpm',760,186,400,93,'{{rpm10}}','big','fg','center',hotWhen='now'))
W.append(T('rpm_cap',1090,236,100,37,'RPM','unit','dim'))
W.append(T('speed',110,240,500,244,'{{speed}}','gear','fg','right'))
W.append(T('speed_unit',470,490,140,37,'{{u:speed}}','unit','dim','right'))
W.append(T('gear',1640,240,250,244,'{{gearnum}}','gear','accent','center',hotWhen='now'))
W.append(T('gear_cap',1640,490,250,27,'GEAR','head','dim','center'))
for n,x,head,val,unit in cells:
    kw={}
    if n=='oil': kw['warn']={'signal':'oil','above':125}
    if n=='water': kw['warn']={'signal':'coolant','above':112}
    if n=='fuel': kw['warn']={'signal':'fuel','below':0.15}
    W.append(T(n+'_head',x+14,462,170,27,head,'head','dim',**kw))
    W.append(T(n,x+8,494,(110 if unit else 170),45,val,'small','fg','right' if unit else 'left',**kw))
    if unit: W.append(T(n+'_unit',x+124,498,60,37,unit,'unit','dim',**kw))
W.append(T('last_head',110,548,320,27,'LAST SHIFT  {{lastGears}}','head','dim'))
W.append(T('last_rpm',110,580,110,45,'{{lastShift}}','small','fg'))
W.append(T('last_verdict',230,584,220,37,'{{verdict}}','unit',None,colorBy='verdict'))
W.append(T('shift_head',1640,540,250,27,'SHIFT AT','head','dim','center'))
W.append(T('shift_at',1640,568,250,70,'{{shiftAt}}','value','accent','center'))
W.append(T('time',1640,646,250,45,'{{time}} {{ampm}}','small','dim','center'))
json.dump({'schemaVersion':2,'name':'Sprint','theme':'sprint','_about':'Sprint: speed on the left, gear on the right (both clear of the middle, where BMW paints a black box), slanted rev bar and rpm up top, oil/water/boost in a row under it.','widgets':W},open(OUT+'sprint.json','w'),indent=1)
print('extra ok')
