/* 起動の演出（本人が採用した 11案）。tools/build_bootfx.py が作る。手で編集しない。
   起動ごとに1つ引いて出す（本人「最初の画面はランダムで色々出るようにしたい」）。
   ・案ごとにCSSの接頭辞が分かれているので混ざらない（B だけ .boot → .bB-root に付け替え）
   ・どれも 1.4〜2.2秒で終わり、和紙の地に消える
   ・prefers-reduced-motion のときは出さない（本人の端末の設定を尊重する） */
(function(){
  var LIST = [{id:"B",css:"\n/* ===== 宅建アプリ 起動演出 B ／ 主役＝試験までの日数 ===== */\n.bB-root{\n  --bg:#f6f2ec; --panel:#fdfbf7; --txt:#332e28; --sub:#8a8074;\n  --sakura:#c98b9b; --sakura2:#a9647a; --line:#e8e0d8;\n  --fm:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",YuMincho,\"Noto Serif JP\",serif;\n\n  position:fixed; inset:0; z-index:9999;\n  display:flex; align-items:center; justify-content:center;\n  background:var(--bg); color:var(--txt);\n  font-family:var(--fm); -webkit-font-smoothing:antialiased;\n  opacity:0; transition:opacity .20s linear;\n  overflow:hidden; pointer-events:none;\n}\n.bB-root.is-in{opacity:1}\n.bB-root.is-out{opacity:0; transition:opacity .42s ease}\n\n/* 和紙の地（極薄のむら・自己完結のSVGノイズ） */\n.bB-root > .bB-grain{\n  position:absolute; inset:-20px; pointer-events:none; opacity:.055;\n  mix-blend-mode:multiply;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\");\n  background-size:140px 140px;\n}\n\n.bB-stage{\n  position:relative; display:flex; flex-direction:column; align-items:center;\n  transform:translateY(0); will-change:transform,filter;\n}\n.bB-root.is-out .bB-stage{\n  transform:translateY(-7px); filter:blur(1.1px);\n  transition:transform .44s ease-out, filter .44s ease-out;\n}\n\n/* 角丸16pxのカード・面色・罫線 */\n.bB-card{\n  width:258px; box-sizing:border-box;\n  padding:30px 24px 24px;\n  background:var(--panel); border:1px solid var(--line); border-radius:16px;\n  box-shadow:0 1px 0 rgba(51,46,40,.02), 0 10px 26px -18px rgba(51,46,40,.22);\n  display:flex; flex-direction:column; align-items:center;\n  opacity:0; transform:scale(.986);\n  transition:opacity .40s ease, transform .52s cubic-bezier(.2,.8,.2,1);\n}\n.bB-root.is-in .bB-card{opacity:1; transform:scale(1)}\n\n.bB-lab{\n  font-size:12.5px; letter-spacing:.24em; color:var(--sub);\n  margin:0 -.24em 6px 0;      /* 字送りの右余りを消して真ん中に見せる */\n  opacity:0; transform:translateY(4px);\n  transition:opacity .42s ease .10s, transform .42s cubic-bezier(.2,.8,.2,1) .10s;\n}\n.bB-root.is-in .bB-lab{opacity:1; transform:translateY(0)}\n\n/* 「日」の幅（23px＋余白7px）を負のマージンで打ち消し、数字そのものを中央に置く */\n.bB-row{display:flex; align-items:baseline; justify-content:center; margin-right:-30px}\n\n/* 数字＝大きく・等幅（1桁ずつ固定幅のマスに置いて揺れを止める） */\n.bB-num{\n  display:flex; justify-content:center;\n  font-size:94px; line-height:1.02; font-weight:500;\n  letter-spacing:0; color:var(--txt);\n  font-variant-numeric:tabular-nums; font-feature-settings:\"tnum\" 1;\n  will-change:filter,opacity,transform;\n}\n.bB-num .bB-d{\n  display:inline-block; width:.58em; text-align:center;\n}\n.bB-root.is-land .bB-num{animation:bB-settle .44s cubic-bezier(.22,.9,.24,1) both}\n@keyframes bB-settle{\n  0%{transform:scale(1.030)}\n  58%{transform:scale(.9965)}\n  100%{transform:scale(1)}\n}\n\n.bB-unit{\n  font-size:23px; color:var(--sub); margin-left:7px; padding-bottom:6px;\n  opacity:0; transform:translateY(7px);\n  transition:opacity .34s ease, transform .40s cubic-bezier(.2,.8,.2,1);\n}\n.bB-root.is-land .bB-unit{opacity:1; transform:translateY(0)}\n\n/* 桜はここ1点だけ */\n.bB-rule{width:54px; height:1px; margin:16px 0 0; overflow:hidden}\n.bB-rule > i{\n  display:block; width:100%; height:100%; background:var(--sakura);\n  transform:scaleX(0); transform-origin:50% 50%;\n}\n.bB-root.is-land .bB-rule > i{\n  transform:scaleX(1);\n  transition:transform .52s cubic-bezier(.16,.84,.24,1) .05s;\n}\n\n.bB-date{\n  margin:11px -.14em 0 0; font-size:11.5px; letter-spacing:.14em; color:var(--sub);\n  opacity:0; transition:opacity .40s ease .16s;\n}\n.bB-root.is-land .bB-date{opacity:1}\n\n.bB-sig{\n  margin:22px -.26em 0 0; font-size:11.5px; letter-spacing:.26em; color:var(--sub);\n  opacity:0; transition:opacity .5s ease .22s;\n}\n.bB-root.is-in .bB-sig{opacity:.85}\n\n@media (max-height:700px){\n  .bB-num{font-size:82px}\n  .bB-card{padding:26px 22px 20px}\n}\n",html:"<div class=\"bB-root\" id=\"bootB\" aria-hidden=\"true\">\n  <i class=\"bB-grain\"></i>\n  <div class=\"bB-stage\">\n    <div class=\"bB-card\">\n      <div class=\"bB-lab\">試験まで</div>\n      <div class=\"bB-row\">\n        <div class=\"bB-num\" id=\"bB-num\"><span class=\"bB-d\">0</span></div>\n        <div class=\"bB-unit\">日</div>\n      </div>\n      <div class=\"bB-rule\"><i></i></div>\n      <div class=\"bB-date\" id=\"bB-date\"></div>\n    </div>\n    <div class=\"bB-sig\">宅建 一問一答</div>\n  </div>\n</div>"},
{id:"D",css:"\n#bootD{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n/* 和帳の一葉。角丸16pxのカードのまま、余白は広く取る */\n#bootD .bd-page{\n  position:absolute; left:50%; top:170px; width:240px; height:400px;\n  margin-left:-120px; border-radius:16px; background:var(--panel);\n  box-shadow:0 1px 2px rgba(51,46,40,.05); opacity:0;\n}\n/* 天地の細い罫（右から左へ引く） */\n#bootD .bd-edge{\n  position:absolute; left:18px; right:18px; height:1px;\n  background:var(--line); transform:scaleX(0); transform-origin:100% 50%;\n}\n#bootD .bd-edge-t{top:22px}\n#bootD .bd-edge-b{bottom:22px}\n\n/* 縦の界線：幅193px（5本×1px＋間47px）＝左端23.5px。列の中心は 48 / 96 / 144 / 192 */\n#bootD .bd-rules{\n  position:absolute; left:0; right:0; top:38px; bottom:38px;\n  display:flex; justify-content:center; gap:47px;\n}\n#bootD .bd-rule{\n  width:1px; background:var(--line); transform:scaleY(0);\n  transform-origin:50% 0; opacity:0;\n}\n/* 朱引き（桜）。太さは見た目だけ広げ、列の位置はずらさない */\n#bootD .bd-rule-shu{\n  background:var(--acc); width:1.2px; margin:0 -.1px;\n}\n\n/* 大字は右から3列目の中心（144px）に、小字はその左の列（96px）に */\n#bootD .bd-title{\n  position:absolute; top:146px; left:144px; transform:translateX(-50%);\n  display:flex; flex-direction:column; align-items:center;\n}\n#bootD .bd-title span{\n  display:block; font-size:36px; line-height:1.42; letter-spacing:.02em;\n  color:var(--fg); opacity:0;\n}\n#bootD .bd-sub{\n  position:absolute; top:152px; left:96px; transform:translateX(-50%);\n  display:flex; flex-direction:column; align-items:center;\n}\n#bootD .bd-sub span{\n  display:block; font-size:13px; line-height:2.05; color:var(--muted); opacity:0;\n}\n/* 落款は大字の列の足元に */\n#bootD .bd-seal{\n  position:absolute; bottom:50px; left:144px; margin-left:-11px;\n  color:var(--accd); opacity:0;\n}\n#bootD .bd-seal svg{display:block}\n",html:"<div class=\"boot\" id=\"bootD\" aria-hidden=\"true\">\n  <div class=\"bd-page\">\n    <i class=\"bd-edge bd-edge-t\"></i>\n    <i class=\"bd-edge bd-edge-b\"></i>\n\n    <!-- 和帳の界線。5本＝4列。右から3列目に大字、その左に小字が入る -->\n    <div class=\"bd-rules\">\n      <i class=\"bd-rule\"></i>\n      <i class=\"bd-rule\"></i>\n      <i class=\"bd-rule\"></i>\n      <i class=\"bd-rule bd-rule-shu\"></i>\n      <i class=\"bd-rule\"></i>\n    </div>\n\n    <div class=\"bd-title\"><span>宅</span><span>建</span></div>\n    <div class=\"bd-sub\"><span>一</span><span>問</span><span>一</span><span>答</span></div>\n\n    <div class=\"bd-seal\">\n      <svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\"\n           stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n        <rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3.5\"></rect>\n        <circle cx=\"12\" cy=\"12\" r=\"2.1\"></circle>\n        <path d=\"M12 6.4v2.6M12 15v2.6M6.4 12h2.6M15 12h2.6\"></path>\n      </svg>\n    </div>\n  </div>\n</div>"},
{id:"I2",css:"\n/* I改 「障子が開く」 ― 本人「扉空いた後簡素すぎてあれだね」\n   開いた後に**中身**を足す：試験までの日数・今日やる本数・桜の印が、開いた奥から順に立ち上がる。 */\n.bi2{position:relative;width:393px;height:760px;overflow:hidden;background:#f6f2ec;color:#332e28;\n     font-family:\"Zen Old Mincho\",\"Yu Mincho\",serif}\n.bi2 .inner{position:absolute;left:0;right:0;top:250px;text-align:center}\n.bi2 .ttl{font-size:26px;letter-spacing:.4em;text-indent:.4em;opacity:0}\n.bi2 .days{margin-top:26px;opacity:0}\n.bi2 .days b{font-size:60px;font-variant-numeric:tabular-nums;letter-spacing:.02em}\n.bi2 .days i{font-style:normal;font-size:13px;color:#8a8074;margin-left:6px}\n.bi2 .lab{font-size:11px;color:#8a8074;letter-spacing:.26em;margin-top:8px}\n.bi2 .rule{width:0;height:1px;background:#e8e0d8;margin:22px auto 0}\n.bi2 .note{font-size:11px;color:#8a8074;letter-spacing:.2em;margin-top:14px;opacity:0}\n.bi2 .seal{position:absolute;left:50%;margin-left:-11px;top:520px;width:22px;height:22px;\n  color:#c98b9b;opacity:0}\n.bi2 .pane{position:absolute;top:0;bottom:0;width:50%;background:#fdfbf7;\n  box-shadow:0 0 0 1px #e8e0d8 inset}\n.bi2 .pane.l{left:0}.bi2 .pane.r{right:0}\n.bi2 .pane .lat{position:absolute;inset:0;\n  background:linear-gradient(#e8e0d8 1px,transparent 1px) 0 0/100% 76px,\n             linear-gradient(90deg,#e8e0d8 1px,transparent 1px) 0 0/76px 100%;opacity:.75}\n",html:"<div class=\"bi2\" id=\"bootI2\">\n  <div class=\"inner\">\n    <div class=\"ttl\" id=\"i2Ttl\">宅建</div>\n    <div class=\"days\" id=\"i2Days\"><b id=\"i2Num\">61</b><i>日</i>\n      <div class=\"lab\">試験まで</div></div>\n    <div class=\"rule\" id=\"i2Rule\"></div>\n    <div class=\"note\" id=\"i2Note\">今日は 3本 ／ 42問</div>\n  </div>\n  <svg class=\"seal\" id=\"i2Seal\" viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" aria-hidden=\"true\">\n    <path d=\"M12 4c1.6 2.2 1.6 4.2 0 6-1.6-1.8-1.6-3.8 0-6z\" fill=\"currentColor\"></path>\n    <path d=\"M20 12c-2.2 1.6-4.2 1.6-6 0 1.8-1.6 3.8-1.6 6 0z\" fill=\"currentColor\"></path>\n    <path d=\"M12 20c-1.6-2.2-1.6-4.2 0-6 1.6 1.8 1.6 3.8 0 6z\" fill=\"currentColor\"></path>\n    <path d=\"M4 12c2.2-1.6 4.2-1.6 6 0-1.8 1.6-3.8 1.6-6 0z\" fill=\"currentColor\"></path>\n    <circle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\"></circle>\n  </svg>\n  <div class=\"pane l\" id=\"i2L\"><i class=\"lat\"></i></div>\n  <div class=\"pane r\" id=\"i2R\"><i class=\"lat\"></i></div>\n</div>"},
{id:"K",css:"\n#bootK{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n/* 3D の器。overflow は根だけに置く（preserve-3d を壊さない） */\n#bootK .bk-stage{\n  position:absolute; left:50%; top:196px; width:264px; height:344px;\n  margin-left:-132px;\n  perspective:1200px; perspective-origin:50% 50%;\n}\n/* 紙の落ち影（面が揃うにつれて敷く） */\n#bootK .bk-cast{\n  position:absolute; inset:0; border-radius:16px; opacity:0;\n  box-shadow:0 2px 8px rgba(51,46,40,.07), 0 1px 2px rgba(51,46,40,.05);\n}\n#bootK .bk-sheet{\n  position:absolute; inset:0;\n  transform-style:preserve-3d;\n}\n#bootK .bk-panel{\n  position:absolute; display:block; background:var(--panel);\n  backface-visibility:hidden; opacity:0;\n}\n/* 段組み：縦 88px×3列／横 96 + 152 + 96 */\n#bootK .bk-mid{ left:88px; top:96px; width:88px; height:152px; }\n\n#bootK .bk-wing{ top:96px; width:88px; height:152px; }\n#bootK .bk-wl{ left:0;     transform-origin:100% 50%; transform:rotateY(-176deg); }\n#bootK .bk-wr{ left:176px; transform-origin:0 50%;    transform:rotateY(176deg); }\n\n#bootK .bk-flap{ left:0; width:264px; height:96px; }\n#bootK .bk-ft{ top:0;    border-radius:16px 16px 0 0; transform-origin:50% 100%; transform:rotateX(-176deg); }\n#bootK .bk-fb{ bottom:0; border-radius:0 0 16px 16px; transform-origin:50% 0;   transform:rotateX(176deg); }\n\n/* 折り目の陰：折り目側がわずかに沈む。ひらくにつれて薄れる */\n#bootK .bk-sh{\n  position:absolute; inset:0; display:block; border-radius:inherit; opacity:1;\n}\n#bootK .bk-wl .bk-sh{ background:linear-gradient(to left,  rgba(51,46,40,.10), rgba(51,46,40,0) 62%); }\n#bootK .bk-wr .bk-sh{ background:linear-gradient(to right, rgba(51,46,40,.10), rgba(51,46,40,0) 62%); }\n#bootK .bk-ft .bk-sh{ background:linear-gradient(to top,   rgba(51,46,40,.09), rgba(51,46,40,0) 62%); }\n#bootK .bk-fb .bk-sh{ background:linear-gradient(to bottom,rgba(51,46,40,.09), rgba(51,46,40,0) 62%); }\n\n/* 面が揃ってから乗る層 */\n#bootK .bk-ink{ position:absolute; inset:0; }\n#bootK .bk-crease{ position:absolute; display:block; background:rgba(51,46,40,.07); opacity:0; }\n#bootK .bk-cv{ top:10px; bottom:10px; width:1px; transform:scaleY(.4); transform-origin:50% 50%; }\n#bootK .bk-cv1{ left:88px; }\n#bootK .bk-cv2{ left:176px; }\n#bootK .bk-ch{ left:10px; right:10px; height:1px; transform:scaleX(.4); transform-origin:50% 50%; }\n#bootK .bk-ch1{ top:96px; }\n#bootK .bk-ch2{ top:248px; }\n\n#bootK .bk-title{\n  position:absolute; top:104px; left:132px; transform:translateX(-50%);\n  display:flex; flex-direction:column; align-items:center;\n  font-size:33px; line-height:1.28; letter-spacing:.06em; color:var(--fg);\n}\n#bootK .bk-title span{ display:block; opacity:0; }\n#bootK .bk-sub{\n  position:absolute; top:112px; left:92px;\n  display:flex; flex-direction:column; align-items:center;\n  font-size:12px; line-height:1.7; letter-spacing:.16em; color:var(--muted);\n}\n#bootK .bk-sub span{ display:block; opacity:0; }\n#bootK .bk-mark{\n  position:absolute; left:132px; top:262px; margin-left:-10px;\n  color:var(--acc); opacity:0;\n}\n",html:"<div class=\"boot\" id=\"bootK\" aria-hidden=\"true\">\n  <!-- 折り紙。左右の翼をひらき、次に天地の折り返しをひらいて1枚の面になる -->\n  <div class=\"bk-stage\">\n    <i class=\"bk-cast\"></i>\n\n    <div class=\"bk-sheet\">\n      <!-- 中央の帯（折り畳まれた芯） -->\n      <i class=\"bk-panel bk-mid\"></i>\n\n      <!-- 左右の翼（縦の折り目で開く） -->\n      <div class=\"bk-panel bk-wing bk-wl\"><i class=\"bk-sh\"></i></div>\n      <div class=\"bk-panel bk-wing bk-wr\"><i class=\"bk-sh\"></i></div>\n\n      <!-- 天地の折り返し（横の折り目で開く。外側の角に丸みを持たせる） -->\n      <div class=\"bk-panel bk-flap bk-ft\"><i class=\"bk-sh\"></i></div>\n      <div class=\"bk-panel bk-flap bk-fb\"><i class=\"bk-sh\"></i></div>\n    </div>\n\n    <!-- 面が揃ってから乗る層：折り目の跡と文字 -->\n    <div class=\"bk-ink\">\n      <i class=\"bk-crease bk-cv bk-cv1\"></i>\n      <i class=\"bk-crease bk-cv bk-cv2\"></i>\n      <i class=\"bk-crease bk-ch bk-ch1\"></i>\n      <i class=\"bk-crease bk-ch bk-ch2\"></i>\n\n      <div class=\"bk-title\"><span>宅</span><span>建</span></div>\n      <div class=\"bk-sub\"><span>一</span><span>問</span><span>一</span><span>答</span></div>\n\n      <div class=\"bk-mark\">\n        <svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\"\n             stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n          <path d=\"M4.5 4.5h15v15h-15z\"></path>\n          <path d=\"M4.5 4.5 19.5 19.5\"></path>\n          <path d=\"M12 4.5 4.5 12\"></path>\n        </svg>\n      </div>\n    </div>\n  </div>\n</div>"},
{id:"L",css:"\n#bootL{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n/* 3D の器。根だけが overflow を持つ（preserve-3d を壊さない） */\n#bootL .bl-stage{\n  position:absolute; left:50%; top:186px; width:304px; height:388px;\n  margin-left:-152px;\n  perspective:1500px; perspective-origin:50% 46%;\n  transform-style:preserve-3d;\n}\n#bootL .bl-page, #bootL .bl-face{\n  position:absolute; top:0; width:152px; height:388px;\n  background:var(--panel); opacity:0;\n}\n#bootL .bl-left{ left:0;    border-radius:16px 0 0 16px; box-shadow:-1px 1px 2px rgba(51,46,40,.045); }\n#bootL .bl-under{ left:152px; border-radius:0 16px 16px 0; box-shadow:1px 1px 2px rgba(51,46,40,.045); }\n\n/* 頁の罫線。綴じ目の側から引く */\n#bootL .bl-rules{\n  position:absolute; left:20px; right:20px; top:52px; height:286px; display:block;\n  background-image:repeating-linear-gradient(to bottom,\n    var(--line) 0, var(--line) 1px, transparent 1px, transparent 26px);\n}\n#bootL .bl-left .bl-rules{ transform:scaleX(0); transform-origin:100% 50%; }\n#bootL .bl-under .bl-rules, #bootL .bl-front .bl-rules{ transform:scaleX(0); transform-origin:0 50%; }\n#bootL .bl-under .bl-rules{ opacity:.6; }\n#bootL .bl-rules-b{ opacity:.45; transform:none; }\n\n/* 綴じ目の陰（次の頁の内側） */\n#bootL .bl-gut{\n  position:absolute; left:0; top:0; bottom:0; width:26px; display:block;\n  background:linear-gradient(to right, rgba(51,46,40,.075), rgba(51,46,40,0));\n}\n/* めくる葉が左頁に落とす影 */\n#bootL .bl-cast{\n  position:absolute; inset:0; display:block; border-radius:inherit; opacity:0;\n  background:linear-gradient(to left, rgba(51,46,40,.16), rgba(51,46,40,.03) 58%, rgba(51,46,40,0));\n}\n#bootL .bl-spine{\n  position:absolute; left:152px; top:26px; bottom:26px; width:1px; display:block;\n  background:var(--line); opacity:0;\n}\n\n/* 一葉。綴じ目（左端）を軸に倒れる */\n#bootL .bl-leaf{\n  position:absolute; left:152px; top:0; width:152px; height:388px;\n  transform-style:preserve-3d; transform-origin:0 50%;\n  transform:rotateY(0deg);\n}\n#bootL .bl-face{ left:0; backface-visibility:hidden; }\n#bootL .bl-front{ border-radius:0 16px 16px 0; box-shadow:1px 1px 3px rgba(51,46,40,.05); }\n#bootL .bl-back{\n  border-radius:16px 0 0 16px; transform:rotateY(180deg);\n  box-shadow:-1px 1px 3px rgba(51,46,40,.06);\n}\n\n/* 裏の墨の透け（左右が返るので鏡像で置く） */\n#bootL .bl-bleed{\n  position:absolute; top:112px; left:64px; transform:translateX(-50%) scaleX(-1);\n  display:flex; flex-direction:column; align-items:center;\n  font-size:32px; line-height:1.3; letter-spacing:.06em;\n  color:var(--fg); opacity:0;\n}\n#bootL .bl-bleed span{ display:block; }\n\n#bootL .bl-title{\n  position:absolute; top:112px; left:92px; transform:translateX(-50%);\n  display:flex; flex-direction:column; align-items:center;\n  font-size:32px; line-height:1.3; letter-spacing:.06em; color:var(--fg);\n}\n#bootL .bl-title span{ display:block; opacity:0; }\n#bootL .bl-sub{\n  position:absolute; top:120px; left:52px; transform:translateX(-50%);\n  display:flex; flex-direction:column; align-items:center;\n  font-size:12px; line-height:1.75; letter-spacing:.16em; color:var(--muted);\n}\n#bootL .bl-sub span{ display:block; opacity:0; }\n/* 題の下に一本、桜の細い罫 */\n#bootL .bl-hair{\n  position:absolute; left:74px; width:36px; top:262px; height:1px; display:block;\n  background:var(--acc); opacity:0; transform:scaleX(0); transform-origin:50% 50%;\n}\n#bootL .bl-ribbon{\n  position:absolute; right:22px; top:0; color:var(--acc); opacity:0;\n}\n",html:"<div class=\"boot\" id=\"bootL\" aria-hidden=\"true\">\n  <!-- 頁をめくる。右の一葉が弧を描いて左へ倒れ、その裏に題が現れる -->\n  <div class=\"bl-stage\">\n    <!-- 左頁（見開きの受け） -->\n    <div class=\"bl-page bl-left\">\n      <i class=\"bl-rules\"></i>\n      <i class=\"bl-cast\"></i>\n    </div>\n\n    <!-- めくった先に現れる次の頁 -->\n    <div class=\"bl-page bl-under\">\n      <i class=\"bl-rules\"></i>\n      <i class=\"bl-gut\"></i>\n      <div class=\"bl-ribbon\">\n        <svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\"\n             stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n          <path d=\"M7 3.5h10v17l-5-4-5 4z\"></path>\n        </svg>\n      </div>\n    </div>\n\n    <!-- めくれる一葉 -->\n    <div class=\"bl-leaf\">\n      <div class=\"bl-face bl-front\">\n        <i class=\"bl-rules\"></i>\n        <!-- 紙の裏の透け（裏の墨がうっすら映る） -->\n        <div class=\"bl-bleed\"><span>宅</span><span>建</span></div>\n      </div>\n      <div class=\"bl-face bl-back\">\n        <i class=\"bl-rules bl-rules-b\"></i>\n        <div class=\"bl-title\"><span>宅</span><span>建</span></div>\n        <div class=\"bl-sub\"><span>一</span><span>問</span><span>一</span><span>答</span></div>\n        <i class=\"bl-hair\"></i>\n      </div>\n    </div>\n\n    <i class=\"bl-spine\"></i>\n  </div>\n</div>"},
{id:"N",css:"\n#bootN{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  font-variant-numeric:tabular-nums;\n  -webkit-font-smoothing:antialiased;\n}\n#bootN .bn-grain{position:absolute; inset:0; width:393px; height:760px; display:block}\n#bootN .bn-field{position:absolute; inset:0}\n\n/* 1字＝80pxの箱を中心に置き、transformで散らす／寄せる */\n#bootN .bn-c{\n  position:absolute; left:50%; top:50%;\n  width:80px; height:80px; margin:-40px 0 0 -40px;\n  display:flex; align-items:center; justify-content:center;\n  font-size:25px; line-height:1; color:var(--muted);\n  opacity:0; will-change:transform,opacity;\n}\n#bootN .bn-hero{font-size:26px}\n\n#bootN .bn-rule{\n  position:absolute; left:50%; top:calc(50% + 62px);\n  width:58px; height:1px; margin-left:-29px;\n  background:var(--acc); opacity:0;\n  transform:scaleX(0);\n}\n",html:"<div class=\"boot\" id=\"bootN\" aria-hidden=\"true\">\n  <!-- 和紙の地（自作の紙目・外部画像なし） -->\n  <svg class=\"bn-grain\" viewBox=\"0 0 393 760\" preserveAspectRatio=\"none\" aria-hidden=\"true\">\n    <defs>\n      <filter id=\"bn-fiber\" x=\"0\" y=\"0\" width=\"100%\" height=\"100%\">\n        <feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"3\" seed=\"23\"/>\n        <feColorMatrix type=\"saturate\" values=\"0\"/>\n      </filter>\n      <radialGradient id=\"bn-vig\" cx=\"50%\" cy=\"47%\" r=\"74%\">\n        <stop offset=\"50%\" stop-color=\"#f6f2ec\" stop-opacity=\"0\"/>\n        <stop offset=\"100%\" stop-color=\"#e8e0d8\" stop-opacity=\"0.5\"/>\n      </radialGradient>\n    </defs>\n    <rect width=\"393\" height=\"760\" fill=\"#f6f2ec\"/>\n    <rect width=\"393\" height=\"760\" filter=\"url(#bn-fiber)\" opacity=\"0.05\"/>\n    <rect width=\"393\" height=\"760\" fill=\"url(#bn-vig)\"/>\n  </svg>\n\n  <!-- 散らばった字はscriptが固定表から組む（乱数なし＝毎回同じ動き） -->\n  <div class=\"bn-field\" id=\"bnField\"></div>\n\n  <!-- 定まった二文字の下に引く細い一本 -->\n  <i class=\"bn-rule\" id=\"bnRule\"></i>\n</div>"},
{id:"O",css:"\n#bootO{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n/* 砂時計 */\n#bootO .bo-glass{\n  position:absolute; left:50%; top:256px; width:80px; height:80px;\n  margin-left:-40px; color:var(--fg); opacity:0;\n}\n#bootO .bo-glass svg{display:block}\n#bootO .bo-sand{\n  opacity:.22;\n  transform-box:view-box; transform-origin:12px 12px;\n}\n/* くびれの真下に落ちる筋（下端は消えていく） */\n#bootO .bo-stream{\n  position:absolute; left:50%; top:296px; width:1px; height:70px;\n  margin-left:-.5px; opacity:0;\n  background:linear-gradient(to bottom, rgba(51,46,40,.34), rgba(51,46,40,0));\n  transform:scaleY(0); transform-origin:50% 0;\n}\n/* 砂粒 */\n#bootO .bo-grains{position:absolute; left:0; top:0; width:393px; height:760px}\n#bootO .bo-grains i{\n  position:absolute; left:50%; top:300px; width:2px; height:2px;\n  margin-left:-1px; border-radius:50%; background:var(--fg); opacity:0;\n}\n/* 数字。ghost＝これから積もる器、fill＝積もった砂 */\n#bootO .bo-num{\n  position:absolute; left:0; right:0; top:372px; height:84px;\n  text-align:center;\n}\n#bootO .bo-num span{\n  position:absolute; left:0; right:0; top:0;\n  font-size:116px; line-height:84px; letter-spacing:.01em;\n  font-variant-numeric:tabular-nums; font-feature-settings:\"tnum\" 1;\n}\n#bootO .bo-ghost{color:var(--line); opacity:0}\n#bootO .bo-fill{\n  color:var(--fg);\n  -webkit-clip-path:inset(100% 0 0 0); clip-path:inset(100% 0 0 0);\n}\n/* 積もった砂の裾 */\n#bootO .bo-mound{\n  position:absolute; left:50%; top:462px; width:168px; height:12px;\n  margin-left:-84px; opacity:0;\n  background:radial-gradient(60% 100% at 50% 100%, rgba(51,46,40,.5), rgba(51,46,40,0) 72%);\n  transform:scaleX(.18); transform-origin:50% 100%;\n}\n#bootO .bo-cap{\n  position:absolute; left:0; right:0; top:492px; text-align:center;\n  font-size:12px; letter-spacing:.34em; text-indent:.34em;\n  color:var(--muted); opacity:0;\n}\n",html:"<div class=\"boot\" id=\"bootO\" aria-hidden=\"true\">\n  <!-- 砂時計（単色の細い線画）。砂は上の室から落ち、下で数字の形に積もる -->\n  <div class=\"bo-glass\">\n    <svg viewBox=\"0 0 24 24\" width=\"80\" height=\"80\" fill=\"none\" stroke=\"currentColor\"\n         stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n      <!-- 天板・地板 -->\n      <path d=\"M6 2.6h12\"></path>\n      <path d=\"M6 21.4h12\"></path>\n      <!-- 上の室（くびれへ絞る） -->\n      <path d=\"M8 2.6C8 7 12 8.4 12 12\"></path>\n      <path d=\"M16 2.6C16 7 12 8.4 12 12\"></path>\n      <!-- 下の室 -->\n      <path d=\"M8 21.4C8 17 12 15.6 12 12\"></path>\n      <path d=\"M16 21.4C16 17 12 15.6 12 12\"></path>\n      <!-- 上の室に残る砂（くびれへ向かって縮む） -->\n      <path class=\"bo-sand\" d=\"M8 2.6C8 7 12 8.4 12 12 12 8.4 16 7 16 2.6Z\"\n            fill=\"currentColor\" stroke=\"none\"></path>\n    </svg>\n  </div>\n\n  <!-- くびれから落ちる細い筋 -->\n  <i class=\"bo-stream\"></i>\n  <!-- 落ちる砂粒 -->\n  <div class=\"bo-grains\">\n    <i></i><i></i><i></i><i></i><i></i><i></i>\n    <i></i><i></i><i></i><i></i><i></i><i></i>\n  </div>\n\n  <!-- 下で積もって数字になる -->\n  <div class=\"bo-num\">\n    <span class=\"bo-ghost\">61</span>\n    <span class=\"bo-fill\">61</span>\n  </div>\n  <i class=\"bo-mound\"></i>\n  <div class=\"bo-cap\">試験まで</div>\n</div>"},
{id:"P",css:"\n#bootP{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n#bootP .bp-cap{\n  position:absolute; left:0; right:0; top:262px; text-align:center;\n  font-size:12px; letter-spacing:.34em; text-indent:.34em;\n  color:var(--muted); opacity:0;\n}\n#bootP .bp-row{\n  position:absolute; left:0; right:0; top:300px;\n  display:flex; justify-content:center; align-items:flex-end; gap:10px;\n}\n/* 板の箱。奥行きは浅く取り、金属光沢は使わない */\n#bootP .bp-unit{\n  position:relative; width:92px; height:124px;\n  border-radius:8px;\n  box-shadow:0 1px 2px rgba(51,46,40,.05);\n  -webkit-perspective:520px; perspective:520px;\n  opacity:0;\n}\n#bootP .bp-half{\n  position:absolute; left:0; width:92px; height:62px;\n  background:var(--panel); overflow:hidden;\n  -webkit-backface-visibility:hidden; backface-visibility:hidden;\n}\n#bootP .bp-t{top:0;  border-radius:8px 8px 0 0}\n#bootP .bp-b{top:62px; border-radius:0 0 8px 8px}\n/* 数字は板をまたぐ一文字。上半分／下半分で同じ字を切って見せる */\n#bootP .bp-d{\n  position:absolute; left:0; width:92px; height:124px;\n  font-size:96px; line-height:124px; text-align:center;\n  color:var(--fg); letter-spacing:0;\n  font-variant-numeric:tabular-nums; font-feature-settings:\"tnum\" 1;\n}\n#bootP .bp-t .bp-d{top:0}\n#bootP .bp-b .bp-d{top:-62px}\n/* めくれる板。上の板は下辺、下の板は上辺が蝶番 */\n#bootP .bp-leaf{z-index:5; opacity:0}\n#bootP .bp-lt{-webkit-transform-origin:50% 100%; transform-origin:50% 100%}\n#bootP .bp-lb{-webkit-transform-origin:50% 0;    transform-origin:50% 0}\n/* 蝶番の筋と、板の縁 */\n#bootP .bp-hinge{\n  position:absolute; left:0; top:61px; width:92px; height:1px;\n  background:var(--line); z-index:6;\n}\n#bootP .bp-edge{\n  position:absolute; left:0; top:0; width:92px; height:124px;\n  box-sizing:border-box; border:1px solid var(--line);\n  border-radius:8px; z-index:6; pointer-events:none;\n}\n#bootP .bp-ji{\n  margin-bottom:19px; font-size:19px; color:var(--muted);\n  letter-spacing:.02em; opacity:0;\n}\n",html:"<div class=\"boot\" id=\"bootP\" aria-hidden=\"true\">\n  <div class=\"bp-cap\">試験まで</div>\n\n  <!-- 発車標のようなめくり板。上半分の板が前へ倒れ、下半分の板が起き上がって次の数字になる -->\n  <div class=\"bp-row\">\n    <div class=\"bp-unit\" data-unit=\"t\">\n      <div class=\"bp-half bp-t bp-st\"><span class=\"bp-d\">2</span></div>\n      <div class=\"bp-half bp-b bp-sb\"><span class=\"bp-d\">2</span></div>\n      <div class=\"bp-half bp-t bp-leaf bp-lt\"><span class=\"bp-d\">2</span></div>\n      <div class=\"bp-half bp-b bp-leaf bp-lb\"><span class=\"bp-d\">2</span></div>\n      <i class=\"bp-hinge\"></i>\n      <i class=\"bp-edge\"></i>\n    </div>\n\n    <div class=\"bp-unit\" data-unit=\"o\">\n      <div class=\"bp-half bp-t bp-st\"><span class=\"bp-d\">5</span></div>\n      <div class=\"bp-half bp-b bp-sb\"><span class=\"bp-d\">5</span></div>\n      <div class=\"bp-half bp-t bp-leaf bp-lt\"><span class=\"bp-d\">5</span></div>\n      <div class=\"bp-half bp-b bp-leaf bp-lb\"><span class=\"bp-d\">5</span></div>\n      <i class=\"bp-hinge\"></i>\n      <i class=\"bp-edge\"></i>\n    </div>\n\n    <div class=\"bp-ji\">日</div>\n  </div>\n</div>"},
{id:"Q",css:"\n#bootQ{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n/* 角丸16pxの面。格子(271px)＋余白20px */\n#bootQ .bq-panel{\n  position:absolute; left:41px; top:224px; width:311px; height:311px;\n  border-radius:16px; background:var(--panel);\n  box-shadow:0 1px 2px rgba(51,46,40,.05);\n  opacity:0;\n}\n#bootQ .bq-lattice{\n  position:absolute; left:20px; top:20px; width:271px; height:271px;\n}\n/* 桟。組む前は長さ0（原点は案ごとにJSで振り分ける） */\n#bootQ .bq-v{\n  position:absolute; top:0; width:1px; height:271px;\n  background:var(--line); transform:scaleY(0);\n}\n#bootQ .bq-h{\n  position:absolute; left:0; height:1px; width:271px;\n  background:var(--line); transform:scaleX(0);\n}\n/* 中央のひと枠。格子線の上にちょうど重なる（96..175） */\n#bootQ .bq-pane{\n  position:absolute; left:96px; top:96px; width:79px; height:79px;\n  box-sizing:border-box; border:1px solid var(--acc);\n  opacity:0;\n}\n#bootQ .bq-slot{\n  position:absolute; left:96px; top:96px; width:79px; height:79px;\n  display:flex; align-items:center; justify-content:center;\n}\n#bootQ .bq-kanji, #bootQ .bq-days{ display:none; align-items:baseline }\n#bootQ .bq-slot.is-kanji .bq-kanji{ display:flex }\n#bootQ .bq-slot.is-days  .bq-days{ display:flex }\n\n#bootQ .bq-kanji span{\n  display:block; font-size:29px; line-height:1; letter-spacing:.04em;\n  color:var(--fg); opacity:0;\n}\n#bootQ .bq-days b{\n  font-weight:400; font-size:33px; line-height:1; color:var(--fg);\n  font-variant-numeric:tabular-nums; font-feature-settings:\"tnum\" 1;\n  letter-spacing:.01em; opacity:0;\n}\n#bootQ .bq-days em{\n  font-style:normal; font-size:13px; line-height:1; color:var(--muted);\n  margin-left:5px; opacity:0;\n}\n",html:"<div class=\"boot\" id=\"bootQ\" aria-hidden=\"true\">\n  <div class=\"bq-panel\">\n\n    <!-- 組子の格子。縦6本・横6本。中央だけ枠を広く取ってある（0/48/96/174/222/270） -->\n    <div class=\"bq-lattice\">\n      <i class=\"bq-v\" data-i=\"0\" style=\"left:0px\"></i>\n      <i class=\"bq-v\" data-i=\"1\" style=\"left:48px\"></i>\n      <i class=\"bq-v\" data-i=\"2\" style=\"left:96px\"></i>\n      <i class=\"bq-v\" data-i=\"3\" style=\"left:174px\"></i>\n      <i class=\"bq-v\" data-i=\"4\" style=\"left:222px\"></i>\n      <i class=\"bq-v\" data-i=\"5\" style=\"left:270px\"></i>\n\n      <i class=\"bq-h\" data-i=\"0\" style=\"top:0px\"></i>\n      <i class=\"bq-h\" data-i=\"1\" style=\"top:48px\"></i>\n      <i class=\"bq-h\" data-i=\"2\" style=\"top:96px\"></i>\n      <i class=\"bq-h\" data-i=\"3\" style=\"top:174px\"></i>\n      <i class=\"bq-h\" data-i=\"4\" style=\"top:222px\"></i>\n      <i class=\"bq-h\" data-i=\"5\" style=\"top:270px\"></i>\n\n      <!-- 中央のひと枠（桜の細枠）と、そこに収まる字 -->\n      <i class=\"bq-pane\"></i>\n      <div class=\"bq-slot\">\n        <div class=\"bq-kanji\"><span>宅</span><span>建</span></div>\n        <div class=\"bq-days\"><b>61</b><em>日</em></div>\n      </div>\n    </div>\n\n  </div>\n</div>"},
{id:"R",css:"\n#bootR{\n  --bg:#f6f2ec; --panel:#fdfbf7; --fg:#332e28; --muted:#8a8074;\n  --acc:#c98b9b; --accd:#a9647a; --line:#e8e0d8;\n  --mincho:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",\"YuMincho\",serif;\n  position:relative; width:393px; height:760px; overflow:hidden;\n  background:var(--bg); color:var(--fg);\n  font-family:var(--mincho);\n  -webkit-font-smoothing:antialiased;\n}\n#bootR .br-card{\n  position:absolute; left:50%; top:170px; margin-left:-150px;\n  width:300px; height:420px; border-radius:16px;\n  background:var(--panel); box-shadow:0 1px 2px rgba(51,46,40,.05);\n  overflow:hidden; opacity:0;\n}\n\n/* ---- 奥の画面 ---- */\n#bootR .br-back{ position:absolute; inset:0 }\n#bootR .br-kanji, #bootR .br-days{\n  position:absolute; left:0; right:0; top:186px;\n  display:none; align-items:baseline; justify-content:center;\n}\n#bootR .br-card.is-kanji .br-kanji{ display:flex }\n#bootR .br-card.is-days  .br-days{ display:flex }\n#bootR .br-kanji span{\n  display:block; font-size:34px; line-height:1; letter-spacing:.16em;\n  color:var(--fg); opacity:0;\n}\n#bootR .br-days b{\n  font-weight:400; font-size:44px; line-height:1; color:var(--fg);\n  font-variant-numeric:tabular-nums; font-feature-settings:\"tnum\" 1;\n  letter-spacing:.01em; opacity:0;\n}\n#bootR .br-days em{\n  font-style:normal; font-size:15px; line-height:1; color:var(--muted);\n  margin-left:7px; opacity:0;\n}\n/* 字の下の細い罫（一問一答の地） */\n#bootR .br-hair{\n  position:absolute; left:96px; width:108px; top:238px; height:1px;\n  background:var(--acc); transform:scaleX(0); transform-origin:50% 50%; opacity:0;\n}\n\n/* ---- 簾 ---- */\n#bootR .br-blind{ position:absolute; inset:0 }\n/* 奥を隠す面。下端が上がるほど奥が出る */\n#bootR .br-scrim{\n  position:absolute; inset:0; background:#faf6f0;   /* 簾は奥をわずかに陰らせる */\n  clip-path:inset(0 0 18px 0);\n}\n#bootR .br-slats{ position:absolute; inset:0 }\n#bootR .br-slat{\n  position:absolute; left:0; right:0; height:1px; background:var(--line);\n}\n#bootR .br-slat.br-foot{\n  height:2px; background:var(--muted); opacity:.34;\n}\n#bootR .br-cord{\n  position:absolute; top:12px; width:1px; height:390px;\n  background:var(--line); transform-origin:50% 0%; opacity:.85;\n}\n",html:"<div class=\"boot\" id=\"bootR\" aria-hidden=\"true\">\n  <div class=\"br-card\">\n\n    <!-- 簾の奥にある画面（字はここ） -->\n    <div class=\"br-back\">\n      <div class=\"br-kanji\"><span>宅</span><span>建</span></div>\n      <div class=\"br-days\"><b>61</b><em>日</em></div>\n      <i class=\"br-hair\"></i>\n    </div>\n\n    <!-- 簾。scrim＝奥を隠す面、slats＝横の細い桟、cord＝左右の糸 -->\n    <div class=\"br-blind\">\n      <i class=\"br-scrim\"></i>\n      <div class=\"br-slats\"></div>\n      <i class=\"br-cord\" style=\"left:90px\"></i>\n      <i class=\"br-cord\" style=\"left:210px\"></i>\n    </div>\n\n  </div>\n</div>"},
{id:"S",css:"\n/* ===== 宅建アプリ 起動演出 S ／ 和紙の繊維のような点が寄り集まって「宅建」の字になる =====\n   ・字は動かない（動くのは点だけ）\n   ・乱数なし＝毎回まったく同じ動き（散らばりは黄金角、字形は明朝の芯に等間隔）\n   ・点は最大120個（超えないよう粒の間隔を自動で広げる）\n   ・所要 約2.03秒 → 最後は和紙の地だけ                                                  */\n\n.bs{\n  --bg:#f6f2ec; --panel:#fdfbf7; --txt:#332e28; --sub:#8a8074;\n  --sakura:#c98b9b; --sakura2:#a9647a; --line:#e8e0d8;\n  --fm:\"Zen Old Mincho\",\"Hiragino Mincho ProN\",\"Yu Mincho\",YuMincho,\"Noto Serif JP\",serif;\n\n  position:fixed; inset:0; z-index:9999;\n  display:flex; align-items:center; justify-content:center;\n  background:var(--bg); color:var(--txt);\n  font-family:var(--fm); -webkit-font-smoothing:antialiased;\n  overflow:hidden; pointer-events:none;\n}\n\n/* 和紙の地（自己完結のSVGノイズ・外部画像なし） */\n.bs > .bs-grain{\n  position:absolute; inset:-20px; pointer-events:none; opacity:.055;\n  mix-blend-mode:multiply;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\");\n  background-size:140px 140px;\n}\n\n.bs-stage{\n  position:relative; display:flex; flex-direction:column; align-items:center;\n  transform:translateY(-16px);\n}\n\n/* 点が集まる盤面（この中の座標＝字形の座標） */\n.bs-field{\n  position:relative; width:250px; height:124px;\n}\n\n/* 一粒の繊維 */\n.bs-field > i{\n  position:absolute; width:4.3px; height:4.3px; margin:-2.15px 0 0 -2.15px;\n  border-radius:50%; background:var(--txt);\n  opacity:0; will-change:transform,opacity;\n}\n.bs-field > i.bs-p{ background:var(--sakura); }   /* ごく僅かに桜を混ぜる */\n\n/* 桜の罫（点が字になった瞬間だけ） */\n.bs-rule{width:56px; height:1px; margin:26px 0 0; overflow:hidden}\n.bs-rule > i{\n  display:block; width:100%; height:100%; background:var(--sakura);\n  transform:scaleX(0); transform-origin:50% 50%;\n  transition:transform .1s linear;\n}\n.bs.is-land .bs-rule > i{\n  transform:scaleX(1);\n  transition:transform .40s cubic-bezier(.16,.84,.24,1);\n}\n.bs.is-loose .bs-rule > i{\n  transform:scaleX(0);\n  transition:transform .40s cubic-bezier(.4,0,.7,.4);\n}\n\n.bs-sig{\n  margin:13px -.30em 0 0; font-size:11.5px; letter-spacing:.30em; color:var(--sub);\n  opacity:0; transition:opacity .1s linear;\n}\n.bs.is-land .bs-sig{opacity:.9; transition:opacity .34s ease .04s}\n.bs.is-loose .bs-sig{opacity:0; transition:opacity .34s ease}\n\n@media (max-height:700px){\n  .bs-stage{transform:translateY(-8px)}\n}\n",html:"<div class=\"bs\" id=\"bootS\" aria-hidden=\"true\">\n  <i class=\"bs-grain\"></i>\n  <div class=\"bs-stage\">\n    <div class=\"bs-field\" id=\"bs-field\"></div>\n    <div class=\"bs-rule\"><i></i></div>\n    <div class=\"bs-sig\">一問一答</div>\n  </div>\n</div>"}];

(function(){
  var EXAM = '2026-10-18';           /* 令和8年度 宅建試験（10月第3日曜） */
  var boot = document.getElementById('bootB');
  var numEl = document.getElementById('bB-num');
  var dateEl = document.getElementById('bB-date');
  if(!boot || !numEl) return;

  var timers = [], raf = 0;

  function daysLeft(){
    var p = EXAM.split('-');
    var goal = new Date(+p[0], +p[1]-1, +p[2]);
    var n = new Date(), today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var d = Math.round((goal - today) / 86400000);
    if(!isFinite(d) || d < 0) d = 0;
    return d;
  }
  function examLabel(){
    var p = EXAM.split('-');
    var d = new Date(+p[0], +p[1]-1, +p[2]);
    var w = '日月火水木金土'[d.getDay()];
    return (+p[1]) + '月' + (+p[2]) + '日（' + w + '）';
  }
  function build(v){
    var s = String(v), h = '';
    for(var i=0;i<s.length;i++) h += '<span class="bB-d">' + s[i] + '</span>';
    numEl.innerHTML = h;
  }
  function setVal(v){
    var s = String(v), ds = numEl.children;
    if(ds.length !== s.length){ build(v); return; }
    for(var i=0;i<s.length;i++) if(ds[i].textContent !== s[i]) ds[i].textContent = s[i];
  }
  /* 止め方で品を出す：刻みの間隔を終盤に向けて等比で広げ、
     最後の数字がちょうど回し終わりに来る表を作る（最初は1コマで飛ぶ＝素早く回る） */
  function schedule(target, dur){
    var r = 1.18, n = target > 0 ? target : 1, g = [], s = 0, i;
    for(i = 0; i < n; i++){ g[i] = Math.pow(r, -i); s += g[i]; }   /* g[0]=最後の間隔 */
    var t = new Array(target + 1);
    t[target] = dur;
    for(i = 0; i < n; i++){
      var k = target - 1 - i;
      if(k >= 0) t[k] = t[k + 1] - dur * g[i] / s;
    }
    t[0] = 0;                                                      /* 誤差の吸収 */
    return t;
  }

  function clearAll(){
    for(var i=0;i<timers.length;i++) clearTimeout(timers[i]);
    timers = [];
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
  }
  function at(ms, fn){ timers.push(setTimeout(fn, ms)); }

  function play(){
    clearAll();

    var target = daysLeft();
    var slow = false;
    try{ slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

    var START = 170,                       /* 地とカードが立ち上がる間 */
        DUR   = slow ? 220 : 980,          /* 0→目標を回す時間 */
        HOLD  = slow ? 520 : 400,          /* 収まってからの静止 */
        OUT   = 430;                       /* 和紙の地へ消える */

    /* 初期化（何度でも最初から） */
    boot.className = 'boot';
    boot.style.display = '';
    numEl.style.filter = 'none';
    numEl.style.opacity = '';
    numEl.style.minWidth = (String(target).length * 0.58) + 'em';
    dateEl.textContent = examLabel();
    build(0);
    void boot.offsetWidth;                 /* リフローで遷移を確実に再生 */

    boot.classList.add('is-in');

    var sched = schedule(target, DUR);
    var t0 = 0, cur = 0, landed = false;
    function land(){
      if(landed) return;
      landed = true;
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
      setVal(target);
      numEl.style.filter = 'none';
      numEl.style.opacity = '1';
      boot.classList.add('is-land');
    }
    function step(ts){
      if(!t0) t0 = ts;
      var el = ts - t0;
      while(cur < target && sched[cur + 1] <= el) cur++;
      setVal(cur);
      var q = el / DUR; if(q > 1) q = 1;
      var b = 3.0 * Math.pow(1 - q, 1.8);  /* 速いうちは滲ませ、止まるにつれ澄む */
      numEl.style.filter = b > .06 ? 'blur(' + b.toFixed(2) + 'px)' : 'none';
      numEl.style.opacity = (0.74 + 0.26 * q).toFixed(3);
      if(el < DUR) raf = requestAnimationFrame(step);
      else land();
    }

    at(START, function(){ t0 = 0; raf = requestAnimationFrame(step); });
    at(START + DUR + 40, land);            /* 非表示タブ等でrAFが来なくても必ず着地させる */
    at(START + DUR + HOLD, function(){ boot.classList.add('is-out'); });
    at(START + DUR + HOLD + OUT, function(){
      boot.style.display = 'none';
      boot.classList.remove('is-in','is-land','is-out');
    });
  }

  window.playBoot_B = play;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play);
  else play();
})();


(function(){
  var root = document.getElementById('bootD');
  if(!root) return;
  var page  = root.querySelector('.bd-page');
  var edges = [].slice.call(root.querySelectorAll('.bd-edge'));
  var rules = [].slice.call(root.querySelectorAll('.bd-rule'));
  var chars = [].slice.call(root.querySelectorAll('.bd-title span'));
  var subs  = [].slice.call(root.querySelectorAll('.bd-sub span'));
  var seal  = root.querySelector('.bd-seal');

  var EO = 'cubic-bezier(.2,.85,.3,1)';   // 出現
  var EI = 'cubic-bezier(.45,.02,.75,1)'; // 退場
  var running = [];

  /* fill='both' は登場用。退場は out()＝'forwards'（開始前に逆fillで先出しさせない） */
  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an);
    return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.playBoot_D = function(){
    reset();

    /* 動きを減らす設定のときは、ひらく／閉じるだけ（総尺 1.62s） */
    if(reduced()){
      a(page, [{opacity:0},{opacity:1}], 400, 0);
      rules.concat(edges).forEach(function(el){
        a(el, [{opacity:0, transform:'none'},{opacity:1, transform:'none'}], 400, 60);
      });
      chars.concat(subs).forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 400, 120); });
      a(seal, [{opacity:0},{opacity:.55}], 400, 160);
      out(page, [{opacity:1},{opacity:0}], 420, 1200);
      return;
    }

    /* ① 紙がひらく（面が出て、天地の罫が右から引かれる） */
    a(page, [{opacity:0, transform:'scale(.986)'},{opacity:1, transform:'scale(1)'}], 450, 0);
    edges.forEach(function(el){
      a(el, [{transform:'scaleX(0)'},{transform:'scaleX(1)'}], 400, 100);
    });

    /* ② 縦の界線が上から降りて並ぶ（右端から左へ送る） */
    rules.forEach(function(el, i){
      var k = rules.length - 1 - i;                     // 右端＝0
      var shu = el.classList.contains('bd-rule-shu');   // 朱引きは少しゆっくり、色は控える
      a(el, [{transform:'scaleY(0)', opacity:0},
             {transform:'scaleY(1)', opacity:shu ? .72 : 1}],
        shu ? 560 : 460, 180 + k*46);
    });

    /* ③ 文字が右から縦に立ち上がる（大字→小字→落款） */
    chars.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateX(13px)'},
             {opacity:1, transform:'translateX(0)'}], 520, 520 + i*125);
    });
    subs.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateX(8px)'},
             {opacity:1, transform:'translateX(0)'}], 440, 930 + i*55);
    });
    a(seal, [{opacity:0, transform:'scale(.82)'},
             {opacity:.55, transform:'scale(1)'}], 400, 1120);

    /* ④ 紙が閉じる：文字が退き、界線が上へ引かれて消える */
    var OUT = 1480;
    chars.concat(subs).forEach(function(el){
      out(el, [{opacity:1, transform:'translateY(0)'},
               {opacity:0, transform:'translateY(-5px)'}], 320, OUT);
    });
    out(seal, [{opacity:.55},{opacity:0}], 300, OUT);
    rules.forEach(function(el, i){
      out(el, [{transform:'scaleY(1)'},{transform:'scaleY(0)'}], 320, OUT + 60 + i*36);
    });
    edges.forEach(function(el){
      out(el, [{transform:'scaleX(1)'},{transform:'scaleX(0)'}], 280, OUT + 250);
    });
    /* 最後は和紙の地に消える（総尺 2.12s） */
    out(page, [{opacity:1},{opacity:0}], 380, 1740);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_D(); });
  }else{
    window.playBoot_D();
  }
})();


