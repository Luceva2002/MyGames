#!/bin/bash
# Scarica le immagini Higgsfield di Matto in design-proposte/raw3/
cd "$(dirname "$0")" && mkdir -p raw3
B=https://d8j0ntlcm91z4.cloudfront.net/user_3JV2AAm991gUjx2zyt5uleGJUsg/hf_20261017_
while read n s; do curl -sSf -o "raw3/$n.png" "${B}${s}.png" && echo "ok $n" || echo "FAIL $n"; done <<'L'
icon1 003840_12548759-cd54-4fe1-bee3-0f513590eed4
icon2 003841_36d751dc-9abd-4e15-9f33-fdd5ca2d29d8
logo1 003840_653aa8b1-e776-4c2a-b66f-1e5682d89d49
logo2 003841_1c06169b-088b-473e-b869-4a854cdbda4e
bot-avatar 003841_4e38f10c-1530-491a-be0c-a4e48d0155b7
banner 003841_d933a6b0-ef76-4686-a4b0-de097b4d496a
scopa 003852_8fe4ce76-7c09-463b-b441-7440fb81e77d
briscola 003851_630118ad-0788-46c9-9409-f588965a2f8e
freccette 003851_0e0661c6-1e27-4c72-924b-78009626d4ad
L
