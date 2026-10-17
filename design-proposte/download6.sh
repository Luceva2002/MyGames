#!/bin/bash
# Scarica le copertine home con i 4 bot preferiti in design-proposte/raw6/
cd "$(dirname "$0")" && mkdir -p raw6
B=https://d8j0ntlcm91z4.cloudfront.net/user_3JV2AAm991gUjx2zyt5uleGJUsg/hf_20261017_
while read n s; do curl -sSf -o "raw6/$n.png" "${B}${s}.png" && echo "ok $n" || echo "FAIL $n"; done <<'L'
hero-gruppo 141909_cd82fbce-ccf6-4626-b495-effbb340b61f
hero-carta 141909_88482a53-9556-4178-94b4-a77047cc1495
L