(function(){
  var EO='cubic-bezier(.2,.85,.25,1)', EI='cubic-bezier(.4,0,.7,.2)';
  function A(el,f,ms,d,e){return el&&el.animate?el.animate(f,{duration:ms,delay:d||0,
    easing:e||EO,fill:'forwards'}):null}
  window.playBoot_I2=function(){
    var root=document.getElementById('bootI2');
    if(root&&root.getAnimations)root.getAnimations({subtree:true}).forEach(function(a){a.cancel()});
    var L=document.getElementById('i2L'),R=document.getElementById('i2R');
    L.style.transform='none';R.style.transform='none';
    /* ① 障子が開く（少し重みを付けて） */
    A(L,[{transform:'none'},{transform:'translateX(-100%)'}],760,180,EO);
    A(R,[{transform:'none'},{transform:'translateX(100%)'}],760,180,EO);
    /* ② 開いた奥から中身が立ち上がる＝ここが前回の「簡素すぎる」の直し */
    A(document.getElementById('i2Ttl'),[{opacity:0,transform:'translateY(10px)'},
      {opacity:1,transform:'none'}],420,520,EO);
    A(document.getElementById('i2Days'),[{opacity:0,transform:'translateY(14px) scale(.96)'},
      {opacity:1,transform:'none'}],460,660,EO);
    A(document.getElementById('i2Rule'),[{width:'0px'},{width:'188px'}],520,820,EO);
    A(document.getElementById('i2Note'),[{opacity:0},{opacity:1}],380,960,EO);
    A(document.getElementById('i2Seal'),[{opacity:0,transform:'scale(.5)'},
      {opacity:1,transform:'scale(1)'}],300,1120,EO);
    /* ③ 和紙の地に溶ける */
    ['i2Ttl','i2Days','i2Note','i2Seal'].forEach(function(id,i){
      A(document.getElementById(id),[{opacity:1},{opacity:0}],320,1560+i*30,EI)});
    A(document.getElementById('i2Rule'),[{opacity:1},{opacity:0}],320,1600,EI);
  };
})();


