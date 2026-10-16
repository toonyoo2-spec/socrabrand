const archive = document.getElementById('archiveContainer');
const button = document.getElementById('btnAddProject');
const originalButtonGroup = button?.parentElement;
const index = document.querySelector('.nav-bar-wrapper');
if (archive) {
  const heading = archive.querySelector('.archive-page-heading');
  if (button) (heading || archive).append(button);
  if (originalButtonGroup?.parentElement?.tagName === 'HEADER' && !originalButtonGroup.children.length) originalButtonGroup.remove();
  if (index) {
    if (heading) heading.after(index);
    else archive.append(index);
  }
}
