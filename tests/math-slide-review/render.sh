#!/bin/bash
# render.sh DIR [simulate-google]: PPTX -> PDF -> PNG contact sheets. With simulate, Pretendard is replaced by Arial as Google Slides does on import.
set -e
D=$1; SIM=$2
cd "$D"
for f in *.pptx; do
  n=${f%.pptx}; rm -rf "tmp-$n"; mkdir "tmp-$n"; (cd "tmp-$n" && unzip -q "../$f")
  if [ -n "$SIM" ]; then sed -i 's/typeface="Pretendard"/typeface="Arial"/g' tmp-$n/ppt/slides/*.xml; fi
  (cd "tmp-$n" && zip -q -r "../sim-$n.pptx" .); rm -rf "tmp-$n"
done
soffice --headless --convert-to pdf sim-*.pptx >/dev/null 2>&1
for p in sim-*.pdf; do n=${p%.pdf}; pdftoppm -r 50 -png "$p" "$n"; done