(function(){
  var root = document.getElementById('bootK');
  if(!root) return;

  var cast  = root.querySelector('.bk-cast');
  var mid   = root.querySelector('.bk-mid');
  var wl    = root.querySelector('.bk-wl');
  var wr    = root.querySelector('.bk-wr');
  var ft    = root.querySelector('.bk-ft');
  var fb    = root.querySelector('.bk-fb');
  var shs   = [].slice.call(root.querySelectorAll('.bk-sh'));
  var cvs   = [].slice.call(root.querySelectorAll('.bk-cv'));
  var chs   = [].slice.call(root.querySelectorAll('.bk-ch'));
  var chars = [].slice.call(root.querySelectorAll('.bk-title span'));
  var subs  = [].slice.call(root.querySelectorAll('.bk-sub span'));
  var mark  = root.querySelector('.bk-mark');

  var EO = 'cubic-bezier(.2,.85,.3,1)';   /* ひらく */
  var EI = 'cubic-bezier(.45,.02,.75,1)'; /* 畳む   */
  var running = [];

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an);
    return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.playBoot_K = function(){
    reset();

    /* 動きを減らす設定：ひらく／畳むを出入りだけで表す（総尺 1.58s） */
    if(reduced()){
      var flat = [mid, wl, wr, ft, fb];
      flat.forEach(function(el, i){
        a(el, [{opacity:0, transform:'none'},{opacity:1, transform:'none'}], 380, 40*i);
      });
      shs.forEach(function(el){ a(el, [{opacity:.3},{opacity:0}], 380, 120); });
      a(cast, [{opacity:0},{opacity:1}], 380, 160);
      cvs.concat(chs).forEach(function(el){
        a(el, [{opacity:0, transform:'none'},{opacity:1, transform:'none'}], 360, 220);
      });
      chars.concat(subs).forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 380, 280); });
      a(mark, [{opacity:0},{opacity:.5}], 360, 320);
      [mid, wl, wr, ft, fb, cast].forEach(function(el){ out(el, [{opacity:1},{opacity:0}], 400, 1180); });
      cvs.concat(chs).forEach(function(el){ out(el, [{opacity:1},{opacity:0}], 360, 1160); });
      chars.concat(subs).forEach(function(el){ out(el, [{opacity:1},{opacity:0}], 320, 1120); });
      out(mark, [{opacity:.5},{opacity:0}], 320, 1120);
      return;
    }

    /* ① 折り畳まれた芯が置かれる */
    a(mid, [{opacity:0, transform:'translateZ(0) scale(.985)'},
            {opacity:1, transform:'translateZ(0) scale(1)'}], 300, 0);

    /* ② 左右の翼が縦の折り目からひらく */
    a(wl, [{opacity:1, transform:'rotateY(-176deg)'},
           {opacity:1, transform:'rotateY(0deg)'}], 480, 150);
    a(wr, [{opacity:1, transform:'rotateY(176deg)'},
           {opacity:1, transform:'rotateY(0deg)'}], 480, 150);
    /* 折り目の陰は開き切るまでに引く */
    a(root.querySelector('.bk-wl .bk-sh'), [{opacity:1},{opacity:0}], 520, 170);
    a(root.querySelector('.bk-wr .bk-sh'), [{opacity:1},{opacity:0}], 520, 170);

    /* ③ 天地の折り返しがひらいて1枚の面になる */
    a(ft, [{opacity:0, transform:'rotateX(-176deg)'},
           {opacity:1, transform:'rotateX(-176deg)', offset:.12},
           {opacity:1, transform:'rotateX(0deg)'}], 520, 500);
    a(fb, [{opacity:0, transform:'rotateX(176deg)'},
           {opacity:1, transform:'rotateX(176deg)', offset:.12},
           {opacity:1, transform:'rotateX(0deg)'}], 520, 500);
    a(root.querySelector('.bk-ft .bk-sh'), [{opacity:1},{opacity:0}], 560, 540);
    a(root.querySelector('.bk-fb .bk-sh'), [{opacity:1},{opacity:0}], 560, 540);

    /* 紙の厚みぶんの落ち影 */
    a(cast, [{opacity:0},{opacity:1}], 480, 620);

    /* ④ 折り目の跡がうっすら残る */
    cvs.forEach(function(el, i){
      a(el, [{opacity:0, transform:'scaleY(.4)'},{opacity:1, transform:'scaleY(1)'}], 400, 660 + i*70);
    });
    chs.forEach(function(el, i){
      a(el, [{opacity:0, transform:'scaleX(.4)'},{opacity:1, transform:'scaleX(1)'}], 400, 800 + i*70);
    });

    /* ⑤ 面に文字が現れる */
    chars.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateY(6px)'},
             {opacity:1, transform:'translateY(0)'}], 400, 900 + i*110);
    });
    subs.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateX(5px)'},
             {opacity:1, transform:'translateX(0)'}], 360, 1080 + i*50);
    });
    a(mark, [{opacity:0, transform:'scale(.86)'},
             {opacity:.5, transform:'scale(1)'}], 380, 1220);

    /* ⑥ また折り畳まれて消える */
    var OUT = 1460;
    chars.concat(subs).forEach(function(el, i){
      out(el, [{opacity:1},{opacity:0}], 240, OUT + i*18);
    });
    out(mark, [{opacity:.5},{opacity:0}], 240, OUT);
    cvs.concat(chs).forEach(function(el){ out(el, [{opacity:1},{opacity:0}], 260, OUT + 90); });

    /* 天地から左右の順に畳む（ひらいた順の逆） */
    a(ft, [{transform:'rotateX(0deg)'},{transform:'rotateX(-176deg)'}], 340, OUT + 160, EI, 'forwards');
    a(fb, [{transform:'rotateX(0deg)'},{transform:'rotateX(176deg)'}],  340, OUT + 160, EI, 'forwards');
    out(root.querySelector('.bk-ft .bk-sh'), [{opacity:0},{opacity:1}], 300, OUT + 160);
    out(root.querySelector('.bk-fb .bk-sh'), [{opacity:0},{opacity:1}], 300, OUT + 160);
    out(cast, [{opacity:1},{opacity:0}], 320, OUT + 180);

    a(wl, [{transform:'rotateY(0deg)'},{transform:'rotateY(-176deg)'}], 320, OUT + 330, EI, 'forwards');
    a(wr, [{transform:'rotateY(0deg)'},{transform:'rotateY(176deg)'}],  320, OUT + 330, EI, 'forwards');

    /* 最後は和紙の地だけになる（総尺 2.16s） */
    [ft, fb, wl, wr, mid].forEach(function(el){
      out(el, [{opacity:1},{opacity:0}], 300, 1860);
    });
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_K(); });
  }else{
    window.playBoot_K();
  }
})();


