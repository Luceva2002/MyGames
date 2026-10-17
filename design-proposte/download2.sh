#!/bin/bash
# Scarica le immagini Higgsfield del Carnevale semplificato in design-proposte/raw2/
cd "$(dirname "$0")" && mkdir -p raw2
B=https://d8j0ntlcm91z4.cloudfront.net/user_3JV2AAm991gUjx2zyt5uleGJUsg/hf_20261017_
while read n s; do curl -sSf -o "raw2/$n.png" "${B}${s}.png" && echo "ok $n" || echo "FAIL $n"; done <<'L'
icon1 001359_e82b45e2-5651-4941-8386-b4fcab69ef1c
icon2 001400_94e28947-0c6e-4ef0-bdd3-aceace4c4595
logo1 001359_cb013d36-ab8c-48a7-b814-e05112fd2021
logo2 001400_2756c76a-8b59-40ca-bd73-9a5926ae4b9d
scopa 001359_52ff7a43-4ee7-4c24-a6db-25e814b5566b
lupus 001359_2300bbe6-555c-4f40-b7f0-2317dc7312bc
briscola 001408_fce1c696-4146-4a2d-85f0-29e1730991db
freccette 001421_f02fde92-ff10-4c88-ac45-5c5272c64324
bot-avatar 001421_af85f572-99d8-452a-9cd6-dc80d5d51c98
bot-figure 001421_a7e31dc8-1aa7-4eb7-acf5-8dbf70a33574
banner 001408_e2aad096-9607-44ad-b390-4bc6c86be38d
L
