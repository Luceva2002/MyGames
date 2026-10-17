from PIL import Image
import numpy as np, os, sys, json
cat={'carte':['scopa','briscola','tresette','setteemezzo','scala40','burraco','machiavelli','solitario','uno'],
 'tavolo':['dama','scacchi','tris'],'dadi':['yahtzee'],'abilita':['football','freccette','biliardo'],'party':['lupus']}
col={k:tuple(int(v[i:i+2],16) for i in (1,3,5)) for k,v in json.loads(sys.argv[1]).items()}
out_dir=sys.argv[2]; final=len(sys.argv)>3
def src(g): return f'raw2/{g}.png' if g in ('scopa','briscola','lupus','freccette') else f'raw4/{g}.png'
def recolor(path,new):
    a=np.asarray(Image.open(path).convert('RGB')).astype(float)
    bg=np.median(np.concatenate([a[:20,:20].reshape(-1,3),a[-20:,-20:].reshape(-1,3),a[:20,-20:].reshape(-1,3)]),axis=0)
    t=np.clip((a@bg)/(bg@bg),0,1); m=np.linalg.norm(a-t[...,None]*bg,axis=2)<28
    o=a.copy(); o[m]=t[m][:,None]*np.array(new,float)
    return Image.fromarray(o.clip(0,255).astype('uint8'))
os.makedirs(out_dir,exist_ok=True); th=[]
for c,gs in cat.items():
    for g in gs:
        im=recolor(src(g),col[c]); im.save(f'{out_dir}/{g}.png')
        if final: im.convert('RGB').resize((768,768)).save(f'pronti/games/{g}.jpg',quality=88)
        t=im.copy();t.thumbnail((240,240));th.append(t)
sheet=Image.new('RGB',(6*250,3*250),'white')
for i,t in enumerate(th): sheet.paste(t,((i%6)*250,(i//6)*250))
sheet.save(f'{out_dir}/_anteprima.jpg',quality=85)