(function(){
  var root = document.getElementById('bootL');
  if(!root) return;

  var left   = root.querySelector('.bl-left');
  var under  = root.querySelector('.bl-under');
  var leaf   = root.querySelector('.bl-leaf');
  var front  = root.querySelector('.bl-front');
  var back   = root.querySelector('.bl-back');
  var rulesL = root.querySelector('.bl-left .bl-rules');
  var rulesU = root.querySelector('.bl-under .bl-rules');
  var rulesF = root.querySelector('.bl-front .bl-rules');
  var cast   = root.querySelector('.bl-cast');
  var spine  = root.querySelector('.bl-spine');
  var bleed  = root.querySelector('.bl-bleed');
  var chars  = [].slice.call(root.querySelectorAll('.bl-title span'));
  var subs   = [].slice.call(root.querySelectorAll('.bl-sub span'));
  var hair   = root.querySelector('.bl-hair');
  var ribbon = root.querySelector('.bl-ribbon');

  var EO = 'cubic-bezier(.2,.85,.3,1)';   /* 出現 */
  var EI = 'cubic-bezier(.45,.02,.75,1)'; /* 退場 */
  var ET = 'cubic-bezier(.42,.02,.32,1)'; /* めくりの弧 */
  var running = [];

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an);
    return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.playBoot_L = function(){
    reset();

    /* 動きを減らす設定：めくらずに入れ替える（総尺 1.56s） */
    if(reduced()){
      [left, under].forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 380, 0); });
      [rulesL, rulesU, rulesF].forEach(function(el){
        a(el, [{opacity:0, transform:'none'},{opacity:1, transform:'none'}], 380, 60);
      });
      a(spine, [{opacity:0},{opacity:1}], 380, 60);
      a(leaf, [{transform:'rotateY(0deg)'},{transform:'rotateY(-176deg)'}], 1, 380);
      a(back, [{opacity:0},{opacity:1}], 400, 380);
      a(ribbon, [{opacity:0},{opacity:.5}], 380, 420);
      chars.concat(subs).forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 400, 480); });
      a(hair, [{opacity:0, transform:'scaleX(0)'},{opacity:.7, transform:'scaleX(1)'}], 380, 560);
      chars.concat(subs).forEach(function(el){ out(el, [{opacity:1},{opacity:0}], 300, 1120); });
      out(hair, [{opacity:.7},{opacity:0}], 300, 1120);
      out(ribbon, [{opacity:.5},{opacity:0}], 300, 1120);
      [left, under, back, spine].forEach(function(el){ out(el, [{opacity:1},{opacity:0}], 400, 1160); });
      return;
    }

    /* ① 見開きが置かれる */
    a(left,  [{opacity:0},{opacity:1}], 320, 0);
    a(under, [{opacity:0},{opacity:1}], 320, 60);
    a(front, [{opacity:0},{opacity:1}], 320, 60);
    a(spine, [{opacity:0},{opacity:1}], 380, 140);

    /* ② 罫線が綴じ目から引かれる */
    a(rulesL, [{opacity:0, transform:'scaleX(0)'},{opacity:1, transform:'scaleX(1)'}], 440, 150);
    a(rulesF, [{opacity:0, transform:'scaleX(0)'},{opacity:1, transform:'scaleX(1)'}], 440, 210);
    a(rulesU, [{opacity:0, transform:'scaleX(0)'},{opacity:.6, transform:'scaleX(1)'}], 440, 260);

    /* ③ 裏の墨がうっすら透ける（90度を越えると自然に隠れる） */
    a(bleed, [{opacity:0},{opacity:.07}], 260, 430);

    /* ④ 一葉がめくれる。弧の頂で少し浮かせて紙の張りを出す */
    a(leaf, [{transform:'rotateY(0deg)'},
             {transform:'rotateY(-52deg) translateZ(10px)', offset:.42},
             {transform:'rotateY(-132deg) translateZ(6px)', offset:.78},
             {transform:'rotateY(-176deg) translateZ(0)'}], 780, 430, ET);

    /* 左頁に影が差して、葉が伏せるにつれて抜ける */
    a(cast, [{opacity:0},
             {opacity:.85, offset:.5},
             {opacity:.5, offset:.78},
             {opacity:0}], 800, 450, 'linear');

    /* ⑤ 裏面が起きて題が現れる */
    a(back, [{opacity:0},{opacity:1}], 200, 700);
    a(ribbon, [{opacity:0, transform:'translateY(-6px)'},
               {opacity:.5, transform:'translateY(0)'}], 400, 880);
    chars.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateY(6px)'},
             {opacity:1, transform:'translateY(0)'}], 380, 1010 + i*110);
    });
    subs.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateX(5px)'},
             {opacity:1, transform:'translateX(0)'}], 340, 1180 + i*46);
    });
    a(hair, [{opacity:0, transform:'scaleX(0)'},
             {opacity:.7, transform:'scaleX(1)'}], 420, 1240);

    /* ⑥ 本が閉じ、和紙の地だけになる（総尺 2.14s） */
    var OUT = 1560;
    chars.concat(subs).forEach(function(el, i){
      out(el, [{opacity:1},{opacity:0}], 240, OUT + i*16);
    });
    out(hair,   [{opacity:.7},{opacity:0}], 260, OUT);
    out(ribbon, [{opacity:.5},{opacity:0}], 260, OUT);
    out(spine,  [{opacity:1},{opacity:0}], 280, OUT + 80);
    out(rulesL, [{opacity:1},{opacity:0}], 280, OUT + 80);
    out(rulesU, [{opacity:.6},{opacity:0}], 280, OUT + 80);
    [left, under, back, front].forEach(function(el){
      out(el, [{opacity:1},{opacity:0}], 320, OUT + 260);
    });
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_L(); });
  }else{
    window.playBoot_L();
  }
})();


