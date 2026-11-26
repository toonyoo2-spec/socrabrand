import sys,glob,re
from PIL import Image,ImageDraw
d,prefix,out=sys.argv[1:4]
fs=sorted(glob.glob(f'{d}/{prefix}-*.png'),key=lambda f:int(re.search(r'-(\d+)\.png$',f).group(1)))
ims=[Image.open(f) for f in fs]; w,h=ims[0].size; cols=3; rows=(len(ims)+cols-1)//cols
s=Image.new('RGB',(cols*(w+6),rows*(h+6)),'#888')
for i,im in enumerate(ims):
    s.paste(im,((i%cols)*(w+6),(i//cols)*(h+6))); ImageDraw.Draw(s).text(((i%cols)*(w+6)+w-30,(i//cols)*(h+6)+h-14),str(i+1),fill='#ff0')
s.save(out); print(len(ims),s.size)
