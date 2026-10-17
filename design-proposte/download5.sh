#!/bin/bash
# Scarica le proposte di carte e tavoli in design-proposte/raw5/
cd "$(dirname "$0")" && mkdir -p raw5
B=https://d8j0ntlcm91z4.cloudfront.net/user_3JV2AAm991gUjx2zyt5uleGJUsg/hf_20261017_
while read n s; do curl -sSf -o "raw5/$n.png" "${B}${s}.png" && echo "ok $n" || echo "FAIL $n"; done <<'L'
carte-bot 105201_734d58ab-3774-4e73-a36e-251d6fad14b4
retro-bot 105200_4de2bbe6-0e60-42df-99be-106d0755c37b
carte-pop 105200_cf0f4bbd-2592-4bba-b35f-3cd8d9b13647
retro-pop 105200_9acc8b4d-f1a1-46dc-9fa5-97e8f7f63049
carte-stampa 105201_d0af3ecc-5f75-4d39-bac3-e58eb36f0fd0
retro-stampa 105200_70b38f6b-e2cf-4436-9abb-95350206c182
tavolo-luci 105234_11eb5195-4318-4fcc-aa3d-ce42338c4eda
tavolo-rombi 105212_e29a8935-1550-4b46-91b8-3e058d18cd7b
tavolo-palco 105213_4d3313b2-e555-4a0c-b8f9-9fce291e0078
L