(function(){
  var root  = document.getElementById('bootN');
  if(!root) return;
  var field = document.getElementById('bnField');
  var rule  = document.getElementById('bnRule');

  /* 固定表（乱数なし）。hero＝中央に定まる「宅」「建」 */
  var HERO = [
    {ch:'宅', x:-124, y:-252, fx:-38, fy:-8},
    {ch:'建', x: 130, y: 238, fx: 38, fy:-8}
  ];
  var EXTRA = [
    ['法',  -40,-286], ['権',   96,-300], ['利',  152,-196], ['税', -150,-150],
    ['免',   30,-186], ['許',  118, -96], ['業',  -96, -66], ['者',   58, -40],
    ['契', -142,  -8], ['約',  140,  16], ['登',  -34,  52], ['記',   92,  74],
    ['保', -118, 110], ['証',   16, 128], ['説',  148, 150], ['明',  -66, 178],
    ['都',   64, 196], ['市', -148, 214], ['計',   -8, 268], ['画',  110, 296],
    ['相', -104,-122], ['続',  -18, -96]
  ];
  var PULL = 0.52; /* 余分な字が寄る先＝中央寄りの薄い環 */

  var heroes = [], extras = [];
  function build(){
    field.textContent = '';
    heroes = []; extras = [];
    EXTRA.forEach(function(d){
      var s = document.createElement('span');
      s.className = 'bn-c';
      s.textContent = d[0];
      s.style.transform = tf(d[1], d[2], 1);
      s._x = d[1]; s._y = d[2];
      field.appendChild(s);
      extras.push(s);
    });
    HERO.forEach(function(d){
      var s = document.createElement('span');
      s.className = 'bn-c bn-hero';
      s.textContent = d.ch;
      s.style.transform = tf(d.x, d.y, 1);
      s._d = d;
      field.appendChild(s);
      heroes.push(s);
    });
  }
  function tf(x, y, s){
    return 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + s + ')';
  }

  /* 吸い寄せ：はじめ静か→中ほどで寄る→長く減速して定まる
     （.22,.90 のような曲線は初速が過大で、前半で寄り終わってしまう） */
  var EPULL = 'cubic-bezier(.62,.03,.22,1)';
  var EO = 'cubic-bezier(.2,.85,.3,1)';
  var EI = 'cubic-bezier(.45,.02,.75,1)';
  var running = [];

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an);
    return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  build();

  window.playBoot_N = function(){
    reset();

    /* 動きを減らす設定：二文字だけ静かに出して消す（総尺 1.50s） */
    if(reduced()){
      extras.forEach(function(el){ el.animate([{opacity:0},{opacity:0}], {duration:1, fill:'both'}); });
      heroes.forEach(function(el){
        a(el, [{opacity:0, transform:tf(el._d.fx, el._d.fy, 2.5), color:'#332e28'},
               {opacity:1, transform:tf(el._d.fx, el._d.fy, 2.5), color:'#332e28'}], 420, 60);
        out(el, [{opacity:1},{opacity:0}], 400, 1100);
      });
      a(rule, [{opacity:0, transform:'scaleX(1)'},{opacity:.75, transform:'scaleX(1)'}], 380, 260);
      out(rule, [{opacity:.75},{opacity:0}], 380, 1100);
      return;
    }

    /* ① 画面いっぱいに漢字が薄くばらついて現れる
       ※transformとopacityは別々の動きにする。fill:'both' の寄せを同じ動きに載せると
         遅延中に「寄せの開始値」が先に効いて、この現れ方が消えてしまう */
    extras.forEach(function(el, i){
      var d = 30 + (i % 6) * 22;              /* 固定の段差＝毎回同じ */
      a(el, [{transform:tf(el._x, el._y, .94)},{transform:tf(el._x, el._y, 1)}], 320, d);
      a(el, [{opacity:0},{opacity:.2}], 320, d);
    });
    heroes.forEach(function(el, i){
      var d = el._d;
      a(el, [{transform:tf(d.x, d.y, .94)},{transform:tf(d.x, d.y, 1)}], 320, 40 + i * 60);
      a(el, [{opacity:0},{opacity:.24}], 320, 40 + i * 60);
    });

    /* ② 中央へ吸い寄せられる。二文字は「宅建」の位置に定まる（わずかに詰めて落ち着く） */
    heroes.forEach(function(el, i){
      var d = el._d;
      a(el, [
        {transform:tf(d.x, d.y, 1),          offset:0,   easing:EPULL},
        {transform:tf(d.fx, d.fy, 2.62),     offset:.86, easing:'cubic-bezier(.3,0,.5,1)'},
        {transform:tf(d.fx, d.fy, 2.5),      offset:1}
      ], 880, 340 + i * 70, 'linear', 'forwards');
      a(el, [{opacity:.24},{opacity:1}], 620, 520, EPULL, 'forwards');
      a(el, [{color:'#8a8074'},{color:'#332e28'}], 420, 700, EO, 'forwards');
    });
    extras.forEach(function(el, i){
      a(el, [{transform:tf(el._x, el._y, 1)},
             {transform:tf(el._x * PULL, el._y * PULL, .7)}],
        820, 360 + (i % 6) * 26, EPULL, 'forwards');
      a(el, [{opacity:.2},{opacity:.11}], 620, 560, EO, 'forwards');
    });

    /* ③ 定まった合図に、桜の細い一本を引く */
    a(rule, [{opacity:0, transform:'scaleX(0)'},
             {opacity:.75, transform:'scaleX(1)'}], 320, 1220);

    /* ④ 余分な字が薄れて消え、最後は和紙の地だけ（総尺 2.00s） */
    extras.forEach(function(el, i){
      out(el, [{opacity:.11},{opacity:0}], 320, 1280 + (i % 4) * 40);
    });
    heroes.forEach(function(el){
      out(el, [{opacity:1},{opacity:0}], 340, 1660);
    });
    out(rule, [{opacity:.75},{opacity:0}], 300, 1660);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_N(); });
  }else{
    window.playBoot_N();
  }
})();


