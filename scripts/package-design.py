from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
out=root/'deliverables'
out.mkdir(exist_ok=True)
with ZipFile(out/'Waypoint_Designathon.zip','w',ZIP_DEFLATED) as z:
 for name in ['docs/Waypoint_Designathon.pdf','public/design-book.html','docs/DESIGNATHON.md','docs/DEMO-SCRIPT.md','docs/ART-DIRECTION.md','docs/VALIDATION.md','docs/ILLUSTRATION-SYSTEM.md']:
  p=root/name
  if p.exists():
   if name=='public/design-book.html': z.writestr('Waypoint_Designathon/'+p.name,p.read_text().replace('src="images/','src="Prototype/public/images/'))
   else: z.write(p,'Waypoint_Designathon/'+p.name)
 for folder in ['src','scripts','tests']:
  for p in (root/folder).rglob('*'):
   if p.is_file():z.write(p,'Waypoint_Designathon/Prototype/'+str(p.relative_to(root)))
 for name in ['README.md','package.json','package-lock.json','tsconfig.json','next.config.ts','postcss.config.mjs','playwright.config.ts','next-env.d.ts','.gitignore','AGENTS.md']:
  p=root/name
  if p.exists():z.write(p,'Waypoint_Designathon/Prototype/'+name)
 for p in (root/'public').rglob('*'):
  if p.is_file():z.write(p,'Waypoint_Designathon/Prototype/'+str(p.relative_to(root)))
 for p in (root/'docs').glob('*'):
  if p.is_file() and p.suffix != '.pdf':z.write(p,'Waypoint_Designathon/Prototype/docs/'+p.name)
print('Packaged deliverables/Waypoint_Designathon.zip')
