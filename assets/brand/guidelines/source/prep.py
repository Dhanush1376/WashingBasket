import os, sys
from PIL import Image
R='D:/PROJECTS/WashingBasket'; O=sys.argv[1]; SH=sys.argv[2]
def save(src, name, maxw=1400, fmt='JPEG', q=84):
    im=Image.open(src)
    if fmt=='JPEG':
        if im.mode in ('RGBA','LA','P'):
            im=im.convert('RGBA'); bg=Image.new('RGB',im.size,'white'); bg.paste(im,mask=im.split()[-1]); im=bg
        else: im=im.convert('RGB')
    else: im=im.convert('RGBA')
    im.thumbnail((maxw,maxw*3))
    ext='.jpg' if fmt=='JPEG' else '.png'
    im.save(os.path.join(O,name+ext), fmt, **({'quality':q,'optimize':True} if fmt=='JPEG' else {'optimize':True}))
A=R+'/assets/'
for i in range(1,7): save(A+f'artwork/{i}.png', f'plate{i}', 1300)
for f in os.listdir(A+'illustrations'):
    save(A+'illustrations/'+f, 'ill-'+f[:-4].lower().replace(' ','-'), 1100)
for f in os.listdir(A+'avatars'): save(A+'avatars/'+f, 'avatar-'+f[:-4].lower(), 500, 'PNG')
for f in os.listdir(R+'/mobile/assets/services'): save(R+'/mobile/assets/services/'+f, 'svc-'+f[:-4].lower().replace(' ','-').replace(',',''), 1000)
W=R+'/website/src/assets/'
for f in os.listdir(W):
    if f.startswith(('screen-','ui-','cloth-','basket','table-')): save(W+f, f[:-5], 1400, 'PNG' if f.startswith(('ui-','basket')) else 'JPEG', 88)
save(R+'/assets/brand/WashingBasket-logo.png','logo-master',1254,'PNG')
save(R+'/admin/public/favicon.png','favicon',256,'PNG')
save(R+'/mobile/assets/icon.png','expo-placeholder-icon',400,'PNG')
save(R+'/Bright Laundry Workplace Illustration.png','workshop',1800)
save(R+'/Flat Vector Electric Steam Iron.png','iron',1000)
for f in os.listdir(SH): save(os.path.join(SH,f), 'shot-'+f[:-4], 1800, 'JPEG', 86)
print(len(os.listdir(O)))