(function(){
  var root = document.getElementById('bootO');
  if(!root) return;
  var glass  = root.querySelector('.bo-glass');
  var sand   = root.querySelector('.bo-sand');
  var stream = root.querySelector('.bo-stream');
  var grains = [].slice.call(root.querySelectorAll('.bo-grains i'));
  var ghost  = root.querySelector('.bo-ghost');
  var fill   = root.querySelector('.bo-fill');
  var mound  = root.querySelector('.bo-mound');
  var cap    = root.querySelector('.bo-cap');

  var EO = 'cubic-bezier(.2,.85,.3,1)';   // 出現
  var EI = 'cubic-bezier(.45,.02,.75,1)'; // 退場
  var LIN = 'linear';
  var running = [];

  /* 砂粒の横ぶれ（決め打ち＝毎回同じ落ち方） */
  var JX = [0,-2,2,-1,3,-3,1,-2,2,0,-3,1];
  var JE = [-1,2,-3,1,0,3,-2,1,-1,2,0,-2];

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an);
    return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.playBoot_O = function(){
    reset();

    /* 動きを減らす設定：砂は落とさず、数字と字が出て消えるだけ（総尺 1.60s） */
    if(reduced()){
      a(glass, [{opacity:0},{opacity:.55}], 380, 0);
      a(sand,  [{opacity:.22},{opacity:.22}], 10, 0);
      a(ghost, [{opacity:0},{opacity:0}], 10, 0);
      a(fill,  [{clipPath:'inset(0 0 0 0)', opacity:0},
                {clipPath:'inset(0 0 0 0)', opacity:1}], 420, 120);
      a(cap,   [{opacity:0},{opacity:1}], 380, 300);
      out(glass, [{opacity:.55},{opacity:0}], 420, 1180);
      out(fill,  [{opacity:1},{opacity:0}], 420, 1180);
      out(cap,   [{opacity:1},{opacity:0}], 420, 1180);
      return;
    }

    /* ① 砂時計が静かに現れる */
    a(glass, [{opacity:0, transform:'scale(.965)'},
              {opacity:.62, transform:'scale(1)'}], 340, 0);

    /* ② 上の室の砂が、くびれへ向かって減っていく */
    a(sand, [{transform:'scale(1)', opacity:.22},
             {transform:'scale(.08)', opacity:.12}], 900, 160, 'cubic-bezier(.3,.5,.6,1)');

    /* ③ 落ちる筋（途中で細り、砂が尽きると消える） */
    a(stream, [{transform:'scaleY(0)', opacity:0},
               {transform:'scaleY(1)', opacity:1}], 200, 200, EO);
    out(stream, [{opacity:1},{opacity:0}], 260, 1000);

    /* ④ 砂粒が落ちる（12粒・重なりながら） */
    grains.forEach(function(el, i){
      a(el, [{transform:'translate('+JX[i]+'px,0)',      opacity:0},
             {transform:'translate('+JX[i]+'px,6px)',     opacity:.5, offset:.14},
             {transform:'translate('+JE[i]+'px,58px)',    opacity:.5, offset:.8},
             {transform:'translate('+JE[i]+'px,72px)',    opacity:0}],
        440, 220 + i*58, LIN);
    });

    /* ⑤ 落ちた砂が下に積もって「61」の形になる（下から満ちる） */
    a(ghost, [{opacity:0},{opacity:.85}], 300, 260);
    a(fill, [{clipPath:'inset(100% 0 0 0)'},
             {clipPath:'inset(0% 0 0 0)'}], 900, 300, 'cubic-bezier(.35,.15,.4,1)');
    a(mound, [{transform:'scaleX(.18)', opacity:0},
              {transform:'scaleX(1)',   opacity:.55}], 900, 300, 'cubic-bezier(.35,.15,.4,1)');

    /* ⑥ 「試験まで」が添う */
    a(cap, [{opacity:0, transform:'translateY(3px)'},
            {opacity:1, transform:'translateY(0)'}], 380, 1260);

    /* ⑦ すべて和紙の地へ引く（総尺 2.10s） */
    var OUT = 1720;
    out(glass,  [{opacity:.62},{opacity:0}], 300, OUT);
    out(ghost,  [{opacity:.85},{opacity:0}], 300, OUT);
    grains.forEach(function(el){ out(el, [{opacity:0},{opacity:0}], 10, OUT); });
    out(fill,  [{opacity:1},{opacity:0}], 380, OUT);
    out(mound, [{opacity:.55},{opacity:0}], 380, OUT);
    out(cap,   [{opacity:1},{opacity:0}], 380, OUT);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_O(); });
  }else{
    window.playBoot_O();
  }
})();


