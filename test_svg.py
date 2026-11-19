import subprocess

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 680" width="600" height="680">
  <defs>
    <!-- Gradients -->
    <linearGradient id="stemGrad" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#144d2d" />
      <stop offset="50%" stop-color="#2d8b4c" />
      <stop offset="100%" stop-color="#3fa85f" />
    </linearGradient>
    <linearGradient id="leafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#175e33" />
      <stop offset="45%" stop-color="#2c8949" />
      <stop offset="70%" stop-color="#5eb63c" />
      <stop offset="100%" stop-color="#8cd536" />
    </linearGradient>
    <linearGradient id="leafGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1b6637" />
      <stop offset="40%" stop-color="#349652" />
      <stop offset="75%" stop-color="#69c240" />
      <stop offset="100%" stop-color="#99df3d" />
    </linearGradient>
    <linearGradient id="leafHighlight" x1="20%" y1="20%" x2="80%" y2="80%">
      <stop offset="0%" stop-color="#bbf060" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#8cd536" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="berryPurple" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#a472c6" />
      <stop offset="40%" stop-color="#734996" />
      <stop offset="100%" stop-color="#3f1e5e" />
    </radialGradient>
    <radialGradient id="berryGreen" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#86da61" />
      <stop offset="60%" stop-color="#46a337" />
      <stop offset="100%" stop-color="#1d5c22" />
    </radialGradient>
    <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
      <stop offset="50%" stop-color="#dbeeff" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#c0dcf7" stop-opacity="0.3" />
    </linearGradient>
    <linearGradient id="beeBody" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5a623" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Main Arching Stem -->
  <path d="M 10 38 Q 120 50, 240 75 T 480 160" fill="none" stroke="url(#stemGrad)" stroke-width="14" stroke-linecap="round" />
  <path d="M 230 74 Q 350 78, 510 168" fill="none" stroke="url(#stemGrad)" stroke-width="9" stroke-linecap="round" />

  <!-- Hanging Twigs & Buds -->
  <!-- Stalk 1 -->
  <path d="M 95 48 Q 115 110, 85 170" fill="none" stroke="#256b3e" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 85 160 L 73 175 L 97 175 Z" fill="#2d8248" />
  <circle cx="85" cy="190" r="23" fill="url(#berryPurple)" />
  <ellipse cx="80" cy="184" rx="7" ry="5" fill="#ffffff" opacity="0.35" />

  <!-- Stalk 2 -->
  <path d="M 155 58 Q 185 115, 175 190" fill="none" stroke="#256b3e" stroke-width="4" stroke-linecap="round" />
  <path d="M 175 180 L 163 195 L 187 195 Z" fill="#2d8248" />
  <circle cx="175" cy="210" r="22" fill="url(#berryPurple)" />
  <ellipse cx="170" cy="204" rx="7" ry="5" fill="#ffffff" opacity="0.35" />

  <!-- Stalk 3 (Green Bud) -->
  <path d="M 215 70 Q 235 170, 210 270" fill="none" stroke="#256b3e" stroke-width="3.5" stroke-linecap="round" />
  <path d="M 210 260 L 202 272 L 218 272 Z" fill="#236636" />
  <circle cx="210" cy="285" r="19" fill="url(#berryGreen)" />

  <!-- Stalk 4 (Green Bud upper) -->
  <path d="M 310 88 Q 305 130, 285 170" fill="none" stroke="#256b3e" stroke-width="4" stroke-linecap="round" />
  <circle cx="280" cy="180" r="24" fill="url(#berryGreen)" />

  <!-- Stalk 5 (Purple Berry right) -->
  <path d="M 345 92 Q 355 130, 335 180" fill="none" stroke="#256b3e" stroke-width="4" stroke-linecap="round" />
  <path d="M 335 170 L 325 184 L 345 184 Z" fill="#236636" />
  <circle cx="335" cy="200" r="22" fill="url(#berryPurple)" />

  <!-- LEAF 1 (Leftmost leaf) -->
  <g>
    <!-- Leaf body with wavy margins -->
    <path d="M 125 70 Q 140 180, 115 260
             C 70 280, 50 320, 65 370
             C 50 400, 55 450, 75 480
             C 90 510, 120 540, 120 560
             C 130 530, 155 480, 160 440
             C 175 400, 170 340, 155 300
             C 145 260, 150 200, 130 70 Z"
          fill="url(#leafGrad1)" />
    <!-- Midrib vein -->
    <path d="M 125 70 Q 120 300, 120 560" fill="none" stroke="#1d6635" stroke-width="3" />
    <!-- Lighter highlight glow on leaf surface -->
    <path d="M 122 180 Q 145 280, 140 420 C 130 380, 122 300, 122 180 Z" fill="url(#leafHighlight)" />
  </g>

  <!-- LEAF 2 (Center leaf - largest, with water droplets) -->
  <g>
    <!-- Leaf stem -->
    <path d="M 230 75 Q 260 210, 245 300" fill="none" stroke="#256b3e" stroke-width="5" />
    <!-- Leaf body with lobes -->
    <path d="M 245 290
             C 215 310, 185 340, 195 400
             C 185 430, 190 490, 205 540
             C 220 580, 250 630, 260 655
             C 275 625, 305 570, 315 510
             C 335 460, 325 390, 305 340
             C 285 300, 270 295, 245 290 Z"
          fill="url(#leafGrad2)" />
    <!-- Midrib vein -->
    <path d="M 245 290 Q 255 460, 260 655" fill="none" stroke="#206e3b" stroke-width="4" />
    <!-- Leaf vein branches -->
    <path d="M 250 360 Q 220 390, 205 400" fill="none" stroke="#277d44" stroke-width="2" />
    <path d="M 252 420 Q 225 450, 210 470" fill="none" stroke="#277d44" stroke-width="2" />
    <path d="M 255 490 Q 230 520, 220 545" fill="none" stroke="#277d44" stroke-width="2" />
    <path d="M 252 380 Q 285 405, 310 420" fill="none" stroke="#3da658" stroke-width="2" />
    <path d="M 255 450 Q 288 475, 310 500" fill="none" stroke="#3da658" stroke-width="2" />
    <!-- Center Leaf Glow -->
    <path d="M 256 320 Q 285 440, 280 540 C 270 500, 257 400, 256 320 Z" fill="url(#leafHighlight)" opacity="0.8" />

    <!-- WATER DROPLETS on center leaf tip -->
    <!-- Drop 1 (larger) -->
    <g transform="translate(295, 540)">
      <ellipse cx="0" cy="0" rx="14" ry="16" fill="#a7e3a3" opacity="0.4" />
      <ellipse cx="2" cy="3" rx="12" ry="14" fill="#144d25" opacity="0.2" />
      <ellipse cx="-3" cy="-4" rx="5" ry="4" fill="#ffffff" opacity="0.85" />
      <circle cx="3" cy="5" r="2" fill="#ffffff" opacity="0.6" />
    </g>
    <!-- Drop 2 (smaller) -->
    <g transform="translate(278, 570)">
      <ellipse cx="0" cy="0" rx="10" ry="11" fill="#a7e3a3" opacity="0.4" />
      <ellipse cx="1" cy="2" rx="8" ry="9" fill="#144d25" opacity="0.2" />
      <ellipse cx="-2" cy="-3" rx="3.5" ry="2.5" fill="#ffffff" opacity="0.85" />
    </g>
  </g>

  <!-- LEAF 3 (Right leaf - with resting bee) -->
  <g>
    <path d="M 440 170
             C 400 200, 360 250, 370 340
             C 365 390, 380 440, 400 480
             C 420 515, 460 540, 470 550
             C 485 520, 520 460, 535 390
             C 545 330, 520 250, 480 200
             C 460 180, 450 175, 440 170 Z"
          fill="url(#leafGrad2)" />
    <!-- Midrib -->
    <path d="M 440 170 Q 455 350, 470 550" fill="none" stroke="#23743f" stroke-width="3.5" />
    <path d="M 450 250 Q 490 300, 510 330" fill="none" stroke="#48b564" stroke-width="2" />
    <path d="M 455 330 Q 495 380, 520 410" fill="none" stroke="#48b564" stroke-width="2" />
    <!-- Soft golden sun reflection on right leaf -->
    <path d="M 445 190 Q 490 280, 495 380 C 475 330, 450 250, 445 190 Z" fill="url(#leafHighlight)" opacity="0.9" />
  </g>

  <!-- BEE 1 (Resting on Right Leaf) -->
  <g transform="translate(435, 230) rotate(-12) scale(0.95)">
    <!-- Antennae -->
    <path d="M 30 18 Q 15 10, 8 16" fill="none" stroke="#221812" stroke-width="2.5" stroke-linecap="round" />
    <!-- Head -->
    <ellipse cx="32" cy="28" rx="14" ry="13" fill="#3a2318" />
    <ellipse cx="28" cy="24" rx="4" ry="6" fill="#18110b" />
    <ellipse cx="27" cy="22" rx="1.5" ry="2" fill="#ffffff" opacity="0.8" />
    <!-- Proboscis/mouthpart -->
    <path d="M 22 34 L 10 40" stroke="#3a2318" stroke-width="3" stroke-linecap="round" />

    <!-- Thorax with rich brown fur -->
    <ellipse cx="56" cy="35" rx="18" ry="17" fill="#6c4023" />
    <ellipse cx="54" cy="33" rx="15" ry="14" fill="#a4693a" />

    <!-- Wings (Translucent pale glowing) -->
    <g transform="rotate(-30, 60, 20)">
      <ellipse cx="78" cy="8" rx="30" ry="13" fill="url(#wingGrad)" stroke="#ffffff" stroke-width="1" />
      <!-- Wing veins -->
      <path d="M 52 10 Q 75 8, 102 6" stroke="#b0d4f5" stroke-width="1.2" fill="none" opacity="0.7" />
      <path d="M 68 8 Q 85 14, 98 16" stroke="#b0d4f5" stroke-width="1" fill="none" opacity="0.6" />
    </g>

    <!-- Abdomen with clear gold and black stripes -->
    <g transform="translate(70, 32) rotate(15)">
      <!-- Base shape -->
      <path d="M 0 -12 C 25 -14, 60 -5, 68 10 C 60 25, 25 28, 0 20 Z" fill="#f59e0b" />
      <!-- Black stripes -->
      <path d="M 12 -12 L 18 -11 C 18 2, 18 15, 12 21 L 6 20 C 6 8, 6 -3, 12 -12 Z" fill="#221710" />
      <path d="M 28 -9 L 35 -7 C 35 4, 35 15, 28 22 L 22 21 C 22 9, 22 -1, 28 -9 Z" fill="#221710" />
      <path d="M 44 -5 L 50 -2 C 48 6, 47 13, 42 18 L 37 17 C 40 10, 42 3, 44 -5 Z" fill="#221710" />
      <path d="M 58 2 L 68 10 L 56 15 Z" fill="#221710" />
    </g>

    <!-- Legs with Bright Orange Pollen Baskets (Corbiculae) -->
    <path d="M 45 48 Q 40 65, 42 75 L 37 80" fill="none" stroke="#2b1a13" stroke-width="3" stroke-linecap="round" />
    <path d="M 62 48 Q 65 65, 75 75 L 80 82" fill="none" stroke="#2b1a13" stroke-width="3.5" stroke-linecap="round" />
    <!-- Big Orange Pollen Basket on hind leg -->
    <ellipse cx="74" cy="68" rx="11" ry="16" fill="#f97316" stroke="#ea580c" stroke-width="1.5" transform="rotate(15, 74, 68)" />
    <!-- Tiny claw hook on foot -->
    <path d="M 80 82 C 78 86, 75 87, 72 85" fill="none" stroke="#2b1a13" stroke-width="2.5" />
  </g>

  <!-- BEE 2 (Flying in lower right area) -->
  <g transform="translate(390, 480) rotate(-6) scale(0.92)">
    <!-- Antennae -->
    <path d="M 26 15 Q 12 10, 6 18" fill="none" stroke="#221812" stroke-width="2.5" stroke-linecap="round" />
    <!-- Head -->
    <ellipse cx="30" cy="26" rx="15" ry="14" fill="#3a2318" />
    <ellipse cx="25" cy="21" rx="4.5" ry="6.5" fill="#18110b" />
    <ellipse cx="24" cy="19" rx="1.5" ry="2" fill="#ffffff" opacity="0.85" />
    <path d="M 18 32 L 6 42" stroke="#3a2318" stroke-width="3.5" stroke-linecap="round" />

    <!-- Thorax -->
    <ellipse cx="56" cy="34" rx="19" ry="17" fill="#6d3f22" />
    <ellipse cx="53" cy="32" rx="15" ry="14" fill="#ab6e3a" />

    <!-- Wings (Dynamic Flight spread upwards) -->
    <g transform="rotate(-40, 62, 18)">
      <ellipse cx="80" cy="4" rx="33" ry="14" fill="url(#wingGrad)" stroke="#ffffff" stroke-width="1.2" />
      <path d="M 52 8 Q 80 4, 108 2" stroke="#b0d4f5" stroke-width="1.2" fill="none" opacity="0.75" />
      <path d="M 70 6 Q 88 12, 104 14" stroke="#b0d4f5" stroke-width="1" fill="none" opacity="0.6" />
    </g>
    <!-- Secondary inner wing -->
    <g transform="rotate(-15, 62, 22)">
      <ellipse cx="82" cy="12" rx="26" ry="11" fill="url(#wingGrad)" opacity="0.85" stroke="#ffffff" stroke-width="0.8" />
    </g>

    <!-- Abdomen -->
    <g transform="translate(72, 30) rotate(18)">
      <path d="M 0 -13 C 28 -15, 66 -6, 75 11 C 66 28, 28 30, 0 22 Z" fill="#f59e0b" />
      <path d="M 14 -13 L 21 -12 C 21 3, 21 17, 14 23 L 7 22 C 7 9, 7 -3, 14 -13 Z" fill="#20150e" />
      <path d="M 31 -10 L 39 -8 C 39 5, 39 17, 31 24 L 24 23 C 24 10, 24 -1, 31 -10 Z" fill="#20150e" />
      <path d="M 48 -6 L 55 -3 C 53 6, 52 14, 46 20 L 40 19 C 44 11, 46 4, 48 -6 Z" fill="#20150e" />
      <path d="M 64 3 L 75 11 L 62 17 Z" fill="#20150e" />
    </g>

    <!-- Legs & Pollen Basket -->
    <path d="M 48 46 Q 44 65, 48 76 L 44 82" fill="none" stroke="#281710" stroke-width="3" stroke-linecap="round" />
    <path d="M 65 48 Q 70 70, 82 82 L 86 92" fill="none" stroke="#281710" stroke-width="3.5" stroke-linecap="round" />
    <!-- Bright Orange Pollen Basket (Corbicula) -->
    <ellipse cx="80" cy="74" rx="12" ry="17" fill="#f97316" stroke="#ea580c" stroke-width="1.5" transform="rotate(20, 80, 74)" />
    <!-- Leg claws -->
    <path d="M 86 92 C 84 97, 80 98, 77 95" fill="none" stroke="#281710" stroke-width="2.5" />
    <path d="M 44 82 C 41 86, 38 86, 36 84" fill="none" stroke="#281710" stroke-width="2.5" />
  </g>
</svg>'''

with open("public/bee.svg", "w") as f:
    f.write(svg_content)

print("Saved public/bee.svg")
