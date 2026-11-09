import zipfile, re, sys
src, dst = sys.argv[1], sys.argv[2]
KEEP = {'Inter','Inter SemiBold','Inter Medium','Plus Jakarta Sans','Plus Jakarta Sans ExtraBold','Plus Jakarta Sans Medium','Plus Jakarta Sans SemiBold','Courier Prime'}
zin = zipfile.ZipFile(src)
ft = zin.read('word/fontTable.xml').decode('utf8')
rels = zin.read('word/_rels/fontTable.xml.rels').decode('utf8')
drop_ids = set()
def fix(m):
    name = re.search(r'w:name="([^"]*)"', m.group(0)).group(1)
    block = m.group(0)
    if name not in KEEP:
        for rid in re.findall(r'<w:embed\w+ [^>]*r:id="([^"]+)"[^>]*/>', block): drop_ids.add(rid)
        block = re.sub(r'<w:embed\w+ [^>]*/>', '', block)
    return block
ft = re.sub(r'<w:font [^>]*>.*?</w:font>', fix, ft, flags=re.S)
targets = {}
for m in re.finditer(r'<Relationship [^>]*/>', rels):
    rid = re.search(r'Id="([^"]+)"', m.group(0)).group(1); tgt = re.search(r'Target="([^"]+)"', m.group(0)).group(1)
    targets[rid] = tgt
drop_files = {'word/' + targets[r] for r in drop_ids}
rels = re.sub(r'<Relationship [^>]*/>', lambda m: '' if re.search(r'Id="([^"]+)"', m.group(0)).group(1) in drop_ids else m.group(0), rels)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    if it.filename in drop_files or it.filename.endswith('/'): continue
    data = zin.read(it.filename)
    if it.filename == 'word/fontTable.xml': data = ft.encode('utf8')
    elif it.filename == 'word/_rels/fontTable.xml.rels': data = rels.encode('utf8')
    zout.writestr(it, data)
zout.close()
print('dropped', len(drop_files), 'font files')