(function(){
  var root = document.getElementById('bootP');
  if(!root) return;

  var units = [].slice.call(root.querySelectorAll('.bp-unit')).map(function(u){
    return {
      el: u,
      st: u.querySelector('.bp-st'), sb: u.querySelector('.bp-sb'),
      lt: u.querySelector('.bp-lt'), lb: u.querySelector('.bp-lb')
    };
  });
  var cap = root.querySelector('.bp-cap');
  var ji  = root.querySelector('.bp-ji');

  var EO   = 'cubic-bezier(.2,.85,.3,1)';    // 出現
  var EI   = 'cubic-bezier(.45,.02,.75,1)';  // 退場
  var FALL = 'cubic-bezier(.42,0,1,.62)';    // 倒れる（加速）
  var LAND = 'cubic-bezier(0,.6,.35,1)';     // 起きて止まる（減速）

  var running = [], timers = [];

  /* 十の位＝2から6へ、一の位＝5から1へ（一の位が最後に止まる） */
  var SEQ_T = ['2','3','4','5','6'];
  var SEQ_O = ['5','6','7','8','9','0','1'];
  var STEP = 140, LAST = 210;

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay||0, easing:ease||EO, fill:fill||'both'});
    running.push(an);
    return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function tm(ms, fn){ timers.push(setTimeout(fn, ms)); }
  function setD(face, d){ face.querySelector('.bp-d').textContent = d; }

  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
    timers.forEach(clearTimeout); timers = [];
    units.forEach(function(u, i){
      var d = (i === 0 ? SEQ_T : SEQ_O)[0];
      setD(u.st, d); setD(u.sb, d); setD(u.lt, d); setD(u.lb, d);
      u.lt.style.opacity = 0; u.lb.style.opacity = 0;
      u.lt.style.transform = 'rotateX(0deg)';
      u.lb.style.transform = 'rotateX(0deg)';
    });
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* 1枚めくる。板が倒れる→次の板が起きる。最後だけ わずかに行き過ぎて戻る（カタッ） */
  function flip(u, oldD, newD, at, dur, isLast){
    var half = dur / 2;

    /* 前半：上の板が前へ倒れる。板の下では上半分が既に次の数字になっている */
    tm(at, function(){
      setD(u.lt, oldD);
      setD(u.st, newD);
      a(u.lt, [{opacity:1, transform:'rotateX(0deg)'},
               {opacity:1, transform:'rotateX(-90deg)'}], half, 0, FALL, 'none');
    });

    /* 後半：同じ板の下半分が起き上がって、次の数字の下半分になる */
    tm(at + half, function(){
      setD(u.lb, newD);
      var kf = isLast
        ? [{opacity:1, transform:'rotateX(90deg)'},
           {opacity:1, transform:'rotateX(-5.5deg)', offset:.72},
           {opacity:1, transform:'rotateX(1.6deg)',  offset:.88},
           {opacity:1, transform:'rotateX(0deg)'}]
        : [{opacity:1, transform:'rotateX(90deg)'},
           {opacity:1, transform:'rotateX(0deg)'}];
      a(u.lb, kf, isLast ? dur*0.86 : half, 0, isLast ? 'cubic-bezier(0,.55,.4,1)' : LAND, 'none');
    });

    /* 板が伏せている間に、下半分の静止面を差し替える */
    tm(at + dur - 26, function(){ setD(u.sb, newD); });
  }

  /* 一連のめくりを並べる。戻り値＝止まる時刻 */
  function run(u, seq, startAt){
    var t = startAt;
    for(var i = 0; i < seq.length - 1; i++){
      var isLast = (i === seq.length - 2);
      var dur = isLast ? LAST : STEP;
      flip(u, seq[i], seq[i+1], t, dur, isLast);
      t += dur;
    }
    return t;
  }

  window.playBoot_P = function(){
    reset();

    /* 動きを減らす設定：めくらず「61」を出して消すだけ（総尺 1.58s） */
    if(reduced()){
      units.forEach(function(u, i){
        var d = (i === 0 ? '6' : '1');
        setD(u.st, d); setD(u.sb, d);
        a(u.el, [{opacity:0},{opacity:1}], 400, i*70);
      });
      a(cap, [{opacity:0},{opacity:1}], 380, 220);
      a(ji,  [{opacity:0},{opacity:1}], 380, 220);
      out(cap, [{opacity:1},{opacity:0}], 400, 1180);
      out(ji,  [{opacity:1},{opacity:0}], 400, 1180);
      units.forEach(function(u){ out(u.el, [{opacity:1},{opacity:0}], 400, 1180); });
      return;
    }

    /* ① 板が置かれる */
    units.forEach(function(u, i){
      a(u.el, [{opacity:0, transform:'translateY(6px)'},
               {opacity:1, transform:'translateY(0)'}], 300, i*70);
    });

    /* ② めくれて数字が送られ、十の位→一の位の順に止まる */
    var endT = run(units[0], SEQ_T, 260);
    var endO = run(units[1], SEQ_O, 300);

    /* ③ 止まった手応え：板の箱がわずかに沈んで戻る */
    tm(endT - 20, function(){
      a(units[0].el, [{transform:'translateY(0)'},{transform:'translateY(1.2px)', offset:.4},
                      {transform:'translateY(0)'}], 150, 0, 'ease-out', 'none');
    });
    tm(endO - 20, function(){
      a(units[1].el, [{transform:'translateY(0)'},{transform:'translateY(1.2px)', offset:.4},
                      {transform:'translateY(0)'}], 150, 0, 'ease-out', 'none');
    });

    /* ④ 「試験まで」と「日」が添う */
    a(cap, [{opacity:0, transform:'translateY(3px)'},
            {opacity:1, transform:'translateY(0)'}], 340, 1240);
    a(ji,  [{opacity:0, transform:'translateY(3px)'},
            {opacity:1, transform:'translateY(0)'}], 340, 1300);

    /* ⑤ 和紙の地へ引く（総尺 2.04s） */
    var OUT = 1660;
    out(cap, [{opacity:1},{opacity:0}], 380, OUT);
    out(ji,  [{opacity:1},{opacity:0}], 380, OUT);
    units.forEach(function(u, i){
      out(u.el, [{opacity:1},{opacity:0}], 380, OUT + i*40);
    });
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_P(); });
  }else{
    window.playBoot_P();
  }
})();


(function(){
  var root = document.getElementById('bootQ');
  if(!root) return;

  var panel = root.querySelector('.bq-panel');
  var vs    = [].slice.call(root.querySelectorAll('.bq-v'));
  var hs    = [].slice.call(root.querySelectorAll('.bq-h'));
  var pane  = root.querySelector('.bq-pane');
  var slot  = root.querySelector('.bq-slot');
  var glyphs = [].slice.call(root.querySelectorAll('.bq-kanji span, .bq-days b, .bq-days em'));

  var EO = 'cubic-bezier(.2,.85,.3,1)';   // 組む
  var EI = 'cubic-bezier(.45,.02,.75,1)'; // ほどける
  var running = [];

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an); return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* 桟ごとに伸びる向きを互い違いにすると、編むように見える */
  function originOf(el, vertical, i){
    el.style.transform = '';
    if(vertical){ el.style.transformOrigin = (i % 2 ? '50% 100%' : '50% 0%'); }
    else        { el.style.transformOrigin = (i % 2 ? '100% 50%' : '0% 50%'); }
  }
  function grow(el, vertical, dur, delay){
    var kf = vertical
      ? [{transform:'scaleY(0)', opacity:.35},{transform:'scaleY(1)', opacity:1}]
      : [{transform:'scaleX(0)', opacity:.35},{transform:'scaleX(1)', opacity:1}];
    return a(el, kf, dur, delay);
  }
  function shrink(el, vertical, dur, delay){
    var kf = vertical
      ? [{transform:'scaleY(1)', opacity:1},{transform:'scaleY(0)', opacity:.3}]
      : [{transform:'scaleX(1)', opacity:1},{transform:'scaleX(0)', opacity:.3}];
    return out(el, kf, dur, delay);
  }

  /* 外から内へ、縦→横→縦→横…と交差させながら組む順 */
  var ORDER = [
    [1,0],[0,0],[1,5],[0,5],
    [1,1],[0,1],[1,4],[0,4],
    [1,2],[0,2],[1,3],[0,3]
  ];
  function elOf(step){ return (step[0] ? vs : hs)[step[1]]; }

  window.playBoot_Q = function(){
    reset();

    /* 起動ごとに「宅建」か日数「61」のどちらかが中央に収まる */
    var kanji = Math.random() < .5;
    slot.classList.toggle('is-kanji', kanji);
    slot.classList.toggle('is-days', !kanji);
    var live = glyphs.filter(function(el){ return el.offsetParent !== null; });

    vs.forEach(function(el,i){ originOf(el, true,  i); });
    hs.forEach(function(el,i){ originOf(el, false, i); });

    if(reduced()){
      a(panel, [{opacity:0},{opacity:1}], 420, 0);
      vs.concat(hs).forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 420, 60); });
      vs.forEach(function(el){ el.style.transform='scaleY(1)'; });
      hs.forEach(function(el){ el.style.transform='scaleX(1)'; });
      a(pane, [{opacity:0},{opacity:.7}], 420, 120);
      live.forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 420, 160); });
      out(panel, [{opacity:1},{opacity:0}], 440, 1240);
      return;
    }

    /* ① 面がひらく */
    a(panel, [{opacity:0, transform:'scale(.988)'},{opacity:1, transform:'scale(1)'}], 420, 0);

    /* ② 縦と横が交差しながら組み上がる（外周→中央、44ms送り） */
    ORDER.forEach(function(step, k){
      grow(elOf(step), !!step[0], 320, 200 + k*44);
    });

    /* ③ 中央のひと枠が締まり、字が収まる */
    a(pane, [{opacity:0, transform:'scale(1.08)'},{opacity:.72, transform:'scale(1)'}], 380, 880);
    live.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateY(4px)'},{opacity:1, transform:'translateY(0)'}],
        340, 900 + i*60);
    });

    /* ④ 字が退き、格子が組んだ順の逆（中央→外周）にほどけて消える */
    var OUT = 1430;
    live.forEach(function(el){
      out(el, [{opacity:1, transform:'translateY(0)'},{opacity:0, transform:'translateY(-4px)'}], 260, OUT);
    });
    out(pane, [{opacity:.72},{opacity:0}], 260, OUT);

    ORDER.slice().reverse().forEach(function(step, k){
      shrink(elOf(step), !!step[0], 280, OUT + 40 + k*24);
    });

    /* 最後は和紙の地だけ（総尺 約2.11s） */
    out(panel, [{opacity:1},{opacity:0}], 340, 1770);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_Q(); });
  }else{
    window.playBoot_Q();
  }
})();


(function(){
  var root = document.getElementById('bootR');
  if(!root) return;

  var card  = root.querySelector('.br-card');
  var hair  = root.querySelector('.br-hair');
  var scrim = root.querySelector('.br-scrim');
  var wrap  = root.querySelector('.br-slats');
  var cords = [].slice.call(root.querySelectorAll('.br-cord'));
  var glyphs = [].slice.call(root.querySelectorAll('.br-kanji span, .br-days b, .br-days em'));

  /* 桟を組む：32本＋足元の座（1本）。巻き上がると天で束になる */
  var CARD_H = 420, N = 32, PITCH = 12, TOP = 12;
  var FOOT_Y = 400, FOOT_H = 2, ROLL = 8, PACK = .6;
  var slats = [], footDy = 0;
  (function build(){
    for(var i=0;i<=N;i++){
      var el = document.createElement('i');
      var foot = (i === N);
      el.className = 'br-slat' + (foot ? ' br-foot' : '');
      var y = foot ? FOOT_Y : (TOP + i*PITCH);
      el.style.top = y + 'px';
      var gy = ROLL + i*PACK;                 // 束ねられた位置
      el._dy = y - gy;
      if(foot) footDy = el._dy;
      wrap.appendChild(el);
      slats.push(el);
    }
  })();
  /* 隠す面の下端は、つねに足元の座とぴったり揃える */
  function scrimBottom(p){
    return CARD_H - ((FOOT_Y - footDy*p) + FOOT_H);
  }

  /* 巻き上がりの緩急。ためて／速く／静かに納まる */
  var OFF = [0, .22, .62, .85, 1];
  var PRG = [0, .079, .763, .953, 1];
  var RISE_DELAY = 340, RISE_DUR = 900;

  var EO = 'cubic-bezier(.2,.85,.3,1)';
  var EI = 'cubic-bezier(.45,.02,.75,1)';
  var running = [];

  function a(el, kf, dur, delay, ease, fill){
    var an = el.animate(kf, {duration:dur, delay:delay, easing:ease||EO, fill:fill||'both'});
    running.push(an); return an;
  }
  function out(el, kf, dur, delay){ return a(el, kf, dur, delay, EI, 'forwards'); }
  function reset(){
    running.forEach(function(x){ try{ x.cancel(); }catch(e){} });
    running = [];
  }
  function reduced(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  /* 緩急つきの巻き上げ：進み具合PRGをそのまま各要素に配る */
  function roll(el, at){
    var kf = PRG.map(function(p, k){
      return {offset:OFF[k], transform:at(p)};
    });
    return a(el, kf, RISE_DUR, RISE_DELAY, 'linear');
  }

  window.playBoot_R = function(){
    reset();

    /* 起動ごとに「宅建」か日数「61」のどちらかが奥から出る */
    var kanji = Math.random() < .5;
    card.classList.toggle('is-kanji', kanji);
    card.classList.toggle('is-days', !kanji);
    var live = glyphs.filter(function(el){ return el.offsetParent !== null; });

    if(reduced()){
      a(card, [{opacity:0},{opacity:1}], 420, 0);
      a(scrim, [{opacity:1},{opacity:0}], 460, 220);
      slats.concat(cords).forEach(function(el){ a(el, [{opacity:1},{opacity:0}], 460, 220); });
      live.forEach(function(el){ a(el, [{opacity:0},{opacity:1}], 420, 320); });
      a(hair, [{opacity:0, transform:'scaleX(0)'},{opacity:.6, transform:'scaleX(1)'}], 420, 380);
      out(card, [{opacity:1},{opacity:0}], 440, 1260);
      return;
    }

    /* ① 簾の下りた面が現れる */
    a(card, [{opacity:0, transform:'scale(.99)'},{opacity:1, transform:'scale(1)'}], 320, 0);

    /* ② 簾が下から巻き上がる。桟は天で束になり、隠していた面も一緒に上がる */
    var kf = PRG.map(function(p, k){
      return {offset:OFF[k],
              clipPath:'inset(0 0 ' + scrimBottom(p).toFixed(1) + 'px 0)'};
    });
    a(scrim, kf, RISE_DUR, RISE_DELAY, 'linear');

    slats.forEach(function(el){
      roll(el, function(p){ return 'translateY(' + (-el._dy * p).toFixed(1) + 'px)'; });
    });
    cords.forEach(function(el){
      roll(el, function(p){ return 'scaleY(' + (1 - p*.956).toFixed(3) + ')'; });
    });

    /* ③ 下端が字を通り過ぎるころ、奥から字が出る */
    live.forEach(function(el, i){
      a(el, [{opacity:0, transform:'translateY(6px)'},{opacity:1, transform:'translateY(0)'}],
        420, 700 + i*80);
    });
    a(hair, [{opacity:0, transform:'scaleX(0)'},{opacity:.6, transform:'scaleX(1)'}], 420, 880);

    /* ④ 天の束と糸が消え、字ごと薄れて終わる */
    out(wrap,  [{opacity:1},{opacity:0}], 320, 1300);
    cords.forEach(function(el){ out(el, [{opacity:.85},{opacity:0}], 320, 1300); });
    out(scrim, [{opacity:1},{opacity:0}], 320, 1300);
    live.forEach(function(el){
      out(el, [{opacity:1},{opacity:0}], 360, 1360);
    });
    out(hair, [{opacity:.6},{opacity:0}], 360, 1360);

    /* 最後は和紙の地だけ（総尺 約1.80s） */
    out(card, [{opacity:1},{opacity:0}], 400, 1400);
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ window.playBoot_R(); });
  }else{
    window.playBoot_R();
  }
})();


