#!/bin/bash
# Scarica le immagini Higgsfield delle proposte di design in design-proposte/raw/
cd "$(dirname "$0")" && mkdir -p raw
B=https://d8j0ntlcm91z4.cloudfront.net/user_3JV2AAm991gUjx2zyt5uleGJUsg/hf_20261016_
while read n s; do curl -sSf -o "raw/$n.png" "${B}${s}.png" && echo "ok $n" || echo "FAIL $n"; done <<'L'
A-icon 235041_095baf64-de11-492b-8750-d82472942acc
A-logo 235005_ba4b2999-18ad-44ad-932d-32b44513ed19
A-scopa 235005_215e3cc5-be89-46df-a223-e3eb38b2d8f8
A-lupus 235006_f23a589e-4acc-40d0-b996-f8beeba238de
A-tavolo 235005_8c25ce1c-b68a-42ce-9886-e2ed66581c1a
A-bot 235005_74578b3d-e71d-4f13-bf9c-d486ca4c0de6
A-retro 235042_83a7836c-8edd-46e5-b61c-9986ca4572c9
A-banner 235004_6c9cb381-f7a9-4ded-b41e-e3864603697d
B-icon 235004_5bc9ccb4-ea37-4807-927b-46a9235b28ee
B-logo 235041_8d316aa1-dc0b-4e81-8567-ec2d0a3f33b5
B-scopa 235005_b7566184-88fb-4049-b86e-b6ca33ce927e
B-lupus 235042_5f0d6205-4198-4b14-9b06-2318f4f8e5a7
B-tavolo 235042_9bae7b4c-129b-4e7f-95ab-133724a4c0fa
B-bot 235042_48ba2460-886d-4cc6-901f-b0e11ad270f4
B-retro 235057_7ac56193-549c-448e-a987-5941a2936fad
B-banner 235057_5d620e47-ce5a-4bb3-88e0-4fc856b8cca5
C-icon 235057_3f0f5114-cc17-445a-a67f-25c8986f51f6
C-logo 235058_7db767b3-327a-451e-94c4-3db51e2b947d
C-scopa 235057_f6790740-1c1c-45e3-b3d2-d8158642bf61
C-lupus 235057_6e586197-7d2d-4c61-b00d-51ba1881c816
C-tavolo 235109_b6a17851-c5b2-4f1a-a25b-07a0e214916f
C-bot 235130_43f07a7c-457b-4f63-bc89-e7d64dea5a5c
C-retro 235110_ba677701-ad41-423d-a8d5-234d3dd8b4b3
C-banner 235109_9cb59806-cbd2-4764-936a-5934c65b0924
L
