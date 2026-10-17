#!/bin/bash
# Scarica personaggi, copertine e retri del Carnevale semplice in design-proposte/raw4/
cd "$(dirname "$0")" && mkdir -p raw4
B=https://d8j0ntlcm91z4.cloudfront.net/user_3JV2AAm991gUjx2zyt5uleGJUsg/hf_20261017_
while read n s; do curl -sSf -o "raw4/$n.png" "${B}${s}.png" && echo "ok $n" || echo "FAIL $n"; done <<'L'
pg-maschere1 010025_4874995a-957b-4988-bfaa-1bb096ec66c3
pg-maschere2 010025_570bd3a1-543e-4bcf-abfa-1f67ad94acfd
pg-festa 010025_c7bfc9ee-f30a-4e8e-b7e7-b958345609f9
tresette 010049_78a16373-c11e-4445-8e6e-309bad18899b
setteemezzo 010048_5b7b4984-8889-4638-b581-2c5835443acb
scala40 010048_fff8eb8e-9754-4c60-85c7-a15c558ec9f3
machiavelli 010048_22dda312-70a7-43e7-bb72-be92e3e77fab
burraco 010048_bcad794d-50ea-46d0-a698-ce779ad687cf
solitario 010049_4859439a-1cd6-40cc-a207-80f2b41dd4ad
uno 010106_5ad7197d-df98-41f6-8d00-5fcd52637374
football 010107_d0bdd529-f641-4339-a0cb-bc678e7c4f41
dama 010107_88054357-52e6-4fc2-8c0d-9daefaaa2607
scacchi 010107_8f57937b-2978-42b2-b81b-2c1b39ef70a2
yahtzee 010107_a1fc0fd1-951e-4a71-beeb-fbd4b4f91369
biliardo 010106_e23ec9e6-25a3-4171-9af2-cecda8f7ae39
tris 010121_87e9b83d-99ba-44f4-b543-f74c29bcce08
retro-fr 010122_fefb30ed-0777-4826-a713-92c1f4b67322
retro-uno 010121_5582adcd-a19a-4082-a12e-300cd2237c88
L