(function(){
  var boot  = document.getElementById('bootS');
  var field = document.getElementById('bs-field');
  if(!boot || !field) return;

  var W = 250, H = 124, CX = W/2, CY = H/2;
  var MAX = 120;                       /* 点の上限 */
  var SIZE = 108, CH1 = 66, CH2 = 184, BASE = 62;   /* 字の大きさと2字の置き場所 */
  var FONT = '500 ' + SIZE + 'px "Zen Old Mincho","Hiragino Mincho ProN","Yu Mincho",YuMincho,"Noto Serif JP",serif';

  /* ---------- 字形の座標を取る（実際の明朝で一度描いて筆の芯を拾う＝字は動かさない） ---------- */
  /* 万一 canvas が使えない環境向けの控え（宅・建の骨格を線分で持つ／100×100の枡） */
  var FALLBACK = {
    '宅':[[50,4,50,13],[20,20,15,32],[18,20,84,20],[84,20,82,33],
          [52,36,32,50],[26,52,76,52],[52,52,52,72],[52,72,72,80],[72,80,80,73]],
    '建':[[44,15,40,26],[62,18,62,70],[40,26,84,26],[40,40,84,40],[36,54,88,54],
          [28,32,22,50],[22,50,26,68],[20,74,88,80]]
  };

  function gridPoints(){
    var pts = null;
    try{ pts = scanGlyphs(); }catch(e){ pts = null; }
    if(!pts || pts.length < 24) pts = fallbackPoints();
    return pts;
  }

  function scanGlyphs(){
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d', {willReadFrequently:true});
    if(!g) return null;
    g.clearRect(0,0,W,H);
    g.fillStyle = '#000';
    g.font = FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('宅', CH1, BASE);        /* 2字を個別に置いて字間を固定（canvasの字送りに依存しない） */
    g.fillText('建', CH2, BASE);
    var d = g.getImageData(0,0,W,H).data;

    /* 墨の面を「筆の芯（1本の線）」まで細める＝Zhang-Suenの細線化。
       芯の上に等間隔で粒を置くので、少ない点数でも運筆が読める。 */
    var b = new Uint8Array(W*H), i, x, y;
    for(i=0; i<W*H; i++) b[i] = d[i*4+3] > 128 ? 1 : 0;
    thin(b);

    var skel = [];
    for(y=1; y<H-1; y++) for(x=1; x<W-1; x++) if(b[y*W+x]) skel.push([x+0.5, y+0.5]);
    if(!skel.length) return null;

    /* 芯の上を等間隔で拾う（走査順＝上から下・左から右の一定手順なので毎回同じ結果） */
    function beads(gap){
      var out = [], g2 = gap*gap, k, j, ok, p, q;
      for(k=0; k<skel.length; k++){
        p = skel[k]; ok = 1;
        for(j=0; j<out.length; j++){
          q = out[j];
          if((p[0]-q[0])*(p[0]-q[0]) + (p[1]-q[1])*(p[1]-q[1]) < g2){ ok = 0; break; }
        }
        if(ok) out.push(p);
      }
      return out;
    }
    var gap = 8.0, pts = beads(gap);
    while(pts.length > MAX && gap < 20){ gap += 0.5; pts = beads(gap); }
    if(pts.length > MAX) pts = pts.slice(0, MAX);
    return pts;
  }

  /* Zhang-Suen 細線化（2段の間引きを、変化が無くなるまで繰り返す） */
  function thin(b){
    var W2 = W, H2 = H, changed = true, guard = 0, del = [], i;
    function P(b,x,y){ return b[y*W2+x]; }
    while(changed && guard++ < 40){
      changed = false;
      for(var step=0; step<2; step++){
        del.length = 0;
        for(var y=1; y<H2-1; y++){
          for(var x=1; x<W2-1; x++){
            if(!P(b,x,y)) continue;
            var p2=P(b,x,y-1), p3=P(b,x+1,y-1), p4=P(b,x+1,y), p5=P(b,x+1,y+1),
                p6=P(b,x,y+1), p7=P(b,x-1,y+1), p8=P(b,x-1,y), p9=P(b,x-1,y-1);
            var n = p2+p3+p4+p5+p6+p7+p8+p9;
            if(n < 2 || n > 6) continue;
            var seq = [p2,p3,p4,p5,p6,p7,p8,p9,p2], a = 0;
            for(i=0;i<8;i++) if(seq[i]===0 && seq[i+1]===1) a++;
            if(a !== 1) continue;
            if(step === 0){
              if(p2*p4*p6 !== 0) continue;
              if(p4*p6*p8 !== 0) continue;
            }else{
              if(p2*p4*p8 !== 0) continue;
              if(p2*p6*p8 !== 0) continue;
            }
            del.push(y*W2+x);
          }
        }
        for(i=0;i<del.length;i++){ b[del[i]] = 0; changed = true; }
      }
    }
  }

  function fallbackPoints(){
    var out = [], keys = ['宅','建'], sc = SIZE/100,
        ox = [CH1 - SIZE/2, CH2 - SIZE/2], oy = BASE - SIZE/2, SP = 7.0, k, s, segs, i;
    for(k=0; k<keys.length; k++){
      segs = FALLBACK[keys[k]];
      for(s=0; s<segs.length; s++){
        var q = segs[s];
        var x1 = q[0]*sc + ox[k], y1 = q[1]*sc + oy;
        var x2 = q[2]*sc + ox[k], y2 = q[3]*sc + oy;
        var len = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
        var n = Math.max(1, Math.round(len/SP));
        for(i=0; i<=n; i++){
          if(i === n && s < segs.length-1) continue;     /* 継ぎ目の重なりを避ける */
          out.push([x1 + (x2-x1)*i/n, y1 + (y2-y1)*i/n]);
        }
      }
    }
    if(out.length > MAX){                                /* 等間隔に間引く */
      var few = [], st = out.length/MAX;
      for(i=0; i<MAX; i++) few.push(out[Math.floor(i*st)]);
      out = few;
    }
    return out;
  }

  /* ---------- 点の生成（散らばりは黄金角＝乱数を使わず毎回同じ） ---------- */
  var dots = [];
  function build(){
    var pts = gridPoints(), n = pts.length, i, html = [];
    for(i=0; i<n; i++){
      html.push('<i class="' + (i % 13 === 6 ? 'bs-p' : '') + '" style="left:' +
        pts[i][0].toFixed(1) + 'px;top:' + pts[i][1].toFixed(1) + 'px"></i>');
    }
    field.innerHTML = html.join('');
    var els = field.children;
    dots = [];
    var GA = 2.39996323;                                  /* 黄金角 */
    for(i=0; i<n; i++){
      var tx = pts[i][0], ty = pts[i][1];
      var a = i * GA, r = Math.sqrt((i + 0.5) / n);
      var sx = CX + Math.cos(a) * r * 182;                /* 画面いっぱいに散らす */
      var sy = CY + Math.sin(a) * r * 296;
      var vx = tx - CX, vy = ty - CY;
      var vl = Math.sqrt(vx*vx + vy*vy) || 1;
      var lm = 20 + (i % 5) * 3;                          /* ほどける距離 */
      dots.push({
        el: els[i],
        sx: sx - tx, sy: sy - ty,                         /* 散らばり位置（目標からの差） */
        lx: vx / vl * lm, ly: vy / vl * lm - 7,           /* ほどけ先 */
        d1: Math.round((tx / W) * 150 + (ty / H) * 20),   /* 寄る順＝左から右へ払う */
        d2: Math.round(((W - tx) / W) * 100)              /* ほどける順＝右から */
      });
    }
  }

  /* ---------- 進行 ---------- */
  var timers = [];
  function at(ms, fn){ timers.push(setTimeout(fn, ms)); }
  function clearAll(){ for(var i=0;i<timers.length;i++) clearTimeout(timers[i]); timers = []; }

  function phase(name, slow){
    var i, d, s;
    for(i=0; i<dots.length; i++){
      d = dots[i]; s = d.el.style;
      if(name === 'scatter'){
        s.transition = 'none';
        s.opacity = '0';
        s.transform = 'translate(' + d.sx.toFixed(1) + 'px,' + d.sy.toFixed(1) + 'px) scale(.72)';
      }else if(name === 'show'){
        s.transition = 'opacity .34s ease ' + ((i % 9) * 16) + 'ms';
        s.opacity = '.40';
      }else if(name === 'pull'){
        var t = slow ? 220 : 560;
        var dl = slow ? 0 : d.d1;
        s.transition = 'transform ' + t + 'ms cubic-bezier(.18,.86,.22,1) ' + dl + 'ms, opacity ' +
                       Math.round(t*0.85) + 'ms ease ' + dl + 'ms';
        s.opacity = '1';
        s.transform = 'translate(0,0) scale(1)';
      }else if(name === 'loose'){
        var t2 = slow ? 240 : 420, dl2 = slow ? 0 : d.d2;
        s.transition = 'transform ' + t2 + 'ms cubic-bezier(.36,0,.66,1) ' + dl2 +
                       'ms, opacity ' + Math.round(t2*0.9) + 'ms ease ' + dl2 + 'ms';
        s.opacity = '0';
        s.transform = 'translate(' + d.lx.toFixed(1) + 'px,' + d.ly.toFixed(1) + 'px) scale(.66)';
      }
    }
  }

  function play(){
    clearAll();
    var slow = false;
    try{ slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

    boot.className = 'bs';
    boot.style.display = '';
    if(!dots.length) build();
    phase('scatter', slow);
    void boot.offsetWidth;                        /* リフローで必ず最初から */

    var T_SHOW  = 40,
        T_PULL  = slow ? 120 : 240,
        T_LAND  = T_PULL + (slow ? 230 : 710),    /* 最後の点が着く頃 */
        T_LOOSE = T_LAND + (slow ? 320 : 480),    /* 定まった字を見せてから */
        T_END   = T_LOOSE + (slow ? 260 : 540);

    at(T_SHOW,  function(){ phase('show', slow); });
    at(T_PULL,  function(){ phase('pull', slow); });
    at(T_LAND,  function(){ boot.classList.add('is-land'); });
    at(T_LOOSE, function(){ boot.classList.add('is-loose'); phase('loose', slow); });
    at(T_END,   function(){                        /* 和紙の地だけを残して退場 */
      boot.style.display = 'none';
      boot.classList.remove('is-land','is-loose');
      phase('scatter', slow);
    });
  }

  window.playBoot_S = play;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play);
  else play();
})();

  window.TAKKEN_BOOTFX = {
    ids: LIST.map(function(x){return x.id}),
    /* 1つ引いて el の中で再生する。戻り値＝出した案のid（出さなかったら null） */
    play: function(el, id){
      if(!el)return null;
      try{
        if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
      }catch(e){}
      var pick = null;
      if(id){ for(var i=0;i<LIST.length;i++) if(LIST[i].id===id) pick=LIST[i]; }
      if(!pick) pick = LIST[Math.floor(Math.random()*LIST.length)];
      var st = document.createElement('style');
      st.textContent = pick.css;
      el.appendChild(st);
      var wrap = document.createElement('div');
      wrap.innerHTML = pick.html;
      el.appendChild(wrap);
      var fn = window['playBoot_'+pick.id];
      if(typeof fn === 'function'){ try{ fn() }catch(e){} }
      return pick.id;
    }
  };
})();
