
'use strict';
/* =========================================================
   宅建 一問一答（SPEC.md §2〜§5 実装 / デザイン案6 カード式）
   データは window.TAKKEN_ITEMS / window.TAKKEN_CHAPTERS のみ（fetch不使用）
   ========================================================= */

/* ---------- 定数 ---------- */
var LSK='takken_v1';
var RAW=window.TAKKEN_ITEMS||[];
var CHAP=window.TAKKEN_CHAPTERS||{};
var MOCKS=(window.TAKKEN_MOCKS&&window.TAKKEN_MOCKS.sets)||[];
var EXCL=['要確認','省略','解説なし'];
var ITEMS=RAW.filter(function(it){var f=it.flags||[];for(var i=0;i<f.length;i++){if(EXCL.indexOf(f[i])>=0)return false}return true});
var NEXCL=RAW.length-ITEMS.length;
var BY={};ITEMS.forEach(function(it){BY[it.id]=it});
/* 復習＝抜き打ちが主役（2026-08-14 確定）。間隔反復の「復習レベル」は廃止した。
   休ませる日数＝連続正解 0/1回→翌日／2回→3日／3回→7日／4回以上→14日（上限）。
   間違えたら休みはリセットして翌日に戻る。上限14日なので試験までに何度も再会する。 */
var REST=[1,1,3,7,14];
var BOXD=REST;                      /* 旧名の参照が残っていても壊れないように別名を置く */
var BOXN=REST.length-1;
/* ---------- 難易度は「3段階に丸めて」使う（2026-08-14 確定） ----------
   ・肢単位のAI難易度 `diff_ai`（A〜E）を 易＝A・B／普＝C／難＝D・E の3段階に丸める。
     独立した再査定で 5段階の完全一致は61〜71%（境界が揺れる）／3段階は74〜77%・±1段以内99%＝
     順序が安定するため、画面表示・絞り込み・抜き打ちの選定・出題順はすべて3段階で扱う。
   ・`diff_ai` が null（自信が低い141問）は難易度を使わない。表示は点ではなく「—」、
     選定では自分の正誤実績（未正解・誤答歴）を優先し、難易度では優先しない。
   ・出版社の `diff`（A〜E）は1問の4肢すべてに同じ値がコピーされているので肢単位の指標にはならない。
     分析①の得点予測以外では使わない（出題順・絞り込み・抜き打ちには使わない）。 */
var DIFS=['A','B','C','D','E'];       /* 出版社の5段階（肢単位には使わない） */
var D3=['易','普','難'];               /* 画面に出す3段階 */
var D3OF={A:'易',B:'易',C:'普',D:'難',E:'難'};
function d3(it){return (it&&D3OF[it.diff_ai])||null}        /* 3段階（null＝未評価） */
function d3Rank(it){var g=d3(it);return g?D3.indexOf(g):9}  /* 易0 普1 難2 未評価9＝末尾 */
function d3Hard(it){var g=d3(it);return g?D3.indexOf(g):-1} /* 難い順に並べる用（未評価は最後） */
var WHYS=['ケアレス','知らなかった','読み違い','条文うろ覚え'];
/* ---------- チェック用の並び（2026-08-18 本人指定） ----------
   **私が直した問題だけ**を、直した順に並べる。さとうさんが 1問→3問→5問→10問 と確かめ、
   OKが出たら次の範囲へ広げる。ここは私が書き換えて配信する＝殻に入るので
   takken_data.json を渡し直さなくていい（32MBを毎回渡すのは現実的でない）。
   ids は「順番が意味を持つ」＝並べ替えない（keepOrder）。 */
/* dataAt ＝ この並びに合わせて問題データを配信した時刻。
   端末のデータがこれより古いときは**チェックさせない**（2026-08-18 本人指摘
   「降りてないものを端末で確認させようとしてたってこと?」）。 */
var CHECK={label:"権利関係 #21 物権変動",unit:"",note:"",
  dataAt:"2026-08-22 02:06",ids:["b1_8-027-1"]};
/* 報告のメモ（入力欄から離れたときに保存。再描画しないので入力が消えない） */
document.addEventListener('change',function(e){
  var el=e.target;
  if(!el||!el.getAttribute||el.getAttribute('data-act')!=='repmemo')return;
  var id=el.getAttribute('data-id');
  if(S.repDraft&&S.repDraft.id===id)S.repDraft.memo=el.value||'';
},true);
/* データの間違いの報告（2026-08-17 本人の設計）。押すと ST.reports[肢id] に入る。
   本人「画像が間違えてるとか、参考動画がずれてるとか、この範囲じゃないとか
   いくつか選択肢を入れるともっといい。そしたらチャットで報告したことを直してで済む」
   「複数付けられるといい。1つだけ間違っているとは限らない」
   「どんな選択肢があるかも大事。そこになかったら報告しても伝わらない」
   ＝**複数選べる**。足りない場合のために **その他＋メモ**を必ず置く。
   問題文・解説・答えの誤りは報告の対象にしない（過去問と解説は出典どおりで直す対象ではない）。
   **貼り付けたデータ（図・動画・単元・順番）の誤りだけ**を集める。 */
/* 報告は2択だけ（2026-08-18 本人指定）。「実質、習ってないか図が適切じゃないの2択」。
   細かく分けても直す作業は同じで、選ぶ手間が増えるだけだった。コメントで補う。 */
var REPS=['まだ習ってない','図が適切じゃない'];
var SEC_PER_Q=30;                   /* 1問あたりの想定時間（秒）＝学習時間の換算に使う */
var EXAM_DEFAULT='2026-10-18';      /* 試験日（10月第3日曜・受験票で確認） */
var PASS_LINE=35;                   /* 合格ラインの目安 */
/* 本試験の科目別の配点（＝確定した事実。合計50）。
   ただし「不動産の需給」5問のうち1問は統計（問48）で、過去問では測れない（下の CATQ_OFF）。
   得点予測が扱うのは統計を抜いた 49点ぶん＝需給は 5 − 1 = 4。 */
var BIGQ_WANT={'権利関係':14,'法令上の制限':8,'宅地建物取引業法等':20,'税に関する法令':2,
               '不動産価格の評定':1,'土地・建物その他の需給':4};
/* 実際に画面で使う大分類の配点 BIGQ は、CATQ の合算から導出する（CINFO を作ったあとで定義）。
   2026-08-15 批評指摘：BIGQ をベタ書きした二重帳簿になっていたため、
   学習タブの大分類ヘッダ（CATQ の合算＝13.9）と分析③（BIGQ＝14）で数字が食い違っていた。 */
var BIGQ={};
/* ---------- 本試験の実測配点（単元＝小分類ごとの1年あたりの出題数・合計 49.00） ----------
   出どころ＝data/weights.json（配点担当が過去問の出典年・問番号から数え、検算済み）。
   直近10年（2016〜2025）ぶん。ファイルを読みに行かずJSの定数として持つ＝
   データを入れ直さなくても効くようにするため（問題文・解説は含まない数値表なので公開してよい）。
   使い道は2つだけ：①分析の得点予測 scoreNow() ②単元一覧の「毎年N問」。
   同じ表から出すので、2箇所で違う数字にならない。

   ★2026-08-15 の直し その1：大分類ごとに公式配点へ正規化した。
     科目別の配点（権利14・法令8・業法20・税2・評定1・需給4）は確定した事実で、
     実測が要るのは「科目の中でどの単元が何問か」だけ。実測の生の値をそのまま足すと
     業法 20.07・権利 13.88 のようにズレが出て、学習タブの合算（13.9）と
     分析の大分類の配点（14）が画面上で食い違っていた（本人は 14/20/8/2/1/5 を暗記している）。
     そこで科目ごとに「目標÷実測」倍して小数2桁に丸め、丸めで出た端数は
     剰余の大きい単元へ +0.01 ずつ配った（最大剰余法）。
     各科目の合計は目標にちょうど一致する＝Python の Decimal で厳密に検算済み。
     起動時にも catqCheck() が同じことを見る。

   ★2026-08-15 の直し その2：「不動産の需給・統計」を得点予測から外した（CATQ に載せない）。
     旧：実測 0.09問 を 1.00問 に持ち上げていた（統計は毎年必ず1問出るため）。
     しかしこの単元の肢は4つしかなく（b6_3-001-1〜4＝2025年 問48）、
     中身は「令和5年度の営業利益」「令和6年の新設住宅着工戸数」「令和7年の地価公示」＝
     2026年の本試験では数字が全部入れ替わる。つまり過去問では測れない。
     配点1.00を与えると 1肢 0.25点（他の単元の約28倍）になり、単元一覧で
     「毎年1.00問／4問」＝最小の手間で最大の見返りに見える行になっていた（批評指摘）。
     測れないものは測らない＝別枠にして注記だけ出す。得点予測の分母は 50 ではなく 49.00。 */
var CATQ={
  /* 宅地建物取引業法等 計 20.00問 */
  '業務上の規制':3.59,'35条書面':2.83,'宅地建物取引業・免許':2.16,'8種制限':2.16,'37条書面':2.08,
  '宅地建物取引士':1.41,'媒介契約':1.33,'報酬関連':1.09,'住宅瑕疵担保責任履行法':1.00,'営業保証金':0.92,
  '保証協会':0.84,'監督処分・罰則':0.59,
  /* 権利関係 計 14.00問 */
  '家族法（親族・相続）':1.35,'所有権・共有・占有権・用益物権':1.27,'債権総則（保証・連帯債務など）':1.26,
  '売買契約':1.26,'借地借家法（土地）':1.01,'借地借家法（建物）':1.01,'区分所有法':1.01,'不動産登記法':1.01,
  '賃貸借契約':0.93,'担保物権（抵当権など）':0.76,'条件・期間・時効':0.68,'その他の契約':0.60,
  '制限行為能力者':0.42,'意思表示':0.42,'代理':0.42,'不法行為・事務管理':0.42,'条文問題・その他':0.17,
  /* 法令上の制限 計 8.00問 */
  '都市計画法':2.00,'建築基準法':2.00,'農地法':1.00,'土地区画整理法':1.00,'盛土規制法':1.00,
  '国土利用計画法':0.92,'その他の法令':0.08,
  /* 土地・建物その他の需給 計 4.00問（統計は CATQ_OFF＝得点予測の対象外） */
  '住宅金融支援機構法':1.00,'不当景品類及び不当表示防止法':1.00,
  '土地の形質・地積・地目及び種別':1.00,'建物の形質・構造及び種別':1.00,
  /* 税に関する法令 計 2.00問 */
  '不動産取得税':0.49,'固定資産税':0.49,'所得税':0.34,'印紙税':0.34,'登録免許税':0.34,'贈与税':0.00,
  /* 不動産価格の評定 計 1.00問 */
  '不動産鑑定評価基準':0.58,'地価公示法':0.42};
/* 得点予測の対象外にする単元と、その代わりに画面へ出す文言。
   CATQ に載せない代わりにここへ置く＝①単元一覧で数字の代わりにこの文言を出す
   ②catqCheck() が「配点の付け漏れ」と誤検知しない、の2つを同じ1か所で担保する。 */
var CATQ_OFF={'不動産の需給・統計':'毎年1問・直前に対策'};
/* 得点予測の分母。49 とベタ書きせず CATQ の合計から出す＝配点を直したときに分母がズレないため。 */
var CATQ_TOTAL=(function(){var s=0;Object.keys(CATQ).forEach(function(k){s+=CATQ[k]});return Math.round(s*100)/100})();
/* 配点表の検算。次の4つが崩れたら起動時に console へ警告を出す（目で足し算しない＝TEAM.md の決めごと）。
   ①合計が 49.00 ②問題データにある単元で配点も CATQ_OFF も無いものが無い
   ③CATQ にあって問題データに無い単元名が無い ④大分類ごとの合計が公式配点に一致する */
function catqCheck(){
  var s=CATQ_TOTAL,ks=Object.keys(CATQ);
  var miss=CATS.filter(function(c){return CATQ[c]===undefined&&CATQ_OFF[c]===undefined});
  var extra=ks.filter(function(k){return CINFO[k]===undefined});
  var bad=[];
  Object.keys(BIGQ_WANT).forEach(function(b){
    var v=Math.round((BIGQ[b]||0)*100)/100;
    if(v!==BIGQ_WANT[b])bad.push(b+' '+v+'≠'+BIGQ_WANT[b]);
  });
  var o={sum:s,cats:ks.length,itemCats:CATS.length,missing:miss,unknown:extra,bigs:bad,off:Object.keys(CATQ_OFF)};
  if(s!==49||miss.length||extra.length||bad.length)console.warn('CATQ 検算 NG',o);else console.log('CATQ 検算 OK',o);
  return o;
}

/* ---------- アイコン（自作SVG・ICOOON MONO風／絵文字は使わない） ---------- */
function svg(p,w){return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||1.6)+'" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'}
/* 配色は9つ。1が既定（桜鼠）。骨格は共通で、CSS変数だけを差し替える。 */
var THEMES=[['1','桜鼠'],['2','ミント'],['3','藤'],['4','桃'],['5','水'],
            ['6','桃と水'],['7','ミルクティー'],['8','白と桃'],['9','生成り']];
function themeNow(){var t=ST&&ST.settings&&ST.settings.theme;return (t&&/^[1-9]$/.test(t))?t:'1'}
function applyTheme(){
  var t=themeNow();
  if(t==='1')document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme',t);
}
/* 小花。5弁を少し重ねる（4弁を直交で置くと十字に見える）。色は配色の変数から取る。 */
var FLWP=(function(){var s='';for(var i=0;i<5;i++){var a=(i*72-90)*Math.PI/180;
  s+='<circle cx="'+(12+5.1*Math.cos(a)).toFixed(2)+'" cy="'+(12+5.1*Math.sin(a)).toFixed(2)+'" r="4.2"/>';}
  return s;})();
function flw(n){n=n||16;
  return '<span class="flw" aria-hidden="true"><svg width="'+n+'" height="'+n+'" viewBox="0 0 24 24">'
    +'<g fill="var(--petal)">'+FLWP+'</g><circle cx="12" cy="12" r="2.3" fill="var(--core)"/></svg></span>';}
/* ホームの点線の区切り */
function hdots(){var s='';for(var i=0;i<17;i++)s+='<circle cx="'+(3+i*7)+'" cy="3" r="1.4" fill="var(--petal)"/>';
  return '<div class="hdots"><svg width="120" height="6" viewBox="0 0 120 6" aria-hidden="true">'+s+'</svg></div>';}
var IC={
 home:svg('<path d="M3.5 10.5 12 4l8.5 6.5V20a.5.5 0 0 1-.5.5h-5v-6h-6v6H4a.5.5 0 0 1-.5-.5z"/>'),
 book:svg('<path d="M4 4.5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z"/><path d="M20 4.5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>'),
 again:svg('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5V7h-3.5"/>'),
 chart:svg('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 20v-6"/><path d="M13 20V9"/><path d="M18 20v-9"/>'),
 star:svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>'),
 /* 汎用の再生。2026-08-15 に動画の導線は全部 IC.yt（YouTubeのマーク）へ移したので今は未使用。
    動画以外の「再生」が出てきたとき用に残す。 */
 play:svg('<circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.6l5 3.4-5 3.4z"/>'),
 check:svg('<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',2),
 chev:svg('<path d="M9 5l7 7-7 7"/>'),
 chevL:svg('<path d="M15 5l-7 7 7 7"/>'),      /* 前の問題へ（2026-08-17） */
 down:svg('<path d="M5 9l7 7 7-7"/>'),
 up:svg('<path d="M5 15l7-7 7 7"/>'),
 warn:svg('<path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4"/><path d="M12 16.7v.3"/>'),
 io:svg('<path d="M12 3.5v11"/><path d="M8 11l4 4 4-4"/><path d="M4.5 19.5h15"/>'),
 close:svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'),
 clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
 lock:svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>')
};
/* YouTube を開くボタン・リンク用。線画の自作近似ではなく、YouTube のマークそのものの形を使う
   （出典：Simple Icons の youtube.svg／viewBox 0 0 24 24。輪郭・角の曲率・三角の位置と大きさは原寸のまま）。
   色だけ currentColor の単色にしてある＝配色1〜9に追従させるため（本来のブランド規約の赤ではない）。
   塗りのマークは線画より重く見えるので、中心から0.72倍に縮めて置く。実測（72pxに描いて画素を数えた）：
   既存の線画アイコン＝幅18前後・塗り面積21〜23%／このマーク＝原寸で幅24・面積64%、0.72倍で幅17.3・面積33.5%。
   三角は同じパスの2つ目のサブパスで、塗り規則（nonzero）により背景色に抜ける＝実際のマークと同じ見え方。 */
IC.yt='<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'
  +'<g transform="translate(3.36,3.36) scale(0.72)"><path fill="currentColor" d="'
  +'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505'
  +'A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136'
  +'c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136'
  +'C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></g></svg>';

/* ---------- 大分類・小分類・章の索引 ---------- */
var BIGS=[],CATS=[],CINFO={};
ITEMS.forEach(function(it){
  if(BIGS.indexOf(it.big)<0)BIGS.push(it.big);
  if(!CINFO[it.cat]){CINFO[it.cat]={big:it.big,ids:[],topics:[]};CATS.push(it.cat)}
  var c=CINFO[it.cat];c.ids.push(it.id);
  var t=it.topic||'未分類';if(c.topics.indexOf(t)<0)c.topics.push(t);
});
/* 大分類の配点＝その大分類に属する単元の配点（CATQ）の合計。
   ベタ書きせず導出するので、学習タブの大分類ヘッダと分析③・抜き打ちの重みが必ず同じ数字になる。
   丸め誤差（0.1+0.2 問題）が出ないよう小数2桁で丸めて持つ。統計は CATQ に無いので需給は 4.00。 */
BIGS.forEach(function(b){
  var v=0;CATS.forEach(function(c){if(CINFO[c].big===b)v+=CATQ[c]||0});
  BIGQ[b]=Math.round(v*100)/100;
});
function catsOfBig(b){return CATS.filter(function(c){return CINFO[c].big===b})}
function itemsOfCat(c){return CINFO[c]?CINFO[c].ids.map(function(i){return BY[i]}):[]}
function itemsOfTopic(c,t){return itemsOfCat(c).filter(function(it){return (it.topic||'未分類')===t})}

/* ---------- 章（動画） ---------- */
function chapsOf(cat){
  var out=[];(CHAP[cat]||[]).forEach(function(v){
    (v.chapters||[]).forEach(function(c){
      if(c.skip)return;
      out.push({vid:v.vid,title:v.title,member:!!v.member,len:v.len,src:v.source||'',
                sec:c.sec,label:c.label,topic:c.topic});
    });
  });
  out.sort(function(a,b){return a.sec-b.sec});return out;
}

/* ---------- 動画の紐づけ（videos[] 配列。旧 video 単数も読める） ----------
   1つの問題が複数の動画のタイムラインに現れるのが正しい状態なので、配列で持つ。
   items.js が旧形式（video が単数オブジェクト）のうちは1件の配列として扱う。 */
/* 動画リンクの並び。分かりやすい順＝こざりえ → こうのすけ → あこ課長（2026-08-14 本人指定）。
   同じチャンネル内では新しい動画を先に出す。表に出るのは先頭の1本で、残りは「＋N」に畳む。 */
var SRCRANK={'こざりえ':0,'こうのすけ':1,'あこ課長':2};
function srcRank(vid){var r=SRCRANK[VSRC[vid]];return (r===undefined)?9:r}
/* 肢ごとに字幕を読んで付け直した「検証済み」のリンクには、データ側が pick:true を付ける。
   それを**チャンネルの順より先**に見る（2026-08-15 本人の指示
   「内容が合っていることが第1の関門、チャンネルは第2」）。
   これが無いと、語の一致で機械的に付けた古いこざりえのリンクが srcRank で先頭に残り、
   検証済みの新しいリンクを追い越して画面が変わらない（適用担当の実測：3,202肢のうち
   2,455肢＝77%で表示が変わらなかった。勝っていたのは こざりえ2,450件＋こうのすけ5件）。
   pick 同士・pick 無し同士では、これまでどおり チャンネルの順 → 公開が新しい順。
   pick がまだ1件も無いデータでは全部 1 になるので、並びは今までと変わらない。 */
function pickRank(v){return (v&&v.pick)?0:1}
function vidsOf(it){
  if(it._vs)return it._vs;
  var a=[];
  if(it.videos&&it.videos.length)a=it.videos;
  else if(it.video&&it.video.vid)a=[it.video];
  a=a.filter(function(v){return v&&v.vid&&!SRCHIDE[VSRC[v.vid]]});
  a.sort(function(x,y){
    var q=pickRank(x)-pickRank(y);                           /* ①検証済みのリンクを先に */
    if(q)return q;
    var d=srcRank(x.vid)-srcRank(y.vid);                     /* ②チャンネルの順 */
    if(d)return d;
    return (VUP[y.vid]||'').localeCompare(VUP[x.vid]||'');   /* ③新しい動画を先に */
  });
  it._vs=a;
  return it._vs;
}
var VSRC={},VTIT={},VLEN={},VMEM={},VCHN={},VUP={};   /* vid → チャンネル／題名／尺／メンバー限定／章数／公開日 */
(function(){
  var seen={};                            /* 同じ動画が複数の小分類に載るので秒で重複を除く */
  Object.keys(CHAP).forEach(function(cat){
    (CHAP[cat]||[]).forEach(function(v){
      VSRC[v.vid]=v.source||'';VTIT[v.vid]=v.title||'';VLEN[v.vid]=v.len||0;VMEM[v.vid]=!!v.member;
      VUP[v.vid]=v.upload||'';
      var s=seen[v.vid]=seen[v.vid]||{};
      (v.chapters||[]).forEach(function(c){if(!c.skip)s[c.sec]=1});
      VCHN[v.vid]=Object.keys(s).length;
    });
  });
})();
/* 主教材＝こざりえ（2026-08-14 本人指定）。分かりやすさで選んだ。
   1本が科目まるごとなので、一覧は「大分類 → 1本 → 章」の形になる。
   こざりえに無い所（17%）はあこ課長が受け持ち、「他のチャンネル」に畳んで置く。 */
var DEFSRC='こざりえ';                    /* 出題順・肢のリンクの並びの基準（＝分かりやすい順） */
/* 動画学習（学習タブの一覧）で通しで見る教材＝あこ課長だけ（2026-08-17 本人指示）。
   「こうのすけとこざりえは分かりやすいけど範囲がカバーできてない。
     あくまで補足として問題から動画に飛べればいい」。
   ＝一覧はあこ課長で通し、肢のリンクは今までどおり分かりやすい順のまま。 */
var VIDSRC='あこ課長';
var SRCHIDE={'れくお':1};                  /* 使わないチャンネル（本人指定・2026-08-14） */
var SRCS=[DEFSRC];                        /* 基準に選べるチャンネル（既定を先頭に） */
Object.keys(VSRC).forEach(function(v){
  var sc=VSRC[v];
  if(sc&&!SRCHIDE[sc]&&SRCS.indexOf(sc)<0)SRCS.push(sc);
});
/* ---------- 章の区間（肢ごとの判定のリンクを章の行に載せるため） ----------
   判定担当は字幕を読んで「章の開始秒ではなく**実際に話している秒**」を指す。章名は先頭1論点しか
   表していないので、これは正しい意図。だが秒が章頭と違うと vid＋秒の完全一致では拾えず、
   その肢は動画学習の章の行から消える（実測648肢）。そこで判定のリンクだけ区間で拾う。

   ★区間の右端は「その動画の**全章**（＝全小分類の和）の次の章」で取る。
   chapters.json は「小分類 → その小分類に関係する章だけ」という形なので、いま開いている
   小分類に載っている章だけで区間を切ると、1章しか持たないエントリ（報酬関連×L8TDRKjZTEg 等）が
   動画の残り全部を飲み込む（実測：誤って飲み込む配置が +6,124件）。
   skip の章も境界に使う（データ側 tools/apply_retopic.py の load_chapters と同じ定義。
   ここを変えると同スクリプトが入れる csec と食い違う）。 */
var VSECS={};
(function(){
  var m={};
  Object.keys(CHAP).forEach(function(cat){
    (CHAP[cat]||[]).forEach(function(v){
      var s=m[v.vid]=m[v.vid]||{};
      (v.chapters||[]).forEach(function(c){if(typeof c.sec==='number')s[c.sec]=1});
    });
  });
  Object.keys(m).forEach(function(vid){
    VSECS[vid]=Object.keys(m[vid]).map(Number).sort(function(a,b){return a-b});
  });
})();
/* 秒 → その秒が入る章の開始秒（区間 [章の秒, 次の章の秒)）。
   先頭章より前／尺を超える秒は null＝当てない（推測で直さないのはデータ側と同じ扱い）。 */
function csecOf(vid,sec){
  var a=VSECS[vid];
  if(!a||!a.length||typeof sec!=='number')return null;
  if(sec<a[0])return null;
  var len=VLEN[vid]||0;
  if(len&&sec>len)return null;
  var lo=0,hi=a.length-1,best=null;
  while(lo<=hi){var mid=(lo+hi)>>1;if(a[mid]<=sec){best=a[mid];lo=mid+1}else hi=mid-1}
  return best;
}
/* 区間で拾ってよいリンク＝肢ごとの判定で入れた1本だけ。
   既存の「字幕で割当」等まで区間に広げると、秒が章頭でない古いリンク2,813本が一斉に載って
   最大の章が 182問 → 504問 に膨らむ（データ担当の実測）。だから判定のリンクに限る。 */
var JMARK='肢ごとの判定';
function isJudged(v){
  var w=v&&v.why;
  return !!(w&&w.length===1&&w[0]===JMARK);
}
/* ---------- 一覧・順序に使うリンク（2026-08-18 本人判断で規則を変えた） ----------
   判定（肢→動画）は「判定した1本を足すだけで、元の機械リンクを消さない」設計
   （tools/apply_retopic.py が意図的にそうしている＝基準の動画 chapFor() を守るため）。
   そのため **判定済みの肢が、判定していない機械リンクのせいで「習っていない動画」の
   問題一覧に居座る**。実測3,202肢。#9 営業保証金2 が「44問OKなのに終われない」のがこれで、
   保証協会の還付の肢（判定済みは #11）が #9 の『営業保証金の還付』章に載っていた。

   規則＝**チャンネルごとに、判定済みのリンクがあれば判定済みだけを一覧に使う。**
   ・判定がまだのチャンネルは今までどおり機械リンクを使う（＝判定が届いていない肢は消えない）
   ・**肢の下に出す動画のリンク（vidsOf）は今までどおり全部出す**＝飛べる先は減らさない
   ・data 側の need_seq も同じ規則で引き直す（tools/links_rule.py が唯一の実装）
   ・数え方を写した python＝tools/vid_items.py（app.html のこの箇所を sha で照合して止まる） */
function vidsForList(it){
  var vs=vidsOf(it),by={},out=[],i,sc;
  for(i=0;i<vs.length;i++){sc=VSRC[vs[i].vid]||'';(by[sc]=by[sc]||[]).push(vs[i])}
  Object.keys(by).forEach(function(k){
    var a=by[k],p=a.filter(function(v){return v.pick||isJudged(v)});
    out=out.concat(p.length?p:a);
  });
  return out;
}
var VIDIDS={},CHIDS={},CHIDS2={},SECOK={},NOVID=[],IPOS={},JLINKN=0,JSPAN=0;
ITEMS.forEach(function(it,ix){
  IPOS[it.id]=ix;                         /* 章の中の並びを元の順に保つための位置 */
  var vs=vidsForList(it);
  if(!vs.length){NOVID.push(it.id);return}
  var seen={};
  vs.forEach(function(v){
    if(!seen[v.vid]){seen[v.vid]=1;(VIDIDS[v.vid]=VIDIDS[v.vid]||[]).push(it.id)}
    if(typeof v.sec==='number'){var k=v.vid+'#'+v.sec;(CHIDS[k]=CHIDS[k]||[]).push(it.id);SECOK[v.vid]=true;
      if(isJudged(v)){
        JLINKN++;
        /* 親章の秒はデータ側が csec に入れてくれる（apply_retopic.py）。無い場合だけ自分で引く。
           どちらも同じ定義（全小分類の和で区間を切る）なので、答えは一致する。 */
        var cs=(typeof v.csec==='number')?v.csec:csecOf(v.vid,v.sec);
        if(cs!==null&&cs!==v.sec){var k2=v.vid+'#'+cs;(CHIDS2[k2]=CHIDS2[k2]||[]).push(it.id);JSPAN++}
      }
    }
  });
});
function videoItems(vid){return (VIDIDS[vid]||[]).map(function(i){return BY[i]})}
/* 章の問題＝「vid＋秒」で引く。章名も併用すると、同じ章名が2か所に出てくる動画（こうのすけ）で
   同じ問題が2つの行に二重に出て、行の合計が動画の問題数を超える。だから秒に一本化する。
   秒が合わないデータが来た場合は章が0問になるので、vStudy 側で警告を出して気づけるようにする。

   これに加えて、**肢ごとの判定で入れたリンクだけ**は区間 [章の秒, 次の章の秒) でも拾う
   （CHIDS2）。判定は「実際に話している秒」を指すので、完全一致だけだと章の行から消える。
   判定のリンクが1本も無いデータでは CHIDS2 が空なので、戻り値は以前と1件も変わらない。 */
function chapItems(vid,sec){
  var k=vid+'#'+sec,a=CHIDS[k]||[],b=CHIDS2[k];
  if(!b||!b.length)return a.map(function(i){return BY[i]});
  var seen={},ids=[];
  a.concat(b).forEach(function(i){if(seen[i])return;seen[i]=1;ids.push(i)});
  ids.sort(function(x,y){return (IPOS[x]||0)-(IPOS[y]||0)});   /* 元の並びを保つ */
  return ids.map(function(i){return BY[i]});
}
function secIn(it,vid){
  var vs=vidsOf(it);
  for(var i=0;i<vs.length;i++)if(vs[i].vid===vid&&typeof vs[i].sec==='number')return vs[i].sec;
  return null;
}
/* 紐づけの根拠になった語（データ側が videos[].why に持たせる） */
function whyOf(it,vid){
  var out=[];
  vidsOf(it).forEach(function(v){
    if(vid&&v.vid!==vid)return;
    (v.why||[]).forEach(function(w){if(out.indexOf(w)<0)out.push(w)});
  });
  return out;
}
/* ---------- 動画の通し番号（need_seq）と既習範囲 ----------
   2026-08-14 本人指摘「どの順番で動画を見てやるかが指標になると思う。動画に沿って欲しい」。
   データ側が各問題に need_seq（解くのに必要な通し番号）と first_seq を、
   data/curriculum.json にあこ課長の動画の通し番号を持つ。
   ここは「need_seq が無い古いデータでも落ちない」ことを最優先に組む（後方互換）。 */
var SEQV={};                       /* vid → 通し番号 */
var VLAB={},VNOC={};               /* vid → 見出し（label）／科目の中の番号（no） */
(function(){
  function put(vid,n){
    if(!vid||typeof n!=='number'||!isFinite(n))return;
    if(SEQV[vid]===undefined||n<SEQV[vid])SEQV[vid]=n;   /* 同じ動画が複数回出たら小さい方 */
  }
  function pick(o){
    if(!o||typeof o!=='object')return null;
    var k=['seq','no','num','n','index','idx','order'];
    for(var i=0;i<k.length;i++){var v=o[k[i]];if(typeof v==='number'&&isFinite(v))return v}
    for(i=0;i<k.length;i++){var t=o[k[i]];if(typeof t==='string'&&/^\d+$/.test(t))return +t}
    return null;
  }
  function row(e){                                       /* {seq,vid,label,no,alt...} の1件 */
    if(!e||typeof e!=='object')return;
    var vid=e.vid||e.id||e.videoId,n=pick(e);
    if(!vid)return;
    put(vid,n);
    if(typeof e.label==='string'&&e.label&&!VLAB[vid])VLAB[vid]=e.label;
    if(typeof e.no==='number'&&VNOC[vid]===undefined)VNOC[vid]=e.no;
    /* 同じ回の別バージョン（2025年版など）は同じ seq を共有する */
    var alt=e.alt||e.alts||e.also;
    if(alt){
      (typeof alt==='string'?[alt]:alt).forEach(function(a){
        var av=(typeof a==='string')?a:(a&&(a.vid||a.id));
        if(!av)return;
        put(av,n);
        if(typeof e.label==='string'&&!VLAB[av])VLAB[av]=e.label;
        if(typeof e.no==='number'&&VNOC[av]===undefined)VNOC[av]=e.no;
      });
    }
  }
  var C=window.TAKKEN_CURRICULUM;
  /* ①data/curriculum.json の形（現物）＝{note,subject_order,subject_range,count,order[],seq_of_vid{}} */
  if(C&&typeof C==='object'&&C.length===undefined){
    if(C.seq_of_vid&&typeof C.seq_of_vid==='object')
      Object.keys(C.seq_of_vid).forEach(function(v){put(v,C.seq_of_vid[v])});
    var A=C.order||C.videos||C.list;
    if(A&&A.length)for(var i0=0;i0<A.length;i0++)row(A[i0]);
  }
  /* ②配列だけ／{vid:seq} だけ／{"1":vid} だけ、でも読めるようにしておく（形が変わっても落ちない） */
  if(C&&C.length!==undefined){
    for(var i=0;i<C.length;i++){
      var e=C[i];
      if(!e)continue;
      if(typeof e==='string'){put(e,i+1);continue}
      if(pick(e)===null)put(e.vid||e.id||e.videoId,i+1);else row(e);
    }
  }else if(C&&typeof C==='object'){
    Object.keys(C).forEach(function(k){
      var v=C[k];
      if(typeof v==='number')put(k,v);                        /* {vid:seq} */
      else if(typeof v==='string'&&/^\d+$/.test(k))put(v,+k);  /* {"1":vid} */
    });
  }
  /* ③chapters.js の動画に seq が入っていればそれも使う（curriculum が無いとき用） */
  Object.keys(CHAP).forEach(function(cat){
    (CHAP[cat]||[]).forEach(function(v){var n=pick(v);if(n!==null)put(v.vid,n)});
  });
})();
var SEQN=Object.keys(SEQV).length;
/* need_seq を持つ問題があり、かつ vid→通し番号 が引けるときだけ新しい規則を使う */
var NEEDOK=(function(){
  if(!SEQN)return false;
  for(var i=0;i<ITEMS.length;i++)if(typeof ITEMS[i].need_seq==='number')return true;
  return false;
})();
function seqOfVid(vid){var n=SEQV[vid];return (typeof n==='number')?n:null}
function needSeq(it){return (it&&typeof it.need_seq==='number')?it.need_seq:null}
/* 見た動画の最大の通し番号（1本も見ていない＝null）。watched のキーは "vid#秒" */
function watchedMaxSeq(){
  var best=null;
  Object.keys(ST.watched||{}).forEach(function(k){
    var n=seqOfVid(String(k).split('#')[0]);
    if(n!==null&&(best===null||n>best))best=n;
  });
  return best;
}
/* 既習の上限＝見た動画の最大番号。動画から入ったときはその動画の番号も上限に含める
   （「この動画の問題を解く」で0問になるのを防ぐ＝その動画は今見ているものだから） */
function seqCap(vid){
  var w=watchedMaxSeq(),v=vid?seqOfVid(vid):null;
  if(v===null)return w;
  return (w===null||v>w)?v:w;
}
/* その問題が今の既習範囲で解けるか。need_seq が無いデータでは常に true（後方互換）。
   設定「未習の範囲も出す」がオンなら制限しない。 */
/* 出題してよい範囲かどうか。判定は unseenItems / newQueue と同じ＝
   「その科目の動画を見たか」。動画から入ったときはその動画の科目も含める。 */
/* いま解禁されている大分類の集合を1つ作る（見た動画＋いま基準にしている動画・科目）。
   問題1件ごとに作り直すと、視聴キー×全動画168本の線形走査が積み上がって
   全範囲5,294問で約4,400万回の比較になり、iPhoneが数秒固まる（2026-08-15 批評）。
   セッションの開始で1回だけ作り、inRange に渡して使い回す。 */
function openBigsNow(){
  var ob=openBigs();
  if(S.baseVid){var b=bigOfVid(S.baseVid);if(b)ob[b]=1}
  if(S.baseBig)ob[S.baseBig]=1;      /* 小分類から解くときはその科目を基準にする */
  return ob;
}
function inRange(it,ob){
  if(ST.settings&&ST.settings.ahead)return true;
  if(!ob)ob=openBigsNow();           /* 渡されなければ従来どおり自分で作る（呼び出し側を壊さない） */
  return !!ob[it.big];
}
/* その動画の問題のうち「その動画までの知識で解けるもの」＝動画学習の画面で数える単位 */
function videoItemsUp(vid){
  var all=videoItems(vid);
  if(!NEEDOK)return all;
  var cap=seqOfVid(vid);
  if(cap===null)return all;
  return all.filter(function(it){var n=needSeq(it);return n===null||n<=cap});
}
function chapItemsUp(vid,sec){
  var all=chapItems(vid,sec);
  if(!NEEDOK)return all;
  var cap=seqOfVid(vid);
  if(cap===null)return all;
  return all.filter(function(it){var n=needSeq(it);return n===null||n<=cap});
}
function baseSrc(){return S.baseSrc||DEFSRC}
/* 章のタイムライン順で使う秒数。
   基準の動画（S.baseVid）があればその動画の秒数だけを見る。
   無い場合は既定のチャンネル（あこ課長）の秒数を優先する。
   videos が空の問題（章が決まらなかった問題）は 99999＝「章なし」として末尾。 */
function secOf(it){
  var vs=vidsOf(it);if(!vs.length)return 99999;
  if(S.baseVid){var s=secIn(it,S.baseVid);return s===null?99999:s}
  var bp=9,bs=99999;
  for(var i=0;i<vs.length;i++){
    if(typeof vs[i].sec!=='number')continue;
    var p=(VSRC[vs[i].vid]===baseSrc())?0:1;
    if(p<bp||(p===bp&&vs[i].sec<bs)){bp=p;bs=vs[i].sec}
  }
  return bp===9?99999:bs;
}
/* ---------- 画面に出すラベルの選び方（2026-08-16） ----------
   videos[].chapter は「その秒が入っている動画の章の名前」で、chapters.json の真実。
   ★データはそのまま残す。変えるのは**表示のときにどれを見るか**だけ。

   なぜ変えるか：肢ごとの判定は「章の開始秒ではなく**実際に話している秒**」を指す。
   秒は正しいのでYouTubeは正しい位置に飛ぶが、章名はその秒が属する**親章**の名前なので、
   肢の中身と食い違う。実例（判定担当が字幕を読んで確認したもの）：
     ・採光1/7・換気1/20 の肢（-9K9ERXc7jI@648）→「必ず耐火にしないといけない規模」
     ・特別用途地区の用途制限の緩和（2NVEZvCaRao@1163）→「処理施設等」
     ・取消しと対抗関係（b1_2-004-1 ほか）→「【エンディング】」

   優先順位 ①判定の論点名 videos[].jtopic ②小見出し videos[].sub ③章名 videos[].chapter
   ・jtopic は tools/apply_retopic.py が入れる（まだ0件）。
   ・sub を章名より先に見るのは**判定で入れたリンク（isJudged）だけ**。
     判定以外の既存リンクは秒が章頭なので章名の方が正しく、ここを無条件にすると
     sub を持つ既存の3,779本のラベルが今日いきなり変わる。だから条件を付ける。
   ⇒ jtopic が0件・判定のリンクが0本の**いまのデータでは、戻り値は今までと1文字も変わらない**。 */
function jtopOf(v){var s=v&&v.jtopic;return (typeof s==='string')?s.trim():''}
/* 論点名の末尾に付く条文の出典（「（業法50条2項）」「（最判昭45.7.24）」）はラベルに要らない。
   落とすのは**丸ごと1つの括弧**だけ。文の途中は削らない＝「…」で切って
   何の論点か分からなくすることは絶対にしない。 */
/* 末尾の括弧が「出典だけ」かどうかを、括弧の中身を読んで決める（全5,237件で目視した）。
   ①数字が入っている ②条・項・号・判・規則 等の語が入っている
   ③**ひらがなが「の」しか無い**（「の」は「64条の8」のような枝番でしか出ない）
   3つとも満たすものだけ落とす。実測：落ちる 2,397件（「（業法50条2項）」「（大判昭17.9.30）」）。
   説明が混ざった括弧は残る（「（名義書換えだけでは足りない・民法467条）」「（後払い・614条）」
   「（5人に1人・2週間以内に補充）」「（貸借でも必要）」）＝中身を黙って削らない。 */
var CITEP=/（([^（）]*)）$/;
function isCite(s){
  if(!/[0-9０-９〇一二三四五六七八九十]/.test(s))return false;
  if(!/(条|項|号|判|規則|通達|準則|.法)/.test(s))return false;
  /* 「の」（64条の8 の枝番）と「ただし書・かっこ書」は出典の一部なので、ひらがなに数えない */
  if(/[ぁ-ん]/.test(s.replace(/ただし書|かっこ書|の/g,'')))return false;
  return true;
}
function trimCite(s){
  var t=String(s||'').trim(),n=0,m;
  while(n<3&&(m=CITEP.exec(t))&&isCite(m[1])){t=t.slice(0,m.index).trim();n++}
  return t||String(s||'').trim();
}
/* リンク1本ぶんの表示ラベル。無ければ空文字（呼び側が it.topic などへ落とす） */
function vlabOf(v){
  /* 回答前は論点名を出さない。論点名は「何を問い答えがどちらか」を書いた文なので、
     出題中に見せると答えが読めてしまう（2026-08-16 本人指摘）。解説が出てから使う。 */
  var j=(S&&S.view==='quiz'&&S.phase==='q')?'':jtopOf(v);
  if(j)return trimCite(j);
  if(v&&v.sub&&isJudged(v))return v.sub;
  return (v&&v.chapter)||'';
}
/* 章の行（動画学習）に載っている肢の論点。1件も無ければ null＝動画の章名のまま。
   「ほかN」の数え方は小見出しの行（subLabel）と同じ規約にそろえる。
   全問なめるので (vid,sec) ごとに1回だけ作って持っておく。 */
var CHLAB={};
function chapTopicLab(vid,sec){
  var k=vid+'#'+sec;
  if(CHLAB[k]!==undefined)return CHLAB[k];
  var seen={},a=[];
  chapItems(vid,sec).forEach(function(it){
    vidsOf(it).forEach(function(v){
      if(v.vid!==vid)return;
      var cs=(typeof v.csec==='number')?v.csec:v.sec;
      if(cs!==sec&&v.sec!==sec)return;
      var j=jtopOf(v);if(!j)return;
      j=trimCite(j);
      if(!seen[j]){seen[j]=1;a.push(j)}
    });
  });
  CHLAB[k]=a.length?{head:a[0],extra:a.length-1}:null;
  return CHLAB[k];
}
/* 章の行・「次の章へ」・ホームの「続き」で使う1つの文字列（3か所で同じ名前を出すため） */
function chapRowLab(vid,sec,fb){
  var t=chapTopicLab(vid,sec);
  return t?(t.head+(t.extra?'　ほか'+t.extra:'')):(fb||'');
}
/* 単元学習の小見出しの行。区切り方（catSubs）は変えない＝粒度はそのまま。
   その区切りに入っている肢が論点名を持っていれば、行の名前だけ論点に差し替える
   （実例：専任宅建士・帳簿の肢の行に「契約締結誘引の禁止」と出ていた）。
   分割の「（1/3）」は落とさずに付け直す。論点名が1件も無ければ今までの見出しのまま。 */
function usubLab(s){
  if(!s)return '';
  var seen={},a=[];
  (s.ids||[]).forEach(function(i){
    var it=BY[i];if(!it)return;
    vidsOf(it).forEach(function(v){
      var j=jtopOf(v);if(!j)return;
      j=trimCite(j);
      if(!seen[j]){seen[j]=1;a.push(j)}
    });
  });
  if(!a.length)return s.sub;
  var m=/（[0-9]+\/[0-9]+）$/.exec(s.sub||'');
  return a[0]+(a.length>1?'　ほか'+(a.length-1):'')+(m?m[0]:'');
}
function chapOf(v,it){
  var lb=vlabOf(v);
  return {vid:v.vid,sec:(typeof v.sec==='number'?v.sec:0),title:v.title||VTIT[v.vid]||'',
          label:lb||it.topic||it.cat,jt:!!jtopOf(v),member:!!(v.member||VMEM[v.vid]),
          src:VSRC[v.vid]||'',why:v.why||[]};
}
/* その問題を代表する章（基準の動画→既定チャンネル→先頭） */
/* 代表の章＝①基準の動画（動画学習で選んでいる1本。本人が明示した範囲なので最優先）
   ②検証済みのリンク（pick）③既定のチャンネル ④先頭。
   ②を③より先にするのが 2026-08-15 の直し（内容が第1・チャンネルが第2）。
   ①は据え置き＝「基準の動画」の切り替えは pick に上書きされない。 */
function chapFor(it){
  var vs=vidsOf(it);if(!vs.length)return null;
  var best=null,bp=9;
  vs.forEach(function(v){
    var p=(S.baseVid&&v.vid===S.baseVid)?0:(v.pick?1:((VSRC[v.vid]===baseSrc())?2:3));
    if(p<bp){bp=p;best=v}
  });
  return chapOf(best||vs[0],it);
}
/* その問題が出てくる全部の章（同じ問題が複数の動画に現れるのが正しい状態） */
function chapsFor(it){return vidsOf(it).map(function(v){return chapOf(v,it)})}
function vurl(vid,sec){return 'https://youtu.be/'+vid+'?t='+(sec||0)}
/* 図表：単一ファイル版では build.py が window.TAKKEN_FIGS に data URI を埋め込む。
   開発用の app.html では figs/ の相対パスをそのまま使う。 */
function figSrc(p){var m=window.TAKKEN_FIGS;return (m&&m[p])?m[p]:p}
function mmss(s){s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+pad(s%60)}

/* ---------- 日付 ---------- */
function pad(n){return n<10?'0'+n:''+n}
function nowStamp(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())}
/* 「その日」の区切りは0時ではなく3時（本人は未明に解く日がある。別アプリ Focus と同じ規約）。
   0時で切ると、日をまたいだ瞬間に ①今日の「◯/83問」が0に戻り ②抜き打ちがもう1回出て
   ③復習の休み日数が1日進む＝1回の勉強が2日に割れる（2026-08-15 批評）。
   記録に残す時刻（nowStamp）は実時刻のまま。変えるのは「どの日として数えるか」だけ。 */
var DAYSHIFT=3;
function today(){
  var d=new Date(Date.now()-DAYSHIFT*3600000);
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
/* 保存してある時刻の文字列（nowStamp形式）を論理日に直す。
   日付だけの文字列（lastOk など）は既に論理日なのでそのまま返す。 */
function dayOfStamp(s){
  if(!s)return null;
  s=String(s);
  if(s.length<13)return s.slice(0,10);
  return (+s.slice(11,13)<DAYSHIFT)?addD(s.slice(0,10),-1):s.slice(0,10);
}
function dnum(s){if(!s)return null;var p=String(s).slice(0,10).split('-');if(p.length<3)return null;return Date.UTC(+p[0],+p[1]-1,+p[2])/86400000}
function dgap(a,b){var x=dnum(a),y=dnum(b);return (x===null||y===null)?0:Math.round(y-x)}
function addD(day,n){var d=new Date((dnum(day)+n)*86400000);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}

/* ---------- 進行状況（localStorage takken_v1） ---------- */
var LSOK=true;
var ST=loadST();
applyTheme();          /* 保存されている配色を、描画より前に当てる（切り替わりが見えない） */
setTimeout(function(){try{ghAuto('boot')}catch(e){}},4000);    /* 起動のたび（中身が変わっていれば） */
/* 記録が壊れて読めなかったら、**元の文字列を退避してから**空で始める。
   退避しないと直後の saveST() が原本を上書きして、部分的に救えたはずの記録まで消える
   （2026-08-15 批評で判明。本人は一度、記録を全部失っている）。 */
function loadST(){
  var raw=null,o={};
  try{raw=localStorage.getItem(LSK)}catch(e){LSOK=false}
  try{o=JSON.parse(raw||'{}')||{}}
  catch(e){
    o={};LSOK=false;
    try{
      if(raw){
        localStorage.setItem(LSK+'_broken_'+String(nowStamp()).replace(/[^0-9]/g,''),raw);
        STBROKEN=true;
      }
    }catch(e2){}
  }
  return normST(o);
}
var STBROKEN=false;
function normST(o){
  if(!o||typeof o!=='object')o={};
  if(!o.items||typeof o.items!=='object')o.items={};
  if(!o.watched||typeof o.watched!=='object')o.watched={};
  if(!o.session||typeof o.session!=='object')o.session={total:0,right:0};
  if(typeof o.session.streak!=='number')o.session.streak=0;  /* 連続正解（誤答で0） */
  if(typeof o.session.best!=='number')o.session.best=0;      /* 連続正解の最大 */
  if(!o.days||typeof o.days!=='object')o.days={};   /* SPEC外の拡張：日別学習量（分析用） */
  if(!o.settings||typeof o.settings!=='object')o.settings={};
  /* 演出：auto＝3段階（既定）／strong＝毎問フル／weak＝弱／off＝なし */
  if(['auto','strong','weak','off'].indexOf(o.settings.fx)<0)o.settings.fx='auto';
  if(typeof o.settings.sound!=='boolean')o.settings.sound=false;   /* 音は既定オフ */
  if(!o.closedSeen||typeof o.closedSeen!=='object')o.closedSeen={}; /* 最大演出を出した小分類 */
  /* 解き切ったチェックの回（キー＝配信の時刻）。持たないと開き直したときに行が戻る。 */
  if(!o.checkDone||typeof o.checkDone!=='object')o.checkDone={};
  if(!Array.isArray(o.mock))o.mock=[];          /* 模試の結果（前提の校正に使う） */
  if(o.mockRun===undefined)o.mockRun=null;      /* 途中の模試（閉じても戻れる） */
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.settings.exam||''))o.settings.exam=EXAM_DEFAULT;  /* 試験日 */
  if(typeof o.settings.min!=='number'||o.settings.min<10)o.settings.min=120;         /* 1日の学習時間（分） */
  if(typeof o.settings.vmin!=='number'||o.settings.vmin<0)o.settings.vmin=39;        /* うち動画を見る時間（分） */
  /* settings.hint（スワイプの案内を出した回数）はスワイプ廃止で不要になったので持たない */
  if(o.settings.hint!==undefined)delete o.settings.hint;
  if(typeof o.settings.ahead!=='boolean')o.settings.ahead=false;  /* 未習の範囲も出す（既定＝オフ） */
  /* 学習タブのどちらで進んでいたか（video＝動画で進む／cat＝単元で進む）。
     次に開いたときも同じ側を出す（2026-08-15 本人の注文「動画学習か単元学習で分けて」）。
     2026-08-15 本人指示「単元学習をメインにしたい」＝**未設定のときの既定を単元側にする**。
     すでに保存されている選択（cat/video）はここでは触らない＝本人の選択を尊重する。 */
  if(o.settings.fmode!=='cat'&&o.settings.fmode!=='video')o.settings.fmode='cat';
  /* 「単元で進む」の大分類パネルの開閉（{大分類:true/false}）。null＝まだ一度も触っていない
     ＝そのときは既定（残りがある最初の大分類だけ開く）を使う＝ubOpenMap() 参照。 */
  if(!o.settings.ubOpen||typeof o.settings.ubOpen!=='object')o.settings.ubOpen=null;
  /* 記録を失わないための3つ。lastExport＝最後に書き出した日／a2hs＝ホーム画面の案内を閉じたか
     ／persist＝navigator.storage.persist() の結果（記録用・null＝未対応か未応答） */
  if(typeof o.settings.lastExport!=='string')o.settings.lastExport=null;
  if(typeof o.settings.a2hs!=='boolean')o.settings.a2hs=false;
  if(!/^[1-9]$/.test(o.settings.theme||''))o.settings.theme='1';   /* 配色（既定＝1 桜鼠） */
  if(!o.settings.gh||typeof o.settings.gh!=='object')o.settings.gh={};   /* GitHubバックアップの設定 */
  if(o.settings.persist!==true&&o.settings.persist!==false)o.settings.persist=null;
  /* 動画ごとの進捗（完了の単位＝動画1本）。
     {vid:{done:[],wrong:[],round:0,completedAt:null,watchMs:0,quizMs:0}}
     watchMs＝その動画を見ていた実測時間／quizMs＝その動画の問題を解いた実測時間 */
  if(!o.vp||typeof o.vp!=='object')o.vp={};
  /* 学習時間の実測（日別・種類別のミリ秒）。{ "2026-08-14": {video,new,review,sneak} } */
  if(!o.tlog||typeof o.tlog!=='object')o.tlog={};
  /* 「動画を見る」を押した時刻（アプリに戻った時点との差を watchMs に積む） */
  if(!o.wpend||typeof o.wpend!=='object')o.wpend=null;
  /* 出題セッション（中断と再開）。SPEC §2 の session は成績用に使っているので run という名前にした。
     {queue:[id...],qi,label,sort,filter,startedAt,lastAt} */
  /* 直前に解いた章（ホームの「続き」の起点）。{vid,sec,label}。
     S.roundSec はセッションを跨げないので記録の側に持つ（2026-08-15 本人指示）。 */
  if(!o.lastChap||typeof o.lastChap!=='object'||typeof o.lastChap.vid!=='string'
     ||typeof o.lastChap.sec!=='number')o.lastChap=null;
  if(!o.run||typeof o.run!=='object'||!o.run.queue||!o.run.queue.length)o.run=null;
  if(o.run){
    if(!Array.isArray(o.run.wrongs))o.run.wrongs=[];      /* 旧データには無い */
    if(typeof o.run.round!=='number')o.run.round=0;
    if(typeof o.run.roundVid!=='string')o.run.roundVid=o.run.baseVid||null;
  }
  return o;
}
function saveST(){try{localStorage.setItem(LSK,JSON.stringify(ST));LSOK=true}catch(e){LSOK=false}}
function R(id){return ST.items[id]||null}
function mk(id){
  var r=ST.items[id];
  if(!r){r={ok:0,ng:0,streak:0,last:null,lastNg:null,box:1,due:null,state:'新規',why:[],star:false,memo:''};ST.items[id]=r}
  if(!r.why)r.why=[];
  return r;
}
function att(r){return r?(r.ok||0)+(r.ng||0):0}
function rateOf(r){var a=att(r);return a?(r.ok||0)/a:null}
function isGrad(r){return !!r&&r.state==='卒業'}
/* 状態＝連続正解の回数で決める（4回＝休み14日に到達した状態を「卒業」と呼ぶ） */
function stateOf(id){
  var r=R(id);if(!r||att(r)===0)return '新規';
  if((r.streak||0)>=4)return '卒業';
  return (r.streak||0)>=2?'定着':'学習中';
}
function refreshRec(r){
  r.state=(att(r)===0?'新規':((r.streak||0)>=4?'卒業':((r.streak||0)>=2?'定着':'学習中')));
  r.box=Math.min(REST.length-1,Math.max(0,r.streak||0));   /* 休ませる段（画面の目盛り用） */
  r.due=addD(lastDay(r),restDays(r));                      /* 次に出せる日 */
}
/* 休ませる日数と、最後に解いた日 */
function restDays(r){return REST[Math.min(REST.length-1,Math.max(0,(r&&r.streak)||0))]}
function lastDay(r){
  var d=(r&&((r.streak>0?r.lastOk:null)||r.lastNg||r.last))||today();
  return dayOfStamp(d);      /* lastNg・last は実時刻なので論理日（3時区切り）に直してから比べる */
}
/* 抜き打ちに出せるか＝休みが明けているか */
function restReady(id){
  var r=R(id);if(!r||att(r)===0)return false;
  return dgap(lastDay(r),today())>=restDays(r);
}
function restLeft(id){
  var r=R(id);if(!r)return 0;
  return Math.max(0,restDays(r)-dgap(lastDay(r),today()));
}
/* ---------- 記録が消えないようにする（2026-08-14 UX調査より） ----------
   Safariのタブとして開いたままだと、7日間使わないと localStorage が消える。
   ホーム画面に追加したWebアプリは対象外（WebKit Tracking Prevention）。
   だから ①永続化を要求する ②ホーム画面に追加していなければ1行だけ案内する
   ③7日以上バックアップしていなければ書き出しを1行で促す。いずれも常設しない（SPEC §5-1）。 */
function standalone(){
  try{
    if(window.navigator&&window.navigator.standalone===true)return true;              /* iOS Safari */
    if(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)return true;
  }catch(e){}
  return false;
}
/* 永続化の要求。対応していない環境では何もしない（結果だけ settings.persist に残す）。 */
function askPersist(){
  try{
    var st=navigator.storage;
    if(!st)return null;
    if(st.persist)return st.persist().then(function(ok){
      ST.settings.persist=!!ok;saveST();return !!ok;
    })['catch'](function(){return null});
    if(st.persisted)return st.persisted().then(function(ok){
      ST.settings.persist=!!ok;saveST();return !!ok;
    })['catch'](function(){return null});
  }catch(e){}
  return null;
}
/* 最後の書き出しからの日数（未実施は null） */
function exportGap(){
  var d=ST.settings&&ST.settings.lastExport;
  return d?dgap(d,today()):null;
}
/* 促すのは「記録があって、7日以上書き出していない（または一度も書き出していない）」ときだけ */
function needExport(){
  if(!Object.keys(ST.items).length)return false;
  var g=exportGap();
  return g===null||g>=7;
}
function markExport(){ST.settings.lastExport=today();saveST()}

/* ---------- 試験日と1日の枠 ---------- */
function examDay(){return (ST.settings&&ST.settings.exam)||EXAM_DEFAULT}
function daysLeft(){return Math.max(0,dgap(today(),examDay()))}
/* 1日に解ける問題数＝（学習時間 − 動画を見る時間）÷ 1問30秒。
   動画の時間は、実測（直近7日の平均）が取れていればそれを使い、無ければ設定の固定値。 */
function vminUsed(){
  var r=vminReal();
  return (r===null)?((ST.settings&&ST.settings.vmin)||39):r;
}
function dayCap(){
  var m=((ST.settings&&ST.settings.min)||120)-vminUsed();
  return Math.max(1,Math.round(Math.max(1,m)*60/SEC_PER_Q));
}

/* ---------- 解答 ---------- */
function answer(id,userOx){
  var it=BY[id],r=mk(id),t=today(),ok=(userOx===it.ox);
  var pre=r.box||0,wasGrad=(r.state==='卒業'),gap=0;
  /* この回答が「その問題を初めて解いた」ものか＝新規を消化した数の分子
     （復習・抜き打ち・間違い直しは数えない。2026-08-15 本人指定） */
  var isFirst=(att(r)===0);
  r.last=nowStamp();r._pre=pre;r._why=null;r._preStreak=r.streak||0;
  ST.session.total=(ST.session.total||0)+1;if(ok)ST.session.right=(ST.session.right||0)+1;
  /* この1回（周回なら「その周」）ぶんの成績。完走リザルトはこちらを出す＝通算と混ぜない */
  S.sT=(S.sT||0)+1;
  if(ok){S.sR=(S.sR||0)+1;S.sStreak=(S.sStreak||0)+1;if(S.sStreak>(S.sBest||0))S.sBest=S.sStreak}
  else S.sStreak=0;
  /* 連続正解（localStorageに保存。誤答で0・bestは最大値を保持） */
  if(ok){
    ST.session.streak=(ST.session.streak||0)+1;
    if(ST.session.streak>(ST.session.best||0))ST.session.best=ST.session.streak;
    FXST.lost=0;
  }else{
    FXST.lost=ST.session.streak||0;
    ST.session.streak=0;
  }
  FXST.streak=ST.session.streak||0;
  var d=ST.days[t]||{n:0,ok:0};d.n++;if(ok)d.ok++;
  if(isFirst)d.newq=(d.newq||0)+1;                 /* 今日はじめて解いた問題の数 */
  ST.days[t]=d;
  /* 連続正解が伸びるほど休ませる日数が伸びる（1→3→7→14日）。間違えたら翌日に戻る。 */
  if(ok){
    r.ok=(r.ok||0)+1;r.streak=(r.streak>0?r.streak:0)+1;
    gap=r.lastOk?dgap(r.lastOk,t):0;r.lastOk=t;
    if((r.streak||0)>=4)r.grad=t;                            /* 休み14日に到達＝卒業扱い */
  }else{
    r.ng=(r.ng||0)+1;r.streak=0;r.lastNg=nowStamp();r.grad=null;
  }
  /* 間違えた問題は、その場の周回（間隔なし・当日）と動画の進捗にも積む */
  if(!ok){
    if(S.wrongs.indexOf(id)<0)S.wrongs.push(id);
    vpMark(id,false);
  }else{
    var wi=S.wrongs.indexOf(id);if(wi>=0)S.wrongs.splice(wi,1);
    vpMark(id,true);
  }
  refreshRec(r);saveST();
  return {ok:ok,gap:gap};
}
/* 動画ごとの進捗（完了の単位＝動画1本） */
function vpOf(vid){
  var v=ST.vp[vid];
  if(!v){v={done:[],wrong:[],round:0,completedAt:null,watchMs:0,quizMs:0};ST.vp[vid]=v}
  if(!v.done)v.done=[];if(!v.wrong)v.wrong=[];
  if(typeof v.watchMs!=='number')v.watchMs=0;
  if(typeof v.quizMs!=='number')v.quizMs=0;
  return v;
}
/* ---------- 学習時間の実測（2026-08-14 本人指示「実際に勉強した時間を出してほしい」） ----------
   内訳は4つ＝video（動画を見ていた時間）／new（新規の問題）／review（間違い直し）／sneak（抜き打ち）。
   日別に持つので「今日／直近7日／通算」を同じ数字から出せる。 */
var TKINDS=[['video','動画'],['new','新規'],['review','復習'],['sneak','抜き打ち']];
function tlogDay(day){
  var d=ST.tlog[day];
  if(!d){d={video:0,'new':0,review:0,sneak:0};ST.tlog[day]=d}
  TKINDS.forEach(function(k){if(typeof d[k[0]]!=='number')d[k[0]]=0});
  return d;
}
/* 解いていた時間を積む。vid が分かるときは「基準の動画1本だけ」に積む＝二重計上しない。 */
function addStudyMs(kind,vid,ms){
  if(!(ms>0))return;
  if(['video','new','review','sneak'].indexOf(kind)<0)kind='new';
  tlogDay(today())[kind]+=ms;
  if(vid&&kind!=='video')vpOf(vid).quizMs+=ms;
}
/* 日別の合計（n日ぶん・n=null で通算）。返すのはミリ秒 */
function tlogSum(n){
  var out={video:0,'new':0,review:0,sneak:0,total:0},t=today();
  Object.keys(ST.tlog).forEach(function(day){
    if(n!==null&&n!==undefined){var g=dgap(day,t);if(g<0||g>n-1)return}
    var d=ST.tlog[day];
    TKINDS.forEach(function(k){var v=+d[k[0]]||0;out[k[0]]+=v;out.total+=v});
  });
  return out;
}
/* 動画1本にかけた実測時間＝視聴＋その動画の問題（復習・抜き打ちは混ぜない＝行に出すのはこれ） */
function vidMs(vid){var v=ST.vp[vid];return v?((+v.watchMs||0)+(+v.quizMs||0)):0}
/* 「動画を見る」を押した：戻ってきた時刻との差を watchMs に積むため、押した時刻を控える。
   ★限界：アプリ内で再生しない（YouTubeへ飛ぶ）ので、他のアプリを触っていた時間や
     動画を止めて放置した時間が混ざり得る。だから「その動画の尺の1.5倍」で切り、
     10秒未満は積まない。厳密な視聴時間ではなく実測の目安として扱う。 */
function watchStart(vid){
  if(!vid)return;
  ST.wpend={vid:vid,at:Date.now()};
  saveST();
}
function watchEnd(){
  var w=ST.wpend;
  if(!w||!w.vid||!w.at)return 0;
  ST.wpend=null;
  var ms=Date.now()-w.at;
  var cap=Math.round((VLEN[w.vid]||0)*1500);          /* 尺の1.5倍（ミリ秒）で切り捨てる */
  if(cap>0&&ms>cap)ms=cap;
  if(ms<10000){saveST();return 0}                     /* 10秒未満は積まない */
  vpOf(w.vid).watchMs+=ms;
  tlogDay(today()).video+=ms;
  saveST();
  return ms;
}
/* 直近7日の動画視聴の実測平均（分）。実測が無ければ null＝設定の固定値を使う */
function vminReal(){
  var ms=0,days=0,t=today();
  Object.keys(ST.tlog).forEach(function(day){
    var g=dgap(day,t);
    if(g<0||g>6)return;
    var v=+ST.tlog[day].video||0;
    if(v>0){ms+=v;days++}
  });
  if(!days)return null;
  return Math.round(ms/days/60000);
}
function vpMark(id,ok){
  var it=BY[id];if(!it)return;
  vidsOf(it).forEach(function(v){
    var p=vpOf(v.vid),di=p.done.indexOf(id),wi=p.wrong.indexOf(id);
    if(ok){if(di<0)p.done.push(id);if(wi>=0)p.wrong.splice(wi,1)}
    else{if(wi<0)p.wrong.push(id);if(di>=0)p.done.splice(di,1)}
  });
}
/* 動画1本の状況：n問中いくつ正解・残り何問・完了したか */
function videoStat(vid){
  var its=videoItemsUp(vid),okn=0,ngn=0;
  its.forEach(function(it){
    var r=R(it.id);if(!r||att(r)===0)return;
    if((r.streak||0)>0||r.state==='卒業')okn++;else ngn++;
  });
  var p=ST.vp[vid]||{};
  return {n:its.length,ok:okn,wrong:ngn,left:its.length-okn,
          done:its.length>0&&okn===its.length,round:p.round||0,completedAt:p.completedAt||null};
}
/* 次の動画＝同じチャンネルの公開順（あこ課長のシリーズ番号順） */
var VORDER=null;
function vidOrder(){
  if(VORDER)return VORDER;
  var seen={},all=[];
  Object.keys(CHAP).forEach(function(c){(CHAP[c]||[]).forEach(function(v){
    if(seen[v.vid])return;seen[v.vid]=1;
    all.push({vid:v.vid,src:v.source||'',up:v.upload||'',title:v.title||''});
  })});
  all.sort(function(a,b){return (a.src<b.src?-1:a.src>b.src?1:0)||(a.up<b.up?-1:a.up>b.up?1:0)});
  VORDER=all;return all;
}
/* 1本目の動画＝主教材（あこ課長）の「宅建業法 #1【宅建業】」（動画ID vkCEbvUwU6A）。
   2026-08-14 訂正：カリキュラムは 宅建業法 → 権利関係 → 法令上の制限 → 税・その他 → 5問免除 の順
   （2026年版の公開日が 業法 01-05〜03-15／権利 03-16〜06-18／法令 06-21〜08-09）。
   本人の手順が「動画を見る → その動画の問題を解く」なので、履歴が0のときの入口はここに固定する。
   IDでも題名でも見つからないデータが来たときは、通し番号（または公開順）で主教材の最初の動画に落とす。 */
var FIRSTVID='vkCEbvUwU6A';
var FIRSTV=undefined;
function firstVid(){
  if(FIRSTV!==undefined)return FIRSTV;
  var a=vidOrder().filter(function(v){return v.src===DEFSRC&&videoItems(v.vid).length});
  var hit=null,i;
  for(i=0;i<a.length;i++)if(a[i].vid===FIRSTVID){hit=a[i];break}
  if(!hit)for(i=0;i<a.length;i++){
    if(/(宅建)?業法\s*#1[^0-9]/.test(a[i].title||'')){hit=a[i];break}
  }
  if(!hit){                                   /* 通し番号がいちばん小さい主教材の動画 */
    var best=null,bs=null;
    a.forEach(function(v){var s=seqOfVid(v.vid);if(s!==null&&(bs===null||s<bs)){bs=s;best=v}});
    hit=best;
  }
  FIRSTV=hit||a[0]||null;
  return FIRSTV;
}
/* その動画を開くべき小分類＝同じ動画が複数の小分類に載るので、
   その動画に紐づく問題がいちばん多い小分類を選ぶ（同数なら一覧の順）。 */
function catOfVid(vid){
  var cnt={};
  videoItems(vid).forEach(function(it){if(it)cnt[it.cat]=(cnt[it.cat]||0)+1});
  var best=null,bn=-1;
  Object.keys(CHAP).forEach(function(c){
    var has=(CHAP[c]||[]).some(function(v){return v.vid===vid});
    if(!has)return;
    var n=cnt[c]||0;
    if(n>bn){bn=n;best=c}
  });
  return best;
}
/* 動画の題名を短く（「宅建 2026 権利関係 #1【契約】」まで） */
function vshort(t){
  t=String(t||'');
  var m=t.match(/^.*?#\d+【[^】]*】/);
  return (m?m[0]:t.slice(0,28)).replace(/^宅建\s*\d{4}\s*/,'');
}
/* 一覧の行に出す見出し（curriculum の label を優先し、無ければ題名の【】から取る） */
function vlab(vid){return VLAB[vid]||vlabel(VTIT[vid]||'')}
/* 題名から見出しだけを取り出す（「宅建 2026 権利関係 #4【意思表示1】…」→「意思表示1」） */
/* 一覧に出す短い名前。チャンネルごとに題名の付け方が違うので順に試す。
   ・こうのすけ＝【超有料級の宅建講座】「制限行為能力者」の… → 鉤括弧の中を使う
   ・こざりえ  ＝【宅建】『宅建業法』最短合格…            → 二重鉤括弧の中を使う
   ・あこ課長  ＝宅建 2026 権利関係 #2【制限行為能力者1】  → 【】の中を使う
   2026-08-15 本人指摘：どれも「超有料級の宅建講座」になって論点が分からなかった。 */
function vlabel(t){
  t=String(t||'');
  var m=t.match(/「([^」]{2,24})」/);            /* こうのすけ */
  if(m)return m[1];
  m=t.match(/『([^』]{2,24})』/);                /* こざりえ */
  if(m)return m[1];
  m=t.match(/【([^】]*)】/);                     /* あこ課長 */
  if(m&&!/宅建$|^宅建$|講座|チャンネル/.test(m[1]))return m[1];
  m=t.match(/^宅建\s*\d{4}\s*(?:[^#]*#\d+)?\s*(.{0,18})/);
  return (m&&m[1])?m[1]:t.slice(0,18);
}
/* 一覧の行に出す番号（動画の題名の「#4」＝あこ課長の科目ごとの再生リスト番号）。
   curriculum.js の通し番号（seq）が入ればそれも使えるが、本人がYouTubeで見ている
   番号は題名の #N なので、表示はこちらを優先する。 */
function vno(vid){
  if(typeof VNOC[vid]==='number')return VNOC[vid];
  var m=String(VTIT[vid]||'').match(/#(\d+)/);
  if(m)return +m[1];
  /* 通し番号（seq）では代用しない。科目の中の番号とは別の数なので、
     代用すると「#22 → #23（特例）→ #23（監督処分1）」のように同じ番号が2回出る。
     番号が無い動画（特例・図解・法改正のまとめ）は番号を出さない。 */
  return null;
}
/* ---------- 大分類 → その大分類の動画（再生リスト順） ----------
   2026-08-14 本人指摘「権利関係をやるんだったら権利関係の動画を再生リスト順に順番にやる」。
   科目の学習順＝宅建業法 → 権利関係 → 法令上の制限 → 税・その他 → 5問免除
   （あこ課長2026年版の公開日がこの順＝業法 01-05〜03-15／権利 03-16〜06-18／法令 06-21〜08-09）。 */
var BIGLEARN=['宅地建物取引業法等','権利関係','法令上の制限','税に関する法令',
              '不動産価格の評定','土地・建物その他の需給'];
var VBIG={},BIGVIDS={};
(function(){
  vidOrder().forEach(function(v){
    var c=catOfVid(v.vid);if(!c)return;
    var b=CINFO[c]?CINFO[c].big:null;if(!b)return;
    VBIG[v.vid]=b;
    (BIGVIDS[b]=BIGVIDS[b]||[]).push(v.vid);
  });
  /* 主教材（あこ課長）を先に、その中は 通し番号 → 題名の#N → 公開日 の順に並べる */
  var up={};vidOrder().forEach(function(v,i){up[v.vid]=i});
  Object.keys(BIGVIDS).forEach(function(b){
    BIGVIDS[b].sort(function(x,y){
      var mx=(VSRC[x]===DEFSRC)?0:1,my=(VSRC[y]===DEFSRC)?0:1;
      if(mx!==my)return mx-my;
      var sx=seqOfVid(x),sy=seqOfVid(y);
      if(sx!==null&&sy!==null&&sx!==sy)return sx-sy;
      var nx=vno(x),ny=vno(y);
      if(nx!==null&&ny!==null&&nx!==ny)return nx-ny;
      return up[x]-up[y];
    });
  });
})();
/* 画面に出す大分類の順＝学習順。通し番号が分かるならその大分類の最小の番号で並べ替える */
function bigsOrdered(){
  var a=BIGS.slice();
  var mins={};
  a.forEach(function(b){
    var m=null;
    (BIGVIDS[b]||[]).forEach(function(v){
      if(VSRC[v]!==DEFSRC)return;
      var s=seqOfVid(v);
      if(s!==null&&(m===null||s<m))m=s;
    });
    mins[b]=m;
  });
  var anySeq=a.some(function(b){return mins[b]!==null});
  a.sort(function(x,y){
    if(anySeq){
      var mx=mins[x]===null?99999:mins[x],my=mins[y]===null?99999:mins[y];
      if(mx!==my)return mx-my;
    }
    var ix=BIGLEARN.indexOf(x),iy=BIGLEARN.indexOf(y);
    return (ix<0?99:ix)-(iy<0?99:iy);
  });
  return a;
}
/* 小分類から解くときの「基準の動画」。主教材（こざりえ）を優先し、その中では公開が新しいもの。
   2026-08-15 検証：**その小分類と同じ科目の動画に限る**。こざりえは1本＝1科目なので、
   税の小分類にも「税・価格」1本が付き、bigOfVid が『不動産価格の評定』になる。
   それを基準にすると解禁の集合に『税に関する法令』が入らず、54問すべてが落ちて0問になっていた。
   同じ科目の動画が無ければ null を返し、科目基準（S.pendBig）だけで解禁する。 */
function catBaseVid(cat,big){
  var best=null,up='';
  (CHAP[cat]||[]).forEach(function(v){
    if(big&&bigOfVid(v.vid)!==big)return;          /* 別の科目の動画は基準にしない */
    var pr=(v.source===DEFSRC)?2:1,cur=best?((VSRC[best]===DEFSRC)?2:1):0;
    if(pr>cur||(pr===cur&&(v.upload||'')>up)){best=v.vid;up=v.upload||''}
  });
  return best;
}
/* 大分類の進み＝その大分類の問題のうち1回でも正解した数 */
function bigProg(big){
  var n=0,ok=0;
  ITEMS.forEach(function(it){
    if(it.big!==big)return;
    n++;
    var r=R(it.id);if(r&&(r.ok||0)>0)ok++;
  });
  return {n:n,ok:ok,pct:n?Math.round(ok/n*100):0};
}
/* 「次の動画へ」＝カリキュラムの次の科目の動画。
   公開日順で追ってはいけない（2026-08-15 批評で判明）。こざりえ2026年版の公開日は
   権利03-13→業法03-23→法令04-19→税06-05 なので、公開日で追うと業法の次が法令になり、
   権利関係（本試験14点）を丸ごと飛ばしていた。カリキュラムは 業法→権利→法令→税。 */
function nextVid(vid){
  var a=vidOrder(),i=-1;
  for(var k=0;k<a.length;k++)if(a[k].vid===vid){i=k;break}
  if(i<0)return null;
  var order=bigsOrdered(),cb=bigOfVid(vid),ci=cb?order.indexOf(cb):-1;
  if(ci>=0){
    for(var bi=ci+1;bi<order.length;bi++){
      var best=null;
      for(var m=0;m<a.length;m++){
        var v=a[m];
        if(v.src!==a[i].src)continue;
        if(bigOfVid(v.vid)!==order[bi])continue;
        if(!videoItems(v.vid).length)continue;
        if(!best||v.up>best.up)best=v;        /* 同じ科目に複数あれば新しい版 */
      }
      if(best)return best;
    }
    return null;
  }
  for(var j=i+1;j<a.length;j++)if(a[j].src===a[i].src&&videoItems(a[j].vid).length)return a[j];
  return null;
}
/* 誤答理由による扱い分け（SPEC §3） */
function applyWhy(id,reason){
  var r=mk(id);
  if(r._why){var i=r.why.lastIndexOf(r._why);if(i>=0)r.why.splice(i,1)}
  r.why.push(reason);r._why=reason;
  /* ケアレスだけは休みを戻さない（連続正解の回数を維持）。他は翌日に戻す。
     「読み違い」も同じ扱い（ひっかけ訓練は 2026-08-14 に廃止したので専用の行き先は無い）。 */
  if(reason==='ケアレス')r.streak=r._preStreak||0;
  else r.streak=0;
  refreshRec(r);saveST();
}

/* ---------- 重症・閉じる ---------- */
/* 重症の基準（2026-08-15 見直し）。直しても消えないのが最大の問題だった。
   ・章の分子が「これまで一度でも誤答した問題」だったが、r.ng は減らないので、
     3回連続で正解しても分子から抜けず、一度重症になった章は永久に重症のままだった
     （批評のモンテカルロ：初回正答率70%で、5問以上ある336章のうち112章が消えない）。
     → 分子を「いま誤答状態の問題」＝誤答があって直近が正解していない数に変える。直せば消える。
   ・問題の側は streak===0 を条件にしていたが、同じ日の間違い直し周回で必ず streak が立つので
     全条件で0件＝機能していなかった。「2回続けて正解するまで重症」＝ streak<2 にする。
   ・問題：誤答3回以上で、連続正解が2回に届いていない（卒業した問題は除く）
   ・章　：5問以上解いたうえで、いま誤答状態の問題が35%以上、または重症の問題が2つ以上 */
function severeItem(id){var r=R(id);return !!r&&(r.ng||0)>=3&&(r.streak||0)<2&&!isGrad(r)}
var SEV_MIN=5,SEV_RATE=0.35,SEV_HARD=2;
function severeTopics(){
  var m={},out=[];
  ITEMS.forEach(function(it){
    var r=R(it.id);if(!r||att(r)===0)return;
    var k=it.cat+'|:|'+(it.topic||'未分類');
    var o=m[k]||(m[k]={att:0,ids:[],ng:0,hard:0});
    o.att++;
    o.ng+=r.ng||0;                                        /* 誤答の延べ回数（表示と並べ替え用） */
    if((r.ng||0)>0&&(r.streak||0)===0)o.ids.push(it.id);  /* いま誤答状態＝直せば分子から抜ける */
    if(severeItem(it.id))o.hard++;
  });
  Object.keys(m).forEach(function(k){
    var o=m[k],rate=o.att?o.ids.length/o.att:0;
    if((o.att>=SEV_MIN&&rate>=SEV_RATE)||o.hard>=SEV_HARD){
      var p=k.split('|:|');
      out.push({cat:p[0],topic:p[1],ids:o.ids,hard:o.hard,ng:o.ng,att:o.att,rate:rate});
    }
  });
  out.sort(function(a,b){return (b.rate-a.rate)||(b.ng-a.ng)});return out;
}
/* 「閉じる」＝未出題ゼロ／全肢が2回目以降の正解（ok>=2）／直近が連続正解（streak>=2） */
function closed(cat){
  var its=itemsOfCat(cat);if(!its.length)return false;
  for(var i=0;i<its.length;i++){
    var r=R(its[i].id);
    if(!r||att(r)===0)return false;
    if(r.state==='卒業')continue;
    if((r.ok||0)<2||(r.streak||0)<2)return false;
  }
  return true;
}
function catStat(cat){
  var its=itemsOfCat(cat),n=its.length,a=0,ok=0,ng=0,grad=0,keep=0,okn=0,ready=0;
  its.forEach(function(it){var r=R(it.id);if(!r)return;
    /* ready＝解いた問題のうち「直近が正解」の数。bigStat() と同じ数え方に揃える
       （得点予測を単元単位に変えたので、大分類と単元で定義が違うと数字が食い違う） */
    if(att(r)>0){a++;if((r.streak||0)>0||r.state==='卒業')ready++}
    ok+=r.ok||0;ng+=r.ng||0;
    if((r.ok||0)>0)okn++;          /* 一度でも正解した問題の数＝達成度の分子 */
    var s=stateOf(it.id);if(s==='卒業')grad++;else if(s==='定着')keep++;});
  var lv=0;
  if(closed(cat))lv=3;else if(a>0&&(grad+keep)>=Math.ceil(n*0.5))lv=2;else if(a>0)lv=1;
  return {n:n,att:a,ok:ok,ng:ng,okn:okn,grad:grad,keep:keep,lv:lv,ready:ready,
          rate:(ok+ng)?ok/(ok+ng):null,
          nowRate:a?ready/a:null,       /* いま出されたら解ける割合＝得点予測に使う */
          prog:n?Math.round(okn/n*100):0};   /* prog＝正解済みの割合＝達成度 */
}
/* ---------- 復習＝抜き打ち中心（2026-08-14 確定の設計） ----------
   ・対象は「学習済みの小分類」だけ（1問以上解いたことがある分類）。未学習の分類からは出さない。
   ・基本は学習済みの各小分類から1問。休み中（連続正解に応じて1/3/7/14日）の問題は出さない。
     その分類の全問が休み中なら、その分類は当日スキップして枠を他へ回す。
   ・選定順＝①まだ正解していない ②過去に間違えた ③難易度が高い ④最後に正解してから日が経っている。
   ・余った枠は「本試験の出題数 × 不正解率」が大きい分野へ上積みする。 */

/* 間違えた問題（期限で追い立てない。件数だけ見せる） */
function wrongPool(){
  return ITEMS.filter(function(it){var r=R(it.id);return !!r&&(r.ng||0)>0&&(r.streak||0)===0});
}
/* その動画／その章の「間違えた問題」（2026-08-18）。数え方はホームと同じ wrongPool。 */
function wrongInVid(vid){
  var w={};wrongPool().forEach(function(it){w[it.id]=1});
  return videoItemsUp(vid).filter(function(it){return w[it.id]});
}
function wrongInChap(vid,sec){
  var w={};wrongPool().forEach(function(it){w[it.id]=1});
  return chapItemsUp(vid,sec).filter(function(it){return w[it.id]});
}
function wrongByBigMap(){
  var m={};BIGS.forEach(function(b){m[b]=0});
  wrongPool().forEach(function(it){m[it.big]=(m[it.big]||0)+1});
  return m;
}
/* 今日間違えた（その場の直し用） */
function wrongToday(){
  var t=today();
  return ITEMS.filter(function(it){
    var r=R(it.id);
    /* lastNg は実時刻なので論理日に直して比べる（未明に間違えた分が「今日」から消えないように） */
    return !!r&&(r.streak||0)===0&&(r.ng||0)>0&&r.lastNg&&dayOfStamp(r.lastNg)===t;
  });
}
/* 学習済みの小分類（1問以上解いた） */
function learnedCats(){
  return CATS.filter(function(c){
    var ids=CINFO[c].ids;
    for(var i=0;i<ids.length;i++)if(att(R(ids[i]))>0)return true;
    return false;
  });
}
/* 抜き打ちの選定順で並べる */
function sneakSort(a,b){
  var ra=R(a.id),rb=R(b.id);
  var na=((ra.ok||0)===0)?0:1,nb=((rb.ok||0)===0)?0:1;          /* ①まだ正解していない */
  if(na!==nb)return na-nb;
  var wa=((ra.ng||0)>0)?0:1,wb=((rb.ng||0)>0)?0:1;              /* ②過去に間違えた */
  if(wa!==wb)return wa-wb;
  var da=d3Hard(a),db=d3Hard(b);                                /* ③難易度が高い（難→普→易・3段階） */
  if(da!==db)return db-da;                                      /* 未評価(-1)は難易度で優先しない＝この段では最後 */
  var la=(ra.lastOk||ra.last||''),lb=(rb.lastOk||rb.last||'');  /* ④最後に正解してから日が経っている */
  return la<lb?-1:la>lb?1:0;
}
function catReady(c){
  return itemsOfCat(c).filter(function(it){return restReady(it.id)}).sort(sneakSort);
}
/* 基本＝学習済みの各小分類から1問（全問が休み中の分類は飛ばす） */
function sneakBase(){
  var out=[];
  learnedCats().forEach(function(c){
    var a=catReady(c);
    if(a.length)out.push(a[0]);
  });
  return out;
}
/* 分野の価値＝本試験の出題数 × 不正解率（上積みの優先度・枠を切るときの優先度） */
function bigValue(big){
  var ok=0,ng=0;
  ITEMS.forEach(function(it){if(it.big!==big)return;var r=R(it.id);if(r){ok+=r.ok||0;ng+=r.ng||0}});
  var a=ok+ng,wr=a?ng/a:0.5;                          /* 解いていない分野は0.5とみなす */
  return (BIGQ[big]||1)*wr;
}
/* 上積み＝「本試験の出題数 × 不正解率」が大きい分野へ寄せて足す（同じ分野の中は選定順） */
function sneakExtra(base,n){
  if(n<=0)return [];
  var used={};base.forEach(function(it){used[it.id]=1});
  var lc={};learnedCats().forEach(function(c){lc[c]=1});
  var val={};BIGS.forEach(function(b){val[b]=bigValue(b)});
  var cand=ITEMS.filter(function(it){return lc[it.cat]&&!used[it.id]&&restReady(it.id)});
  cand.sort(function(x,y){
    var d=val[y.big]-val[x.big];
    return d||sneakSort(x,y);
  });
  return cand.slice(0,n);
}
/* 未着手（＝1周の残り）。all=true で全件、既定は「既習範囲の未着手」だけを返す。
   既習範囲＝need_seq が「見た動画の最大の通し番号」以下（2026-08-14 本人指摘
   「まだ動画も見てないのに新規とか関係なくない？」への対応）。
   need_seq が無い古いデータ・設定「未習の範囲も出す」では全件（＝従来の挙動）。 */
/* 見た動画から解禁された大分類の集合。こざりえは1本＝1科目なので、
   その科目の動画を見たら、その科目は全部出せる（章ごとに解くのは一覧から選ぶ）。
   あこ課長を見た場合も、その動画が属する大分類を解禁する。 */
function openBigs(){
  var out={};
  Object.keys(ST.watched||{}).forEach(function(k){
    var vid=String(k).split('#')[0],b=bigOfVid(vid);
    if(b)out[b]=1;
  });
  return out;
}
/* 動画→大分類。BIGVIDS を総当たりすると1回で全168本の線形走査になるので、
   同じ表から作ってある逆引き VBIG を使う（2026-08-15 批評：解禁判定が重い件） */
function bigOfVid(vid){return VBIG[vid]||null}
function unseenItems(all){
  var lim=NEEDOK&&!all&&!(ST.settings&&ST.settings.ahead);
  var ob=lim?openBigs():null;
  var a=ITEMS.filter(function(it){
    if(att(R(it.id))!==0)return false;
    if(!lim)return true;
    if(!ob[it.big])return false;      /* その科目の動画をまだ見ていない */
    return true;
  });
  /* 経緯：以前はここで通し番号（need_seq＝あこ課長の再生リスト順）でも絞っていた。
     主教材がこざりえになった今それを使うとほぼ全部が落ちる（2026-08-14 実測：162問→1問）ので、
     解禁の判定は上の inRange と同じ「大分類（科目）を見たか」に一本化した。
     通し番号は出題順（nsRank）にだけ使う＝順番の指標であって、出す出さないの条件ではない。 */
  if(ST.settings.later){                              /* 「難」を後回しにする（本人が選んだときだけ・3段階） */
    a.sort(function(x,y){
      var lx=(d3(x)==='難')?1:0,ly=(d3(y)==='難')?1:0;
      return lx-ly;
    });
  }
  return a;
}
/* 新規の数字を出していいか＝既習範囲があるか（1本も見ていないときは数字を出さない） */
function newAvail(){
  if(ST.settings&&ST.settings.ahead)return true;
  return Object.keys(openBigs()).length>0;
}
/* 1日の枠＝（学習時間−動画時間）÷30秒。抜き打ちは学習済み分類の数で自然に決まり、
   残りすべてを新規に配る。新規が余ったぶんは抜き打ちの上積みへ回す。 */
/* 今日はじめて解いた問題の数（＝新規をどれだけ消化したか）。復習は含めない。 */
function newToday(){return (ST.days[today()]||{}).newq||0}
/* 今日の抜き打ちを済ませたか（1日1回） */
function sneakDone(){return !!((ST.days[today()]||{}).sneak)}
function plan(){
  var dl=daysLeft();
  var all=unseenItems(true);                  /* 全体の残り＝1周の進みと必要ペースはこちらで見る */
  var unseen=unseenItems();                   /* 今日出せる新規＝既習範囲の未着手だけ */
  var needNew=dl?Math.ceil(all.length/dl):all.length;
  /* 枠は「（1日の時間−動画の実測）÷30秒」だが、主教材が1本60〜127分になったので
     動画を見た日は枠が尽きて新規が1問になっていた（2026-08-14 実測）。
     1周を終わらせるための必要ペースを下限にする。 */
  var cap=Math.max(dayCap(),needNew);
  /* ①新規の枠を先に確保する（1周を終わらせることが最優先） */
  var newRes=Math.min(unseen.length,needNew,cap);
  /* ②残りを抜き打ちへ。入り切らない分は配点の大きい分野を残して切る（件数は画面に出す） */
  var base=sneakBase().sort(function(x,y){
    var d=bigValue(y.big)-bigValue(x.big);return d||sneakSort(x,y);
  });
  var room1=Math.max(0,cap-newRes);
  var sneak=base.slice(0,room1),sneakCut=base.length-sneak.length;
  /* ③それでも余ったら新規を増やし（1周を早める）、新規が尽きていれば抜き打ちを上積みする。
     ただし新規は「その日に必要な数」needNew を超えない。超えていたせいで、ホームに
     「◯/83問」と「新規162問」の2つの目標が並び、どちらを終えれば今日の分か分からなかった
     （2026-08-15 批評）。83問を終えた後も、章・動画・小分類から続けて解く道は残してある。 */
  var newN=Math.min(unseen.length,needNew,newRes+Math.max(0,cap-newRes-sneak.length));
  var extra=sneakExtra(sneak,Math.max(0,cap-newN-sneak.length));
  sneak=sneak.concat(extra);
  var doneToday=(ST.days[today()]||{}).n||0;
  if(sneakDone()){sneak=[];sneakCut=0;extra=[]}     /* 抜き打ちは1日1回（2026-08-15 本人指定） */
  /* 通し番号が無い未着手＝新規には入れないぶん（黙って消さないので件数を画面に出す） */
  var noseq=NEEDOK?ITEMS.filter(function(it){
    return att(R(it.id))===0&&needSeq(it)===null;
  }).length:0;
  return {cap:cap,daysLeft:dl,unseen:all.length,avail:unseen.length,needNew:needNew,noseq:noseq,
          newOk:newAvail(),                   /* false＝まだ1本も見ていない（新規の数字を出さない） */
          newN:newN,newItems:unseen.slice(0,newN),
          sneak:sneak,base:Math.min(base.length,room1),extra:extra.length,sneakCut:sneakCut,
          learned:learnedCats().length,wrong:wrongPool().length,
          minutes:Math.round((newN+sneak.length)*SEC_PER_Q/60)+vminUsed(),
          over:needNew>cap,doneToday:doneToday};
}
/* 新規＝動画の番号順を崩さない（あこ課長の公開順→その動画の章の秒数順）。
   未習の範囲（need_seq が見た動画の最大の通し番号を超えるもの）は入れない。 */
function newQueue(n){
  /* 選ぶ順＝並べる順（sortQ）と同じにする。
     以前は「動画ごとに拾ってから並べ替え」だったため、先頭60問が
     いきなり「重要事項説明書 82:24」から始まっていた（2026-08-15 実測）。
     いまは 大分類 → 主教材の動画 → 章の秒数 の順に並べてから先頭を取る。 */
  var a=sortQ(unseenItems());
  if(ST.settings.later){                      /* 「難」は後回し（本人が選んだときだけ） */
    var easy=[],hard=[];
    a.forEach(function(it){(d3(it)==='難'?hard:easy).push(it)});
    a=easy.concat(hard);
  }
  return a.slice(0,n);
}
/* 未実装の4機能（ひっかけワード訓練／同一章の連射／問題への自分メモ／週次講評）は
   2026-08-14 本人の指示で廃止した。trapPool と「ひっかけ」の入口はここで削除している。 */

/* ---------- 絞り込み ---------- */
var F={wrong:false,ngMin:0,recent:0,star:false,unseen:false,rateMax:null,difs:[],cats:[],topics:[]};
function matchF(it){
  var r=R(it.id),a=att(r);
  if(F.cats.length&&F.cats.indexOf(it.cat)<0)return false;
  if(F.topics.length&&F.topics.indexOf(it.cat+'|:|'+(it.topic||'未分類'))<0)return false;
  if(F.difs.length&&F.difs.indexOf(d3(it))<0)return false;   /* 難易度の絞り込みは3段階（未評価は該当しない） */
  if(F.star&&!(r&&r.star))return false;
  if(F.unseen&&a>0)return false;
  if(F.wrong&&!(r&&r.ng>0))return false;
  if(F.ngMin&&!(r&&(r.ng||0)>=F.ngMin))return false;
  if(F.recent){if(!(r&&r.lastNg))return false;if(dgap(dayOfStamp(r.lastNg),today())>F.recent-1)return false}
  if(F.rateMax!==null){var rt=rateOf(r);if(rt===null||rt*100>F.rateMax)return false}
  return true;
}
function filtered(){return ITEMS.filter(matchF)}
function fActive(){
  return !!(F.wrong||F.ngMin||F.recent||F.star||F.unseen||F.rateMax!==null||F.difs.length||F.cats.length||F.topics.length);
}

/* ---------- 出題順 ---------- */
var SORTS=[['std','デフォルト'],['timeline','章のタイムライン順'],['dif','難易度優先'],
           ['rand','ランダム'],['year','年度順'],['weak','苦手優先']];
function unseenRank(it){return att(R(it.id))===0?0:1}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function sortQ(arr){
  var a=arr.slice();
  if(S.sort==='rand')return shuffle(a);
  a.sort(function(x,y){
    /* 章のタイムライン順＝動画の章の秒数だけで純粋に並べる。同じ章の中は出典年の古い順。
       章が分からない肢（topic未設定・章データなし）は secOf が 99999 を返すので末尾に来る。 */
    if(S.sort==='timeline'){
      var tx=secOf(x),ty=secOf(y),ax2=x.src||{},ay2=y.src||{};
      return tx-ty||(ax2.year||0)-(ay2.year||0)||(ax2.month||0)-(ay2.month||0)||(ax2.q||0)-(ay2.q||0)||cmpId(x,y);
    }
    /* 難易度優先＝3段階（易→普→難）で並べ、未評価（diff_ai が null）は末尾に置く */
    if(S.sort==='dif'){return d3Rank(x)-d3Rank(y)||secOf(x)-secOf(y)||unseenRank(x)-unseenRank(y)||cmpId(x,y)}
    if(S.sort==='year'){var sx=x.src||{},sy=y.src||{};
      return (sx.year||0)-(sy.year||0)||(sx.month||0)-(sy.month||0)||(sx.q||0)-(sy.q||0)||cmpId(x,y)}
    if(S.sort==='weak'){
      var rx=rateOf(R(x.id)),ry=rateOf(R(y.id));
      var vx=rx===null?1.1:rx,vy=ry===null?1.1:ry;
      return vx-vy||(R(y.id)?R(y.id).ng||0:0)-(R(x.id)?R(x.id).ng||0:0)||secOf(x)-secOf(y)||cmpId(x,y)}
    /* デフォルト＝主教材（こざりえ）の動画を、章のタイムスタンプ順に進む。
       ①大分類の学習順（宅建業法→権利関係→法令→税・その他）
       ②その科目の主教材の動画の順（2026年版が先）
       ③その動画の中は章の秒数順（＝動画を見た順に問題が出る）
       ④同じ章の中は あこ課長の通し番号 → 難易度 → 未出題を優先
       2026-08-15 本人指摘：①②③が無いと「宅地、建物の定義」の次に「重説」が来て飛ぶ。 */
    /* 2026-08-17：基準の動画が無いとき（単元から／全問から／絞り込みから）は
       **あこ課長の習う順**で並べる。本人「大体順番に出てくればいい」「免許の基本 →
       免許換え → 免許の取消し、という順番があるはずでしょ。その順で埋めていきたい」。
       動画学習をあこ課長だけにした（6322d804）ので、学ぶ順＝あこの再生リスト順に一本化する。
       いままでは主教材＝こざりえの1本（＝科目まるごと）の秒で並べていたため、
       あこで習う順とは一致していなかった。
       章・動画から入ったとき（S.baseVid あり）は、その動画の中の秒で並べる＝今までどおり。 */
    if(!S.baseVid){
      return bigRank(x)-bigRank(y)||akoSeq(x)-akoSeq(y)||akoSec(x)-akoSec(y)
        ||d3Rank(x)-d3Rank(y)||unseenRank(x)-unseenRank(y)||cmpId(x,y);
    }
    return bigRank(x)-bigRank(y)||kvRank(x)-kvRank(y)||secOf(x)-secOf(y)
      ||nsRank(x)-nsRank(y)||d3Rank(x)-d3Rank(y)||unseenRank(x)-unseenRank(y)||cmpId(x,y);
  });
  return a;
}
/* 「残り」と「全部」を両方出す（2026-08-15 本人指摘）。
   未着手だけを強制すると、37/54 の章で解いた37問を復習したいときに手が無くなる。
   残りが0（全部やった）／残りが全部（未着手）のときは1つでよい。 */
function twoBtns(act,attrs,rest,tot,cls,st){
  var c='btn'+(cls?' '+cls:''),y=st?' style="'+st+'"':'';
  if(rest>0&&rest<tot)
    return '<button class="'+c+'"'+y+' data-act="'+act+'"'+attrs+'>残り '+n3(rest)+'問</button>'
          +'<button class="'+c+'"'+y+' data-act="'+act+'" data-all="1"'+attrs+'>全 '+n3(tot)+'問</button>';
  return '<button class="'+c+'"'+y+' data-act="'+act+'" data-all="1"'+attrs+'>'
        +(rest===0?'もう一度解く（'+n3(tot)+'問）':'解く（'+n3(tot)+'問）')+'</button>';
}
/* data-all があれば全部、無ければ未着手だけ */
function pickRest(list,t){return t.getAttribute('data-all')?list:restOnly(list)}
function restCount(list){return list.filter(function(it){return att(R(it.id))===0}).length}
/* いま解き終えた章の「次の章」＝同じ動画で、秒数が後ろにあり、まだ未着手が残っている章。
   こざりえは1本＝1科目（最大1,524問）なので、動画を全問正解しないと次へ進めない作りでは
   「動画→問題→間違い直し→次」の流れが成立しない（2026-08-15 批評で判明）。章単位で進める。 */
function nextChap(vid,sec){
  if(!vid||sec===null||sec===undefined)return null;
  var list=null;
  Object.keys(CHAP).forEach(function(c){(CHAP[c]||[]).forEach(function(v){
    if(v.vid===vid&&!list)list=(v.chapters||[]).filter(function(x){return !x.skip});
  })});
  if(!list)return null;
  /* その動画で**まだ解いていない問題が残っている、いちばん前の章**を返す。
     以前は「いま解いた章より後ろ」だけを見ていたので、後ろの章から先に解くと
     前の章に穴が残ったまま次の動画へ進んでしまった（2026-08-15 本人指摘
     「タイムスタンプごとに 動画を見る→問題を解く→次のタイムスタンプ、じゃダメなの？」）。
     いちばん前から拾えば、順番どおりに進み、飛ばした章も自然に埋まる。
     sec は「いま解き終えた章」で、そこが残っていれば同じ章を出さないよう除く。 */
  var a=list.slice().sort(function(x,y){return x.sec-y.sec}),out=null;
  a.forEach(function(ch){
    if(out||ch.sec===sec)return;
    if(restCount(chapItemsUp(vid,ch.sec))>0)out=ch;
  });
  return out;
}
/* まだ解いていない問題だけに絞る。1問も残っていなければ全部返す（＝復習として解き直せる）。 */
function restOnly(list){
  var rest=list.filter(function(it){return att(R(it.id))===0});
  return rest.length?rest:list;
}
/* 通し番号（並べ替え用）。番号が無い問題は末尾へ */
function nsRank(it){var n=needSeq(it);return n===null?99999:n}
/* あこ課長の習う順（2026-08-17）。その肢が紐づく「あこ課長の動画」のうち、
   再生リストの通し番号がいちばん小さいものを代表にして、[通し番号, その動画の中の秒] を返す。
   通し番号は data/curriculum.json の seq_of_vid（vno がその値を返す）。
   あこ課長の動画に1本も紐づかない肢（実測147件・2.8%）は、その大分類の最後に回す。
   1肢につき毎回探すと遅いので、1回引いたら覚えておく。 */
var AKOK={};
function akoKey(it){
  var k=AKOK[it.id];
  if(k)return k;
  var vs=vidsOf(it),bq=99999,bs=99999,i,no,sc;
  /* ①まず「判定が論点に対応すると決めた1本」（jtopic を持つリンク）を使う。
     これを使わず通し番号が最小のリンクで並べていたため、**本来より前に置かれる肢**が
     1,061件（判定の1本があこである2,767肢の38%・10本以上ずれが85件・最大52本）あった。
     ずれる向きが悪く、まだ習っていない位置に問題が出る＝
     本人指摘「動画を見たのにわからない問題が配置されている」（2026-08-17 実測）。 */
  for(i=0;i<vs.length;i++){
    if(!vs[i].jtopic||VSRC[vs[i].vid]!==VIDSRC)continue;
    no=vno(vs[i].vid);
    if(no===null)continue;
    bq=no;bs=(typeof vs[i].sec==='number')?vs[i].sec:99999;
    break;
  }
  /* ②判定の1本があこでない（こざりえ・こうのすけで判定した）ときだけ、
     あこのリンクのうち通し番号が最小のものに落とす。 */
  if(bq===99999)for(i=0;i<vs.length;i++){
    if(VSRC[vs[i].vid]!==VIDSRC)continue;
    no=vno(vs[i].vid);
    if(no===null)continue;
    sc=(typeof vs[i].sec==='number')?vs[i].sec:99999;
    if(no<bq||(no===bq&&sc<bs)){bq=no;bs=sc}
  }
  k=AKOK[it.id]=[bq,bs];
  return k;
}
function akoSeq(it){return akoKey(it)[0]}
function akoSec(it){return akoKey(it)[1]}
/* 大分類の学習順（宅建業法→権利関係→…）。表に無いものは末尾 */
var BIGRANK=null;
function bigRank(it){
  if(!BIGRANK){BIGRANK={};bigsOrdered().forEach(function(b,i){BIGRANK[b]=i})}
  var r=BIGRANK[it.big];return (r===undefined)?99:r;
}
/* その肢が属する主教材の動画の順番。同じ科目に複数あるので、公開が新しい順に0,1,2…。
   主教材の動画に紐づいていない肢（あこ課長だけの17%）は、その科目の最後に回す。 */
var KVRANK=null;
function kvRankTable(){
  if(KVRANK)return KVRANK;
  KVRANK={};
  Object.keys(BIGVIDS).forEach(function(b){
    (BIGVIDS[b]||[]).filter(function(v){return VSRC[v]===DEFSRC})
      .sort(function(x,y){return (VUP[y]||'').localeCompare(VUP[x]||'')})
      .forEach(function(v,i){if(KVRANK[v]===undefined)KVRANK[v]=i});
  });
  return KVRANK;
}
function kvRank(it){
  var t=kvRankTable(),vs=vidsOf(it),best=99;
  for(var i=0;i<vs.length;i++){
    var r=t[vs[i].vid];
    if(r!==undefined&&r<best)best=r;
  }
  return best;
}
function cmpId(x,y){return x.id<y.id?-1:(x.id>y.id?1:0)}

/* ---------- 画面状態 ---------- */
/* baseVid＝出題順「章のタイムライン順」の基準にする動画（動画学習から入ったときに入る）
   baseSrc＝基準のチャンネル（既定＝あこ課長）／openChap＝動画学習で開いている章 */
/* baseVid＝出題順「章のタイムライン順」の基準にする動画（動画学習から入ったときに入る）
   baseSrc＝基準のチャンネル（既定＝あこ課長）／openChap＝動画学習で開いている章
   wrongs＝このセッションで間違えた問題（完走後に周回する）／round＝周回の回数 */
/* lockedOut＝未習で出さなかった件数／sT,sR,sStreak,sBest＝この1回（周回なら「その周」）の成績 */
var S={view:'home',cat:null,sort:'std',srcF:null,queue:[],qi:0,phase:'q',res:null,label:'',sneak:{},
        urest:false,ucat:false,fieldsY:0,openZero:{},
        openBig:{},openCat:{},openOther:{},openDone:{},openFilter:false,anim:null,baseVid:null,baseSrc:DEFSRC,openChap:{},
        /* いま解いている「単位」の印。roundVid/roundSec＝動画・章から入ったとき、
           roundCat/roundSub＝単元・小見出しから入ったとき。完走画面の「次へ」の行き先を決める。
           全部 startQueue の冒頭で落とす（周回だけは持ち越す）。 */
        wrongs:[],round:0,roundVid:null,roundSec:null,roundCat:null,roundSub:null,
        srcOpen:false,lockedOut:0,kind:'new',studyVid:null,
        pickExplicit:false,   /* 本人が範囲を選んだ入口＝未習フィルタを通さない印（startQueue で降りる） */
        pendBig:null,         /* 次の1回だけ効く科目基準（startQueue の冒頭で baseBig に移す） */
        /* 学習タブの入口（video＝動画で進む／cat＝単元で進む）。記録から復元する。
           既定は単元側（2026-08-15 本人指示「単元学習をメインにしたい」＝loadST の正規化で決まる） */
        fmode:((ST.settings&&ST.settings.fmode==='video')?'video':'cat'),
        ubOpen:null,          /* 単元一覧で開いている大分類（ubOpenMap() が作る／記録にも残す） */
        sT:0,sR:0,sStreak:0,sBest:0,spent:0,
        enter:true,dir:null,tier:null,ev:null,broke:false};

function startQueue(list,label,withSneak,baseVid,keepGrad,keepRound){
  /* 周回（間違い直し）以外は、ここで必ず周回数を0に戻す。入口ごとに S.round=0 と書いていたため
     6か所（startFilter/startSel/startAll/startCat/startTopic/startChap）で書き漏れていて、
     前のセッションの間違いリストと基準の動画がそのまま持ち越されていた（2026-08-15 批評）。
     周回を続けたい呼び出しだけが keepRound=true を渡す。
     2026-08-15 批評：**roundSec だけがどこでも落ちていなかった**。設定するのは startChap と
     nextchap、null に戻すのは startVid だけだったので、動画の章を1本解いた（roundSec=794）あと
     単元タブで「宅地建物取引士」を解くと、完走画面が nextChap(こざりえ業法, 794) を返して
     **宅建士と無関係の「次の章へ」**が点灯していた。ここで「いま解いている単位」の印を
     まとめて落とす（roundCat/roundSub＝単元・小見出しから入った印も同じ扱い）。 */
  if(!keepRound){S.round=0;S.roundSec=null;S.roundCat=null;S.roundSub=null}
  S.baseVid=baseVid||null;                 /* 基準の動画（指定が無ければ既定のチャンネル基準） */
  /* 科目基準（解禁の保険）は「次の1回だけ効く」受け渡しにする。
     2026-08-15 検証：startCat が S.baseBig を入れてから startQueue を呼んでいたのに、
     ここにあった `if(baseVid)S.baseBig=null` が毎回それを消していた。
     基準の動画が別の科目のものだと（税の小分類に「税・価格」の動画が付く等）
     解禁の集合に科目が入らず、ラベルは「解く（54問）」なのに押すと0問になっていた。
     S.pendBig 経由なら baseVid の有無に関係なく渡り、次のセッションにも漏れない。 */
  S.baseBig=S.pendBig||null;S.pendBig=null;
  /* 本人が範囲を選んだ入口（絞り込み・選択範囲・全範囲・小分類の章）は未習でも出す。
     1回使ったら降ろす＝次のセッションに漏らさない。 */
  var explicit=!!S.pickExplicit;S.pickExplicit=false;
  /* 卒業した問題は通常出題から外す。ただし抜き打ち（keepGrad）と周回は別 */
  var arr=list.filter(function(it){return !isGrad(R(it.id))||S.round>0||keepGrad});
  /* 未習の範囲を出さない（既定）。need_seq が「見た動画の最大の通し番号」を超える問題は、
     まだ習っていない知識が必要なので出さない。設定「未習の範囲も出す」でこの制限を外せる。
     一度でも解いた問題は対象にしない（間違い直し・抜き打ちが消えてしまうため）。
     周回（間違い直し）も対象にしない。除外した件数は出題画面に小さく出す（黙って消さない）。 */
  /* 未習の範囲を出さない判定は inRange（大分類ベース）に一本化した。
     ここで通し番号（あこ課長の再生リスト順）を使うと、主教材がこざりえになった今は
     ほぼ全部が落ちる（2026-08-14 実測：162問→1問）。 */
  /* 本人が明示的に選んだ範囲（explicit）は落とさない。落としていたせいで、絞り込みで
     権利関係を選ぶと1,541問→0問になっていた（2026-08-15 実測）。自分で選んだのだから出す。 */
  S.lockedOut=0;
  if(!S.round&&!explicit&&!(ST.settings&&ST.settings.ahead)){
    var before=arr.length;
    var ob=openBigsNow();      /* 解禁の集合は1回だけ作って全問で使い回す（1件ごとに作ると重い） */
    arr=arr.filter(function(it){return att(R(it.id))>0||inRange(it,ob)});
    S.lockedOut=before-arr.length;
  }
  arr=S.keepOrder?arr:sortQ(arr);
  S.keepOrder=false;              /* 1回使ったら降ろす＝次のセッションに漏らさない */
  S.sneak={};
  /* 抜き打ちは「復習」として独立した枠で出す（新規の順序を乱さない）ので、
     通常のセッションに混ぜ込むことはしない。 */
  if(!S.round){S.wrongs=[];S.roundVid=baseVid||null}  /* 周回でないセッションの開始で溜め直す */
  S.queue=arr.map(function(it){return it.id});
  S.qi=0;S.phase='q';S.res=null;S.label=label||'';
  S.ansLog={};                 /* 前のセッションの控えを持ち越さない */
  /* この1回ぶんの成績（周回のときは「その周」の成績）。通算＝ST.session とは混ぜない。 */
  S.sT=0;S.sR=0;S.sStreak=0;S.sBest=0;S.spent=0;
  saveRun(true);      /* fresh=true ＝ run.spent を0に戻す（周回ごとに時間を測り直す） */
  /* 完走リザルト用に開始時点を控える（かかった時間・卒業の増分・達成度の増分） */
  S.t0=Date.now();S.doneShown=false;S.closedCat=null;
  var cs0=CINFO[S.label]?catStat(S.label):null;
  S.gradBefore=cs0?cs0.grad:0;
  S.catFrom=cs0?cs0.prog:0;   /* 達成度＝正解済みの割合（卒業＋定着では1周目に0%のままになる） */
  S.anim='card';
  go('quiz');
  /* 開始の区切り。M1のFLIP（章の行→出題）が主役のときは重ねない */
  if(!M1BUSY)M5.playStart(S.label||'出題',S.queue.length);
}
/* ---------- 出題セッションの保存・再開・破棄 ---------- */
function saveRun(fresh){
  if(!S.queue.length){ST.run=null;saveST();return}
  var now=nowStamp();
  /* かかった時間は「実際に解いていた時間の積み上げ」で持つ。
     メモリ上の開始時刻（S.t0）だけだと再読み込みや「途中から再開」で消えて0秒になるため。
     1問あたり180秒で打ち切るので、放置した時間は入らない。 */
  var prev=(!fresh&&ST.run)?ST.run:null;
  var spent=prev?(prev.spent||0):0, tick=Date.now();
  if(prev&&prev.tick){
    var d=Math.min(180000,Math.max(0,tick-prev.tick));
    spent+=d;
    /* 実測の学習時間を積む。動画が基準のセッションは、その基準の動画1本だけに積む
       （問題は複数の動画に紐づくので、全部に積むと二重計上になる） */
    addStudyMs(prev.kind||S.kind||'new',prev.baseVid||null,d);
  }
  ST.run={queue:S.queue.slice(),qi:S.qi,label:S.label,sort:S.sort,kind:S.kind||'new',
          sT:S.sT||0,sR:S.sR||0,sBest:S.sBest||0,
          /* 間違えた問題・周回数・基準の動画も保存する。ここが抜けていたため、
             途中でアプリが再起動されると完走時に「間違えた N問を解く」が出なかった
             （2026-08-14 本人報告のバグ。iPhoneのホーム画面アプリは他アプリに切り替えると
             再起動されやすいので、長いセッションではほぼ必ず踏む）。 */
          wrongs:(S.wrongs||[]).slice(),round:S.round||0,roundVid:S.roundVid||null,
          /* 単元・小見出しから入った印も残す（再開したときに「次の単元へ」が消えないように） */
          roundCat:S.roundCat||null,
          roundSub:(typeof S.roundSub==='number'?S.roundSub:null),
          baseVid:S.baseVid||null,baseSrc:S.baseSrc||DEFSRC,
          filter:JSON.parse(JSON.stringify(F)),
          startedAt:(fresh||!prev||!prev.startedAt)?now:prev.startedAt,lastAt:now,
          spent:fresh?0:spent, tick:tick};
  saveST();
}
/* 完走・中断でセッションの時計を締める。最後の1問ぶんの経過を spent と実測（tlog／quizMs）へ
   積んでから ST.run を捨てる（捨ててから読むと「かかった時間 0:00」になる）。 */
function closeRunClock(){
  var r=ST.run;
  if(!r){S.spent=S.spent||0;return S.spent}
  var d=r.tick?Math.min(180000,Math.max(0,Date.now()-r.tick)):0;
  if(d>0)addStudyMs(r.kind||S.kind||'new',r.baseVid||null,d);
  r.spent=(r.spent||0)+d;r.tick=null;
  S.spent=r.spent;
  saveST();
  return S.spent;
}
function dropRun(){ST.run=null;saveST()}
function hasRun(){
  var r=ST.run;
  return !!(r&&r.queue&&r.queue.length&&r.qi<r.queue.length);
}
function resumeRun(fromStart){
  var r=ST.run;if(!r)return;
  S.queue=r.queue.filter(function(id){return !!BY[id]});   /* データ差し替えで消えたidは落とす */
  S.qi=fromStart?0:Math.min(r.qi||0,Math.max(0,S.queue.length-1));
  S.label=r.label||'';S.sort=r.sort||S.sort;S.phase='q';S.res=null;S.broke=false;S.sneak={};
  S.ansLog={};                 /* 再開でも控えは持ち越さない */
  S.baseVid=r.baseVid||null;S.baseSrc=r.baseSrc||DEFSRC;   /* 基準の動画も一緒に戻す */
  S.kind=r.kind||'new';                                    /* 学習時間の内訳の行き先も戻す */
  S.spent=0;                                               /* 時間は run.spent 側を正とする */
  /* ヘッダーに出す「このセッションの成績」も復元する（最初からやり直すときは0に戻す） */
  S.sT=fromStart?0:(r.sT||0);S.sR=fromStart?0:(r.sR||0);
  S.sStreak=0;S.sBest=fromStart?0:(r.sBest||0);
  /* 間違えた問題・周回数・基準の動画を戻す（最初からやり直すときは捨てる） */
  S.wrongs=fromStart?[]:(Array.isArray(r.wrongs)?r.wrongs.filter(function(id){return !!BY[id]}):[]);
  S.round=fromStart?0:(r.round||0);
  S.roundVid=(r.roundVid&&VTIT[r.roundVid])?r.roundVid:(r.baseVid||null);
  /* 単元・小見出しから入った印（データが差し替わって単元が消えていたら捨てる） */
  S.roundCat=(r.roundCat&&CINFO[r.roundCat])?r.roundCat:null;
  S.roundSub=(S.roundCat&&typeof r.roundSub==='number')?r.roundSub:null;
  if(r.filter){for(var k in F){if(r.filter[k]!==undefined)F[k]=r.filter[k]}}
  /* 難易度の絞り込みは5段階（A〜E）から3段階（易・普・難）へ変わったので、古い値は落とす
     （残すと「どのチップも選ばれていないのに該当0問」になる） */
  if(F.difs&&F.difs.length)F.difs=F.difs.filter(function(d){return D3.indexOf(d)>=0});
  saveRun(fromStart);
  S.anim='card';
  go('quiz');
}
function go(v){
  S.view=v;S.enter=true;
  /* 一覧へ戻るときだけ、出るときの位置に戻す（それ以外は今までどおり先頭）。
     拾う作業は「一覧を下まで見る→単元に入る→戻る→次」の繰り返しなので、
     毎回先頭に跳ぶと下の単元に指が届かない（2026-08-17）。 */
  var y=(v==='fields'&&S.fieldsY)?S.fieldsY:0;
  window.scrollTo(0,0);render();
  if(y)requestAnimationFrame(function(){window.scrollTo(0,y)});
}

/* ---------- 汎用 ---------- */
/* 属性セレクタに入れる文字のエスケープ（小分類名に " や \ が来ても壊れないように） */
function cssEsc(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function pct(x,d){return x===null||x===undefined?'—':(x*100).toFixed(d===undefined?1:d)+'%'}
/* 3桁区切り（件数・問題数は必ずこれを通す） */
function n3(n){return String(n==null?0:n).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
function srcLabel(it){
  var s=it.src||{},raw=s.raw||((s.era||'')+(s.month?s.month+'月':'')+' 問'+(s.q||''));
  var leg=String(it.id).split('-'),no=leg[leg.length-1];
  /* 「問8 問題3」では読めないので、枝番は丸括弧で出す（画面に「肢」を出さない）。
     出典の文字列にすでに「改」が入っている場合は二重に付けない。 */
  var kai=((it.flags||[]).indexOf('改')>=0&&raw.indexOf('改')<0)?'（改）':'';
  return raw.replace(/\s+/g,' ')+(no?'（'+no+'）':'')+kai;
}

/* =========================================================
   画面
   ========================================================= */
function render(){
  var v=document.getElementById('view'),h='';
  /* この描画で「入場アニメーション（画面遷移＋段差）」を付けるか。
     ビューを開いたとき（go）と出題が次に進んだときだけ true。
     同じ画面内の更新（絞り込みのタップ・回答など）では動かさない
     ＝問題文の座標を1pxも変えないため。 */
  /* M1のFLIP遷移中は、既存の入場（viewIn/段差）を止めてM1に主役を任せる
     （同じ要素に2つの入場アニメーションを重ねない＝M3_depth.md §6-5） */
  ANIMON=!!S.enter&&!M1BUSY;
  if(!ITEMS.length){
    h='<div class="pad"><div class="warn">'+IC.warn+' 問題データが読み込めていません。data/items.js（または data/items_dummy.js）を確認してください。</div></div>';
    v.innerHTML=h;renderTabs();return;
  }
  if(S.view==='home')h=vHome();
  else if(S.view==='fields')h=vFields();
  else if(S.view==='study')h=vStudy();
  else if(S.view==='quiz')h=vQuiz();
  else if(S.view==='mock')h=vMock();
  else if(S.view==='review')h=vReview();
  else if(S.view==='analysis')h=vAnalysis();
  v.innerHTML=h;renderTabs();
  /* クラスを外す→強制リフロー→付け直す。これをしないと innerHTML の作り直しでも
     クラスが付いたままになり、アニメーションが再生されない（今回の指摘6の原因）。 */
  if(ANIMON){
    v.classList.remove('viewin','fwd','bwd');
    void v.offsetWidth;
    v.classList.add('viewin');
    if(S.dir)v.classList.add(S.dir);
  }else{
    /* 入場させない描画では残しておかない（#view の transform を2か所から触らない） */
    v.classList.remove('viewin','fwd','bwd');
  }
  /* ---- M3/M4 の後処理（DOMを作り直した直後に一度だけ） ---- */
  var ht=v.querySelector('.m3-heat');
  if(ht&&ANIMON)m3Heat(ht);
  m3hero=v.querySelector('.m3-hero');
  if(m3hero){m3T={dx:0,rx:0,ry:0,sc:1};m3Set()}
  m3Focus(S.view==='quiz');            /* 出題画面だけ主役を前に出す */
  m3Apply();
  m4Progress();                        /* 進捗バーを前回値から伸ばす */
  if(S.view==='home'&&M4HOMENEW){m4UpdateHome(M4HOMENEW);M4HOMENEW=null}
  if(S.view==='analysis'&&M4ANA){
    var an=M4ANA;M4ANA=null;
    m4CountUp(document.getElementById('aGrad'),0,an.grad,450,{big:8,tile:document.getElementById('aGradT')});
    m4CountUp(document.getElementById('aKeep'),0,an.keep,450,{big:8,tile:document.getElementById('aKeepT')});
    m4CountUp(document.getElementById('aLearn'),0,an.learn,450,{big:8,tile:document.getElementById('aLearnT')});
    m4CountUp(document.getElementById('aSev'),0,an.sev,450,{big:5,tile:document.getElementById('aSevT')});
  }
  if(S.bump){                          /* 直前に解いた小分類のマスを1回だけ膨らませる */
    var bc=v.querySelector('[data-cat="'+cssEsc(S.bump.cat)+'"]');
    if(bc){m4BumpCell(bc,S.bump.stage,S.bump.grad);S.bump=null}
  }
  /* ---- M6 の後処理（DOMを作り直した直後に一度だけ） ---- */
  m6Fills(v);                          /* 進捗の塗り（scaleX）を前回値から伸ばす */
  m6Rolls(v);                          /* 桁ロールを前回値から回す */
  m6PopHide();                         /* 長押しのプレビューは描画のたびに畳む */
  m6BootSwap();
  bootFx();                 /* 起動の演出＝1回だけ（BOOTFXDONE で守る） */                        /* 初回だけ：骨組み→実データのクロスフェード */
  S.enter=false;S.dir=null;S.anim=null;ANIMON=false;
  LASTVIEW=S.view;
  if(S.view==='quiz')bindTilt();
  syncNextBar();                       /* 解説中だけ下に「次の問題」を出す（描画のたびに合わせる） */
  /* 入場アニメーションが終わったらクラスを外す。終わった時点の見た目は最終状態と同じなので
     見た目は変わらず、あとで再描画されても座標が飛ばない。 */
  Array.prototype.forEach.call(v.querySelectorAll('.qin'),function(el){
    el.addEventListener('animationend',function(){el.classList.remove('qin')},{once:true});
  });
}
var LASTVIEW=null,ANIMON=false;
/* 段差クラス（入場時だけ付ける） */
function stag(){return ANIMON?' stag':''}
var TABS=[['home','ホーム',IC.home],['fields','学習',IC.book],['review','復習',IC.again],['analysis','分析',IC.chart]];
/* 学習タブの呼び名は中身に合わせる（単元学習／動画学習）。画面の見出しと読み上げが食い違わないため。
   2026-08-15：既定が単元側になったので「動画学習」で固定していると中身と合わない。 */
function tabLabel(x){return x[0]==='fields'?(S.fmode==='cat'?'単元学習':'動画学習'):x[1]}
function renderTabs(){
  var cur=(S.view==='study'||S.view==='fields')?'fields':(S.view==='quiz'?'':S.view);
  /* アイコンのみ（文字ラベルなし）。読み上げ用に aria-label と title を残す */
  document.getElementById('tabs').innerHTML=TABS.map(function(x){
    var lb=tabLabel(x);
    return '<button data-act="tab" data-v="'+x[0]+'" class="'+(cur===x[0]?'on':'')+'"'
      +' aria-label="'+lb+'" title="'+lb+'"'+(cur===x[0]?' aria-current="page"':'')+'>'+x[2]
      +'<i class="m6-uline"></i></button>';
  }).join('');
  m6TabDraw();      /* 選択が変わったときだけ線を引く（同じタブの再描画では動かさない） */
}

/* ---------- ホーム（引き算：説明文を置かず、数字と図で示す） ---------- */
function vHome(){
  var st=allStats(),pl=plan(),dl=pl.daysLeft;
  var h='<div class="pad'+stag()+'">';
  /* H3-b：「試験まで」と「1日あたり何本」を同じ大きさで横に並べる（2026-08-14 確定）。
     1日あたり＝まだ終わっていない動画の本数 ÷ 残り日数。問題数ではなく本数で出す。 */
  /* 1日あたり＝残りの問題数 ÷ 残り日数。主教材が4本（科目まるごと）になったので
     本数では意味を持たない（44章÷65日＝0.7章/日）。章の名前は下の「今日の流れ」で出す。 */
  var left=unseenItems(true).length,perday=(dl>0?Math.ceil(left/dl):left);
  h+='<div class="rowx" style="margin:0 0 12px"><span class="mini">宅建</span>'
    +'<span class="mini" style="margin-left:auto">'+today().slice(5).replace('-','月')+'日</span>'
    +'<button class="btn sm" style="width:auto;min-height:28px;padding:0 8px" data-act="data"'
    +' aria-label="記録の書き出しと読み込み">'+IC.io+'</button></div>';
  /* 4枚とも「小花＋見出し＋数字」の同じ作りにする。1枚だけ違う形にしない。
     復習の数は捨てず、見出しに添える（数字の行に入れると3桁のときだけ折り返して1枚だけ窮屈になる）。 */
  var dd=ST.days[today()]||{n:0,ok:0},dn=dd.n||0,dnew=dd.newq||0,drev=Math.max(0,dn-dnew),sc0=scoreNow();
  h+='<div class="hpair">'
    +'<div class="hcard">'+flw(17)+'<div class="hlab">試験まで</div>'
    +'<div class="hnum'+(dl<=30?' near':'')+'">'+n3(dl)+'<span>日</span></div></div>'
    +'<div class="hcard">'+flw(17)+'<div class="hlab">1日あたり</div>'
    +'<div class="hnum">'+n3(newToday())+'<span>/ '+n3(perday)+'問</span></div></div>'
    +'<div class="hcard">'+flw(17)+'<div class="hlab">今日'+(drev?'・復習 '+n3(drev):'')+'</div>'
    +'<div class="hnum">'+n3(dn)+'<span>問</span></div></div>'
    +'<div class="hcard">'+flw(17)+'<div class="hlab">いま</div>'
    /* 分母は分析①と同じ CATQ_TOTAL（49点）。ここだけ 50 とベタ書きすると2画面で食い違う */
    +'<div class="hnum">'+sc0.pts.toFixed(1)+'<span>/ '+sc0.total+'点</span></div></div>'
    +'</div>';
  /* 今日の実績を1行だけ。カードは増やさない（引き算の原則）。
     合計＝その日の回答数／新規＝はじめて解いた数／復習＝残り／正解＝その日の正答率。 */
  /* 「今日 ◯問（復習 ◯）　いま ◯/50点」の1行は、上の4枚のカードに畳んだので置かない
     （2026-08-15 本人指示。同じ数字を2か所に出さない）。 */
  h+=hdots();
  /* このアプリ全体でどこまで進んだか（2026-08-17 本人指示）。カードは増やさず1行＋バー。
     ・学習 N/M問 … 一度でも答えた問題（実数）／このアプリで解ける問題数（ITEMS＝単元に入っている数）
     ・解いた問題数 … のべ回数（同じ問題を2回答えれば2）
     設定画面に出る「読み込み 5,924」は**読み込んだ肢の総数**で、ここの分母とは別のもの。 */
  var apd=0,apn=0;
  ITEMS.forEach(function(it){var r=R(it.id),a=att(r);if(a){apd++;apn+=a}});
  h+='<div class="hstat"><span>学習 <b>'+n3(apd)+'</b>/'+n3(ITEMS.length)+'問</span>'
    +'<span>解いた問題数 <b>'+n3(apn)+'</b>問</span></div>'
    +'<div class="bar3" style="margin-bottom:14px"><i style="width:'
    +(ITEMS.length?(apd/ITEMS.length*100).toFixed(1):'0')+'%"></i></div>';
  if(!LSOK)h+='<div class="warn" style="margin-bottom:12px">'+IC.warn+' この端末では進行状況が残りません</div>';
  /* 記録を失わないための案内。条件を満たしたときだけ1行（常設しない＝SPEC §5-1 引き算の原則）。
     ホーム画面の案内は一度閉じたら二度出さない（settings.a2hs）。 */
  if(LSOK&&!standalone()&&!ST.settings.a2hs)
    h+='<div class="warn rowx" style="margin-bottom:12px;gap:8px">'+IC.warn
      +'<span style="flex:1">ホーム画面に追加すると記録が残ります</span>'
      +'<button class="btn sm" style="width:auto;min-height:28px;padding:0 8px" data-act="a2hsOK"'
      +' aria-label="閉じる">'+IC.close+'</button></div>';
  /* バックアップの促しはホームに出さない（2026-08-14 本人指定＝案C）。
     解いた記録は1問ごとに自動保存されているので、催促は設定の中だけに置く。 */

  /* 今日の流れ＝終わったもの・いま・まだ。学習の順は「動画を見る → その動画の問題を解く」
     なので、その3つを順に並べる（2026-08-14 確定）。数字の枠はホームから外し、
     抜き打ちと間違いは復習の画面に集約した＝引き算の原則。 */
  h+=verLineHtml();      /* 出題中に新しいデータが来たとき／失敗したときだけ出る */
  h+=checkHtml();        /* 私が直した分のチェック（CHECK が空のときは何も出ない） */
  h+=mockRowHtml();      /* 模試（本試験形式・4択）＝いまの実力を測る */
  h+=flowHtml();

  /* 中断中の出題セッション */
  if(hasRun()){
    var r=ST.run;
    h+='<div class="panel" style="border-color:#bfe0d1;background:#f1faf6"><div class="spread">'
      +'<div><div class="mini">中断中</div>'
      +'<div style="font-size:14px;font-weight:600">'+esc(r.label||'出題')+'</div>'
      +'<div class="mini num">'+Math.min((r.qi||0)+1,r.queue.length)+' / '+r.queue.length+'</div></div>'
      +'<button class="btn acc" style="width:auto" data-act="runResume">再開</button></div></div>';
  }

  /* ホームにボタンは置かない（2026-08-16 本人指示。「動画を見る」「問題を解く」に続いて
     「単元学習」も不要）。入口は下のタブ＝学習タブに一本化する。 */
  h+='</div>';
  h+=verFootHtml();      /* データの版＝隅に小さく（押せない） */
  return h;
}
/* その大分類を「今日の流れ」で解禁する動画たち。
   主教材（こざりえ）だけを見ていたので、こざりえの動画が1本も無い大分類
   ＝不動産価格の評定（あこ課長4本のみ・112問＝本試験の不動産鑑定評価1点）が、
   1周の分母には入っているのにホームの導線からは一生出てこなかった（2026-08-15 批評）。
   こざりえが無ければ SRCRANK の順（こざりえ→こうのすけ→あこ課長）で次のチャンネルに落とす。 */
function flowVids(b){
  var vs=(BIGVIDS[b]||[]).filter(function(v){
    return !SRCHIDE[VSRC[v]]&&videoItemsUp(v).length;    /* 問題が0本の動画は解禁の役に立たない */
  });
  var best=9;
  vs.forEach(function(v){var r=srcRank(v);if(r<best)best=r});
  return vs.filter(function(v){return srcRank(v)===best})
    .sort(function(x,y){return (VUP[y]||'').localeCompare(VUP[x]||'')});  /* 公開が新しい順＝2026年版が先 */
}
/* 全部の大分類を学習の順（宅建業法→権利関係→法令→税・その他）にたどって、
   まだ終わっていない動画を返す。 */
function nextVidAll(){
  var out=null;
  bigsOrdered().some(function(b){
    var v=nextVidOf(flowVids(b),true);   /* true＝「未着手が0」で次へ進む（全問正解では進まない） */
    if(v){out=v;return true}
    return false;
  });
  return out;
}
/* まだ終わっていない動画の本数（1日あたりの本数の分子） */
function vidsLeft(){
  var n=0;
  bigsOrdered().forEach(function(b){
    flowVids(b).forEach(function(v){
      if(restCount(videoItemsUp(v))>0)n++;
    });
  });
  return n;
}
/* 今日の流れ＝「直前に終わった問題」「いまの動画」「その動画の問題」の3行 */
/* 今日の流れ＝①いまの科目の動画 ②その科目の未着手（新規） ③抜き打ち。
   主教材が「1本＝1科目」になったので、動画は科目単位・問題は枠ぶんで出す。 */
/* ---------- 版の行（2026-08-18） ----------
   データの出どころが3つ（手渡しの34MB・リポジトリ・保存領域）あるのに画面に何も出ておらず、
   「どれが動いているか」を毎回聞くことになっていた。**常時出す**。
   iOSはホーム画面のアプリとSafariで保存領域が別なので、それも出す。
   取り込むものがあれば「開き直す」を出す（勉強中に勝手に入れ替えない）。 */
/* データの版＝**隅に小さく**（2026-08-18 本人「目立たせなくていい。隅の方でよく見ると
   あるくらいでいい」）。枠もボタンも置かない。困ったときだけ読めればよい。
   例外は2つ＝①出題中に新しいデータが来た（開き直す）②取り込みに失敗した（理由を出す）。 */
function verLineHtml(){
  var v=window.TAKKEN_SRC;
  if(!v)return '';
  if(v.pending)
    return '<div class="rowx" style="gap:8px;align-items:center;margin-bottom:10px">'
      +'<span class="mini" style="flex:1">新しいデータがあります</span>'
      +'<button class="btn sm" style="width:auto" data-act="dreload">開き直す</button></div>';
  if(v.err)
    return '<div class="mini" style="margin-bottom:10px;color:var(--ngdeep)">'
      +esc(v.err)+'</div>';
  return '';
}
/* 隅の1行（ホームの末尾）。押せない・小さい・薄い。 */
function verFootHtml(){
  var v=window.TAKKEN_SRC;
  if(!v)return '';
  return '<div class="mini" style="margin-top:18px;opacity:.45;font-size:10px;text-align:right">'
    +esc(v.at||'—')+'　'+n3(v.n||0)+'問　図'+(v.figs||0)+'　'+esc(String(v.ver||'?'))+'</div>';
}
/* 私が直した問題だけを、直した順に確かめる（2026-08-18 本人指定）。
   1問→3問→5問→10問→全部 と段を上げ、OKが出てから次の範囲へ広げる。
   卒業した問題も出す（keepGrad）／未習でも出す（pickExplicit）／並べ替えない（keepOrder）。 */
function checkList(){
  /* 配信の回を**溜められる**ようにした（2026-08-19 本人「もうこの基準で作成していいよ。
     なんかあったら報告するからそれを対処してくれれば問題ない」＝1単元ごとの承認待ちをやめた）。
     枠が1つだと次の単元を配信した時点で前の単元のチェックが消えるので、単元ごとに行を並べる。
     ・新しい順に並べる ・解き切った回（ST.checkDone[dataAt]）は消える
     ・古いデータの端末では CHECKS が無いので CHECK 1件に落とす（落ちない） */
  var a=(window.CHECKS&&CHECKS.length)?CHECKS.slice():[CHECK];
  var out=[];
  for(var i=0;i<a.length;i++){
    var c=a[i]||{};
    var ids=(c.ids||[]).filter(function(x){return !!BY[x]});
    if(!ids.length)continue;
    if(c.dataAt&&(ST.checkDone||{})[c.dataAt])continue;
    out.push({unit:c.unit||'',dataAt:c.dataAt||'',ids:ids});
  }
  return out;
}
/* ============ 模試（本試験形式・4択・時間を計る） ============
   2026-08-21 本人の発案「実際にどのくらい覚えているかテストしてみたらわかる」。
   一問一答（肢の○×）では**本試験の点数が測れない**（4肢のうち3肢が曖昧だと選べない）。
   シミュレーションの前提が25点〜41点まで振れた原因がここなので、実測に置き換える。

   作り：同じ (年・月・問) の肢を4つ集め、○が1つだけ（正しいものを選べ）または
   ×が1つだけ（誤っているものを選べ）の問だけを4択として復元する。
   個数問題は4択にできないので外す。 */
/* ============ 模試（本試験形式・49問・時間を計る） ============
   2026-08-21 作り直し。前の版は**同じ問の4肢をそのまま戻していた**ので、答えを覚えていて
   実力が測れなかった（19/20＝95%が出たが、最終解答日は中央値1日前だった）。
   いまは tools/make_mock.py が**別々の年の肢を組み替えて**作った49問を出す。
   ・配点は本試験どおり（権利14・法令8・業法20・税2・価格1・需給と土地建物4）
   ・**個数問題**を入れる（標準6問／難化11問＝2025年型。2025年は業法20問中10問が個数問題）
   ・統計（問48）は素材が無いので入れない＝49問。1点は別枠。
   ・2時間かかるので**閉じても続きから戻れる**（ST.mockRun）。 */
function mockSet(n){for(var i=0;i<MOCKS.length;i++)if(MOCKS[i].n===n)return MOCKS[i];return null}
/* 次にやる回＝まだ終えていない、いちばん小さい回 */
function mockNext(){
  var done={};(ST.mock||[]).forEach(function(r){if(r.set)done[r.set]=1});
  for(var i=0;i<MOCKS.length;i++)if(!done[MOCKS[i].n])return MOCKS[i];
  return MOCKS.length?MOCKS[MOCKS.length-1]:null;   /* 全部やったら最後の回をもう一度 */
}
function mockItems(q){var a=[],i;for(i=0;i<q.ids.length;i++){var x=BY[q.ids[i]];if(x)a.push(x)}return a}
function startMock(n){
  var st=n?mockSet(n):mockNext();
  if(!st){msg('模試のデータが入っていません');return}
  S.mock={set:st.n,kind:st.kind,i:0,sel:[],t0:Date.now(),acc:0,done:false};
  ST.mockRun={set:st.n,kind:st.kind,i:0,sel:[],acc:0,done:false};saveST();
  S.view='mock';S.mockRev=null;render();
}
/* 途中の模試に戻る。経過時間は acc（積み上げ）＋いまの続き。 */
function resumeMock(){
  var r=ST.mockRun;if(!r||r.done)return;
  S.mock={set:r.set,kind:r.kind,i:r.i||0,sel:r.sel||[],t0:Date.now(),acc:r.acc||0,done:false};
  S.view='mock';S.mockRev=null;render();
}
function mockSec(m){return (m.acc||0)+Math.round((Date.now()-m.t0)/1000)}
function mockAnswer(k){
  var m=S.mock;if(!m||m.done)return;
  var st=mockSet(m.set),qs=st.qs;
  m.sel[m.i]=k;
  if(m.i+1<qs.length){m.i++}
  else{
    m.done=true;m.sec=mockSec(m);
    var ok=0,det=[];
    qs.forEach(function(q,i){
      var right=(m.sel[i]===q.ans);if(right)ok++;
      det.push({no:q.no,cat:q.cat,big:q.big,type:q.type,ok:right,sel:m.sel[i],ans:q.ans});
    });
    m.ok=ok;
    if(!ST.mock)ST.mock=[];
    ST.mock.push({at:nowStamp(),set:st.n,kind:st.kind,n:qs.length,ok:ok,sec:m.sec,qs:det});
    ST.mockRun=null;
  }
  /* 1問ごとに保存する（2時間の途中で閉じても消えない） */
  if(!m.done){
    ST.mockRun={set:m.set,kind:m.kind,i:m.i,sel:m.sel,acc:mockSec(m),done:false};
    m.acc=ST.mockRun.acc;m.t0=Date.now();
  }
  saveST();
  render();
}
function vMock(){
  var m=S.mock;
  if(!m)return '<div class="wrap"><div class="mini">模試の状態がありません</div></div>';
  if(m.done)return vMockResult();
  var st=mockSet(m.set),qs=st.qs,q=qs[m.i],a=mockItems(q);
  var h='<div class="wrap">';
  h+='<div class="qhead"><div class="qrow"><span class="qname">模試 第'+st.n+'回</span>'
    +'<span class="qcnt"><span class="num">'+(m.i+1)+'</span><span class="qtot"> / '+qs.length+'</span></span>'
    +'<span class="chip">'+esc(q.cat)+'</span>'
    +(q.type==='個数'?'<span class="chip">個数</span>':'')
    +'<span class="mini" style="margin-left:auto">'+mmss(mockSec(m))+'</span>'
    +'</div><div class="qrule"></div></div>';
  h+='<div class="stem" style="font-weight:600">次の記述のうち、'+esc(q.ask)
    +'ものは'+(q.type==='個数'?'いくつあるか':'どれか')+'。</div>';
  if(q.type==='個数'){
    /* 個数問題＝4肢を読ませて「いくつ」を選ばせる。肢は押せない（数えるのが問題） */
    a.forEach(function(x,k){
      h+='<div class="frow" style="pointer-events:none;height:auto;padding:10px 12px;'
        +'white-space:normal;line-height:1.7;text-align:left;display:block">'
        +'<span class="num" style="margin-right:8px">'+(k+1)+'</span>'+esc(x.stem)+'</div>';
    });
    var LB=['なし','一つ','二つ','三つ','四つ'],n;
    h+='<div style="display:flex;gap:6px;margin-top:10px">';
    for(n=0;n<=4;n++)
      h+='<button class="btn" data-act="mkans" data-k="'+n+'" style="flex:1;padding:12px 0">'+LB[n]+'</button>';
    h+='</div>';
  }else{
    a.forEach(function(x,k){
      h+='<button class="frow" data-act="mkans" data-k="'+k+'" style="text-align:left;height:auto;'
        +'min-height:44px;padding:10px 12px;white-space:normal;line-height:1.7">'
        +'<span class="num" style="margin-right:8px">'+(k+1)+'</span><span>'+esc(x.stem)+'</span></button>';
    });
  }
  h+='<div class="mini" style="margin-top:10px">選ぶと次へ進みます。正誤は最後まで出ません。'
    +'途中で閉じても続きから戻れます。</div>';
  h+='</div>';
  return h;
}
/* 大分類ごとの目標点（40点の配分）と実測の平均点。どこが足りないかを出すために併記する。
   目標＝業法19・権利10・法令7・税2・価格1・需給と土地建物4（統計1点は別枠で合計40）
   平均＝解答速報の集計（日建学院 令和4年・e-takken 令和6年）から算出した実測 */
var MTGT={'宅地建物取引業法等':[19,14.0],'権利関係':[10,7.8],'法令上の制限':[7,5.1],
          '税に関する法令':[2,1.1],'不動産価格の評定':[1,0.5],'土地・建物その他の需給':[4,3.3]};
var MLB=['なし','一つ','二つ','三つ','四つ'];
function vMockResult(){
  var m=S.mock,st=mockSet(m.set),qs=st.qs,h='<div class="wrap">';
  var rate=Math.round(100*m.ok/qs.length);
  h+='<div class="card"><div class="mini">模試 第'+st.n+'回（'+st.kind+'型）の結果</div>'
    +'<div style="font-size:28px;font-weight:600;margin:6px 0">'+m.ok+' / '+qs.length+'問　'+rate+'%</div>'
    +'<div class="mini">かかった時間 '+mmss(m.sec)+'（1問あたり '+mmss(Math.round(m.sec/qs.length))
    +'／本試験は1問2.4分）</div>'
    +'<div class="mini">統計（問48）を別枠の1点として足すと <b>'+(m.ok+1)+'点</b>相当。'
    +'合格点は年で33〜38点、目標は40点。</div></div>';
  var per={};
  qs.forEach(function(q,i){
    var o=per[q.big]=per[q.big]||[0,0];o[1]++;if(m.sel[i]===q.ans)o[0]++;
  });
  h+='<div class="card"><div class="mini">科目ごと（目標／平均と比べる）</div>';
  Object.keys(MTGT).forEach(function(b){
    if(!per[b])return;
    var t=MTGT[b];
    h+='<div class="frow" style="pointer-events:none;height:auto;padding:8px 0">'
      +'<span>'+esc(b)+'</span><span class="fst">'+per[b][0]+' / '+per[b][1]
      +'　<span class="mini">目標'+t[0]+'・平均'+t[1].toFixed(1)+'</span></span></div>';
  });
  h+='</div>';
  var kk=[0,0],k4=[0,0];
  qs.forEach(function(q,i){var t=(q.type==='個数')?kk:k4;t[1]++;if(m.sel[i]===q.ans)t[0]++});
  h+='<div class="card"><div class="mini">形式ごと</div>'
    +'<div class="frow" style="pointer-events:none"><span>4択</span><span class="fst">'+k4[0]+' / '+k4[1]+'</span></div>'
    +'<div class="frow" style="pointer-events:none"><span>個数問題</span><span class="fst">'+kk[0]+' / '+kk[1]
    +'　<span class="mini">2025年は業法20問中10問</span></span></div></div>';
  h+='<div class="card"><div class="mini">間違えた問（押すと肢と解説）</div>';
  var bad=0;
  qs.forEach(function(q,i){
    if(m.sel[i]===q.ans)return;bad++;
    var ko=(q.type==='個数');
    h+='<button class="frow" data-act="mkrev" data-i="'+i+'" style="height:auto;padding:8px 0">'
      +'<span>問'+q.no+'　'+esc(q.cat)+(ko?'（個数）':'')+'</span>'
      +'<span class="fst">選んだ '+(ko?MLB[m.sel[i]|0]:((m.sel[i]|0)+1))
      +' ／ 正解 '+(ko?MLB[q.ans]:(q.ans+1))+IC.chev+'</span></button>';
  });
  if(!bad)h+='<div class="mini">全問正解</div>';
  h+='</div>';
  if(S.mockRev!=null&&qs[S.mockRev]){
    var q2=qs[S.mockRev],a2=mockItems(q2);
    h+='<div class="card"><div class="mini">問'+q2.no+'　次の記述のうち、'+esc(q2.ask)
      +'ものは'+(q2.type==='個数'?'いくつあるか':'どれか')+'。</div>';
    a2.forEach(function(x,k){
      h+='<div style="margin:8px 0"><div style="line-height:1.7">'
        +'<b>'+(k+1)+'</b>　'+(x.ox?'○':'×')+'　'+esc(x.stem)+'</div>'
        +'<div class="mini" style="margin-top:4px">'+esc(x.exp||'')+'</div>'
        +'<div class="mini">出典 '+esc(String((x.src||{}).era||''))+' 問'+((x.src||{}).q||'')+'</div></div>';
    });
    h+='</div>';
  }
  h+='<button class="btn" data-act="go" data-v="home" style="margin-top:10px">ホームへ戻る</button>';
  h+='</div>';
  return h;
}
/* ホームの行。途中の模試があれば「続ける」を出す。 */
function mockRowHtml(){
  if(!MOCKS.length)return '';
  var r=ST.mockRun;
  if(r&&!r.done){
    var stt=mockSet(r.set),tot=stt?stt.qs.length:49;
    return '<button class="frow" data-act="resumeMock">'
      +'<span>模試 第'+r.set+'回を続ける</span>'
      +'<span class="fst">'+((r.i||0)+1)+' / '+tot+'問'+IC.chev+'</span></button>';
  }
  var nx=mockNext(),a=ST.mock||[],last=a[a.length-1];
  return '<button class="frow" data-act="startMock">'
    +'<span>模試 第'+(nx?nx.n:1)+'回（本試験形式・'+(nx?nx.qs.length:49)+'問）</span>'
    +'<span class="fst">'+(last?('前回 '+last.ok+'/'+last.n+'　'):'')
    +(nx&&nx.kind==='難化'?'難化型':'標準型')+IC.chev+'</span></button>';
}
function checkHtml(){
  var list=checkList();
  if(!list.length)return '';
  /* 端末のデータが、いちばん新しい回より古いなら押させない。
     古い図を見て「これは違う」と判断させてしまうと、正解データが汚れる。 */
  var v=window.TAKKEN_SRC||{},at=String(v.at||''),h='';
  for(var i=0;i<list.length;i++){
    var c=list[i];
    if(c.dataAt&&at<c.dataAt){
      h+='<div class="mini" style="margin-bottom:8px;color:var(--ngdeep)">'
        +esc(c.unit||'チェック用問題')+'は、アプリを開き直すと出ます</div>';
      continue;
    }
    h+='<div class="dlv"><span class="dlv-b">配信しました</span><b>'+esc(c.unit||'チェック用問題')
      +'</b><span class="dlv-t">'+esc((c.dataAt||'').slice(5,16))+'</span></div>'
      +'<button class="frow" data-act="startCheck" data-at="'+esc(c.dataAt)+'">'
      +'<span>チェック用問題</span><span class="fst">'+c.ids.length+'問'+IC.chev+'</span></button>';
  }
  return h;
}
function startCheck(at){
  var list=checkList(),c=null;
  for(var i=0;i<list.length;i++)if(!at||list[i].dataAt===at)  { c=list[i]; break }
  if(!c){msg('チェックする問題がありません');return}
  S.pickExplicit=true;S.keepOrder=true;S.kind='review';
  S.checkAt=c.dataAt||'';               /* この回を終えたときに印を付けるため */
  startQueue(c.ids.map(function(i){return BY[i]}),'チェック用問題',false,null,true,false);
}
function flowHtml(){
  var cur=nextVidAll(),pl=plan(),h='<div class="flow">';
  /* 動画の行と「続き」の行は出さない（2026-08-16 本人指示「なくしてほしい」）。
     単元学習をメインに据えたので、ホームから動画・章へ入る導線は使っていない。
     科目の解禁は、学習タブで動画を見るか、単元から解けば（S.pendBig）足りる。 */
  h+='<button class="frow'+(pl.sneak.length?'':' yet')+'" data-act="startSneak">'
    +'<span>抜き打ち</span><span class="fst">'
    +(sneakDone()?'今日は済':(pl.sneak.length?n3(pl.sneak.length)+'問':'なし'))+'</span></button>';
  /* 間違えた問題＝解いたことがあって、間違えて、まだ正解し直していないもの
     （wrongPool＝ng>0 かつ 直近が正解でない）。2026-08-15 本人指定でホームに置いた。 */
  var wp=wrongPool().length;
  h+='<button class="frow'+(wp?'':' yet')+'" data-act="startWrongAll">'
    +'<span>間違えた問題</span><span class="fst">'+(wp?n3(wp)+'問':'なし')+'</span></button>';
  return h+'</div>';
}
/* ホームの「続き」＝次に解く章。順に見る：
   ①直前に解いた章（ST.lastChap）に未着手が残っていればそこ
   ②残っていなければ同じ動画の次の章（nextChap＝未着手が残っている章だけ返す）
   ③記録が無い／その動画も終わったら、いまの動画の最初の（未着手が残る）章
   どれも無ければ null＝行を出さない。 */
function contChap(){
  var lc=ST.lastChap;
  if(lc&&lc.vid&&VTIT[lc.vid]!==undefined){
    var rest=restCount(chapItemsUp(lc.vid,lc.sec));
    /* 名前は章の行（動画学習）と同じ規則で出す＝ホームの「続き」と行の名前が食い違わない */
    if(rest>0)return {vid:lc.vid,sec:lc.sec,label:chapRowLab(lc.vid,lc.sec,lc.label||'章'),rest:rest};
    var nx=nextChap(lc.vid,lc.sec);
    if(nx)return {vid:lc.vid,sec:nx.sec,label:chapRowLab(lc.vid,nx.sec,nx.label||'章'),rest:restCount(chapItemsUp(lc.vid,nx.sec))};
  }
  var v=nextVidAll();
  if(!v)return null;
  var cs=chapsOf2(v);
  for(var i=0;i<cs.length;i++){
    var r2=restCount(chapItemsUp(v,cs[i].sec));
    if(r2>0)return {vid:v,sec:cs[i].sec,label:chapRowLab(v,cs[i].sec,cs[i].label||'章'),rest:r2};
  }
  return null;
}
/* その動画の章（skipを除く） */
function chapsOf2(vid){
  var out=[],seen={};
  Object.keys(CHAP).forEach(function(cat){
    (CHAP[cat]||[]).forEach(function(v){
      if(v.vid!==vid)return;
      (v.chapters||[]).forEach(function(c){
        if(c.skip||seen[c.sec])return;seen[c.sec]=1;out.push({sec:c.sec,label:c.label});
      });
    });
  });
  return out.sort(function(a,b){return a.sec-b.sec});
}
function chapStat(vid,sec){
  var its=chapItems(vid,sec),ok=0;
  its.forEach(function(it){var r=R(it.id);if(r&&((r.streak||0)>0||r.state==='卒業'))ok++});
  return {n:its.length,ok:ok,done:its.length>0&&ok===its.length};
}
/* 今日の3枠（新規・復習・抜き打ち）。0のときは押せない見た目にする */
function q3cell(label,n,act,on){
  return '<button class="q3c'+(on?'':' off')+'"'+(on?' data-act="'+act+'"':' disabled')+'>'
    +'<b class="num">'+n3(n)+'</b><span>'+label+'</span></button>';
}
/* 4状態＝1本の帯（卒業・定着・学習中・未着手）。タップで内訳を開く */
function bandHtml(st){
  var tot=Math.max(1,ITEMS.length),un=tot-(st.grad+st.keep+st.learn);
  function seg(n,cls){return n?'<i class="'+cls+'" style="flex:'+n+'"></i>':''}
  return '<button class="band" data-act="togstat" aria-label="内訳">'
    +seg(st.grad,'g')+seg(st.keep,'k')+seg(st.learn,'l')+seg(un,'u')+'</button>';
}
/* ホームの4状態＝カウントアップの対象（min-width:4ch で桁を予約） */
function fourTile(id,v,label,style){
  return '<div class="m4-tile" id="'+id+'T"><b style="'+style+'">'
    +'<span class="m4-num" id="'+id+'" style="min-width:4ch;font-size:19px">'+v+'</span></b>'
    +'<span>'+label+'</span></div>';
}
/* ホームを開いた時：4状態を前回値から回して着地させる */
var M4HOME={grad:0,keep:0,learn:0,sev:0},M4HOMENEW=null,M4ANA=null;
function m4UpdateHome(st){
  m4CountUp(document.getElementById('hGrad'),M4HOME.grad,st.grad,450,{big:8,tile:document.getElementById('hGradT')});
  m4CountUp(document.getElementById('hKeep'),M4HOME.keep,st.keep,450,{big:8,tile:document.getElementById('hKeepT')});
  m4CountUp(document.getElementById('hLearn'),M4HOME.learn,st.learn,450,{big:8,tile:document.getElementById('hLearnT')});
  m4CountUp(document.getElementById('hSev'),M4HOME.sev,st.sev,450,{big:5,tile:document.getElementById('hSevT')});
  M4HOME={grad:st.grad,keep:st.keep,learn:st.learn,sev:st.sev};
}
function allStats(){
  var a=0,ok=0,ng=0,grad=0,keep=0,learn=0,sev=0;
  ITEMS.forEach(function(it){
    var r=R(it.id);if(!r)return;
    ok+=r.ok||0;ng+=r.ng||0;if(att(r)>0)a+=att(r);
    var s=stateOf(it.id);
    if(s==='卒業')grad++;else if(s==='定着')keep++;else if(s==='学習中')learn++;
    if(severeItem(it.id))sev++;
  });
  return {att:a,ok:ok,ng:ng,rate:(ok+ng)?ok/(ok+ng):null,grad:grad,keep:keep,learn:learn,sev:sev};
}

/* ---------- 分野選択 ---------- */
/* ---------- 動画学習の一覧（B案＋C案・2026-08-14 本人が選択） ----------
   軸＝大分類（学習順）→ その大分類の動画を再生リスト順（#1→#2→…）→ 章 → 問題。
   本人「基本的に動画で学習するんだから、権利関係をやるんだったら権利関係の動画を
   再生リスト順に順番にやるんだよ」。49マスのヒートマップと小分類を軸にした一覧は廃止した
   （小分類は絞り込みと分析にだけ残す）。
   行＝「#4｜見出し｜実測時間｜12/41｜›」。行の左から進捗ぶんを薄緑で塗る（バーは置かない）。
   時間は動画の尺ではなく、その動画に実際に費やした時間（視聴＋その動画の問題）＝vidMs()。 */
/* ---------- 単元で進む（小分類ごとに解く） ----------
   本人の注文（2026-08-15）「過去問道場の小分類ごとに問題を解いてもいいような気がした」
   「動画学習か単元学習で分けて勉強できるようにもできないかな？」。
   動画で進む側は一切変えず、入口を1つ増やして横に並べる。 */

/* 単元の中を、こざりえの字幕で割った小見出しで束ねる（chapters.json の subs と対になる
   肢側の videos[].sub／videos[].csec を使う）。sub を持たない肢は「その他」等にまとめない
   ＝無理に分けず、親の行の「全 N問」でだけ解けるようにする（本人指示）。
   一覧を開くたびに5,237肢を走らないよう、単元ごとに1回だけ作って持っておく。 */
/* 素の小見出しは粒度がばらばら（2026-08-15 批評の実測：最小1肢・最大116肢・中央値35肢）で、
   1肢の行は押す意味がなく、116肢は1回では終わらない。ここで束ね直して均す。
   ・USUB_MIN 未満 … 前の小見出しへ寄せる（先頭なら次へ）。畳んだ論点は「ほかN」に足して消さない
   ・USUB_MAX 超  … 均等に分けて「（1/3）」を付ける
   元データ（chapters.json の subs／videos[].sub）はデータ側の担当のものなので触らない。
   30 という数字は実データで決めた：30 で切ると 全180区切り・最大30肢・中央値20肢・最小10肢
   （40 だと 131区切り・最大40・中央値30 で、30超が63件残る）。 */
var USUB_MIN=5,USUB_MAX=30;
/* 見出しは「A／B／C　ほか3」の形。iPhone 15（393px）では38字が3行に折り返す。
   先頭の1つだけ残して、残りは「ほかN」に畳む。**途中で「…」に切ると何の章か分からなくなる**ので、
   区切り（／）の単位でしか落とさない。 */
function subExtra(lab){
  var s=String(lab||''),m=/　ほか(\d+)$/.exec(s),n=0;
  if(m){n+=+m[1];s=s.slice(0,m.index)}
  var p=s.split('／').filter(function(x){return x});
  return n+Math.max(0,p.length-1);
}
function subHead(lab){
  var s=String(lab||''),m=/　ほか(\d+)$/.exec(s);
  if(m)s=s.slice(0,m.index);
  var p=s.split('／').filter(function(x){return x});
  return p.length?p[0]:String(lab||'');
}
function subLabel(lab,extra){
  var n=subExtra(lab)+(extra||0);
  return subHead(lab)+(n>0?'　ほか'+n:'');
}
/* 同じ見出しが複数の単元に出るもの（2026-08-15 批評：借地借家法の土地／建物で6ラベル重複ほか）。
   こざりえの1つの章を2つの単元で分け合っているのが原因なので、行に「この単元ぶん」と添えて
   「同じ行が2つある」ように見えるのを防ぐ。全問1回だけなめて作る。 */
var SUBDUP=null;
function subDupMap(){
  if(SUBDUP)return SUBDUP;
  var m={};SUBDUP={};
  ITEMS.forEach(function(it){
    var vs=vidsOf(it),g=null;
    for(var i=0;i<vs.length;i++){if(vs[i]&&vs[i].sub){g=vs[i];break}}
    if(!g)return;
    (m[g.sub]=m[g.sub]||{})[it.cat]=1;
  });
  Object.keys(m).forEach(function(k){if(Object.keys(m[k]).length>1)SUBDUP[k]=1});
  return SUBDUP;
}
var CSUB={};
function catSubs(cat){
  if(CSUB[cat])return CSUB[cat];
  var map={},order=[],none=0;
  itemsOfCat(cat).forEach(function(it){
    if(!it)return;
    var vs=vidsOf(it),g=null;
    /* vidsOf は こざりえ→こうのすけ→あこ課長 の順に並んでいるので、先頭に近い方の小見出しを採る */
    for(var i=0;i<vs.length;i++){if(vs[i]&&vs[i].sub){g=vs[i];break}}
    if(!g){none++;return}
    if(!map[g.sub]){
      map[g.sub]={sub:g.sub,vid:g.vid,ids:[],extra:0,
                  sec:(typeof g.sec==='number'?g.sec:0),
                  csec:(typeof g.csec==='number'?g.csec:0)};
      order.push(g.sub);
    }
    map[g.sub].ids.push(it.id);
  });
  var a=order.map(function(k){return map[k]});
  /* 並びは動画を見る順（章の秒 → 小見出しの秒）＝解く順が動画の進行と一致する */
  a.sort(function(x,y){return x.csec-y.csec||x.sec-y.sec});
  /* ①小さすぎる区切りを前へ寄せる（畳んだぶんの論点数は「ほかN」に足す＝黙って消さない） */
  var mg=[];
  a.forEach(function(s){
    if(s.ids.length<USUB_MIN&&mg.length){
      var p=mg[mg.length-1];
      p.ids=p.ids.concat(s.ids);
      p.extra+=1+subExtra(s.sub);
    }else mg.push(s);
  });
  if(mg.length>1&&mg[0].ids.length<USUB_MIN){        /* 先頭だけは前が無いので次へ寄せる */
    mg[1].ids=mg[0].ids.concat(mg[1].ids);
    mg[1].extra+=1+subExtra(mg[0].sub);
    mg.shift();
  }
  /* ②大きすぎる区切りを均等に分ける。1つの小見出しの中は肢の秒が全部同じ（実測：103区切り
     すべてで秒が1種類）ので秒では割れない。並び順（＝出題される順）で等分する。 */
  var out=[],dup=subDupMap();
  mg.forEach(function(s){
    var n=s.ids.length,k=Math.max(1,Math.ceil(n/USUB_MAX)),base=subLabel(s.sub,s.extra),i=0;
    for(var j=0;j<k;j++){
      var sz=Math.ceil((n-i)/(k-j));
      out.push({sub:base+(k>1?'（'+(j+1)+'/'+k+'）':''),full:s.sub,vid:s.vid,
                sec:s.sec,csec:s.csec,dup:!!dup[s.sub],ids:s.ids.slice(i,i+sz)});
      i+=sz;
    }
  });
  CSUB[cat]={subs:out,none:none};
  return CSUB[cat];
}
/* 単元の1行。小見出しが2つ以上あるときだけ <details> にする（1つなら開いても中身が同じ）。
   開閉はJSでやらない＝章の一覧と同じ <details>（m6-det）に乗せ、開いた状態だけ S.openChap に写す。 */
function urowHtml(c){
  /* 2026-08-17 作り直し：動画学習の行（vrowHtml）とまったく同じ形にする。
     ・36px・1行・罫線なし・左から進捗を薄緑で塗る
     ・「単元名｜毎年N問｜正解/全｜›」。番号は出さない（あこの #4 と数字がずれるため）
     ・毎年N問は小数1桁（2桁目は判断に関係しない＝本人）
     ・全部正解した単元は淡く＋✓
     ・押すと単元ページへ遷移する。「残り」「全」の2ボタンはそのページへ移した。 */
  var st=catStat(c),q=CATQ[c]||0,off=CATQ_OFF[c];
  var done=(st.n>0&&st.okn>=st.n),pc=st.n?st.okn/st.n:0;
  return '<button class="vrow'+(done?' done':'')+'" data-act="ucat" data-c="'+esc(c)+'"'
    +' data-m6k="ucat:'+esc(c)+'">'
    +((pc>0&&pc<1)?'<span class="fill" data-m6v="'+pc.toFixed(4)
        +'" data-m6vk="ucat:'+esc(c)+'"></span>':'')
    +'<span class="rc"><span class="nm">'+esc(c)+'</span>'
    +'<span class="n2">'+(off?esc(off):'毎年 '+q.toFixed(1)+'問')+'</span>'
    +'<span class="n2">'+st.okn+'/'+st.n+'</span>'
    +(done?'<span class="ck">'+IC.check+'</span>':'<span class="ar">'+IC.chev+'</span>')
    +'</span></button>';
}
/* 単元を「習う順」に並べるための代表値（2026-08-15 本人指示
   「小分類の順番が毎年何問出るか順になってるけど…習う順番にして欲しい」）。
   主教材の講義順＝あこ課長の再生リストの通し番号（data/curriculum.json の seq_of_vid）。
   あこ課長は1本＝1論点に近い粒度なので、これが「習う順」にいちばん近い。
   ・代表値＝その単元の肢がいちばん多く紐づいている「通し番号を持つ動画」の番号
     （通し番号を持つのはあこ課長だけ＝チャンネル名を書かずに済ませている）。
   ・同じ番号なら、その動画の中の章の秒数（中央値）で。
   ・通し番号を持つ動画に1本も紐づかない単元（その他の法令）は末尾へ。
   ・出題頻度（CATQ）は並びから外すだけで、表示は残す（どこから手を付けるかの判断材料）。
   全問なめるので1回だけ計算して覚える（描画のたびに数えない）。 */
var CATSEQ=null;
function catSeqMap(){
  if(CATSEQ)return CATSEQ;
  CATSEQ={};
  CATS.forEach(function(c){
    var cnt={},secs={};
    itemsOfCat(c).forEach(function(it){
      if(!it)return;
      var seen={};
      vidsOf(it).forEach(function(v){
        var s=seqOfVid(v.vid);
        if(s===null||seen[v.vid])return;
        seen[v.vid]=1;                       /* 同じ肢が同じ動画に何度も出ても1回だけ数える */
        cnt[s]=(cnt[s]||0)+1;
        (secs[s]=secs[s]||[]).push(typeof v.csec==='number'?v.csec:(typeof v.sec==='number'?v.sec:0));
      });
    });
    var best=null;
    Object.keys(cnt).forEach(function(k){
      var s=+k;
      if(best===null||cnt[s]>cnt[best]||(cnt[s]===cnt[best]&&s<best))best=s;
    });
    if(best===null){CATSEQ[c]={seq:99999,sec:0};return}
    var a=secs[best].slice().sort(function(x,y){return x-y});
    CATSEQ[c]={seq:best,sec:a[Math.floor(a.length/2)]||0};
  });
  return CATSEQ;
}
/* 単元の並び（大分類の中を習う順に）。「次の単元へ」の行き先を、一覧に並んでいる順と合わせる。
   ★同じ式が vFieldsCat() の中にもある（検査 L2 がそこの .sort を直接読むため）。**両方直すこと。** */
/* 知識の単元ではなく「問題の形式」でまとめた寄せ集めは、その大分類のいちばん後ろに回す。
   2026-08-17 本人指摘：権利関係が「条文問題・その他」から始まっていた。
   中身の16肢が あこ課長 #29【契約】用語まとめ に紐づくため代表値が最小になっていたが、
   ここから学び始めることはない。並べ替えの第1キーとして落とす。 */
function catTail(c){return /条文問題/.test(c)?1:0}
function catsSorted(b){
  var sq=catSeqMap();
  return catsOfBig(b).slice().sort(function(x,y){
    var a=sq[x]||{seq:99999,sec:0},d=sq[y]||{seq:99999,sec:0};
    return catTail(x)-catTail(y)                             /* ⓪寄せ集めは末尾 */
      ||a.seq-d.seq                                   /* ①講義で習う順（通し番号） */
      ||a.sec-d.sec                                        /* ②同じ動画なら章の秒が早い順 */
      ||(CATQ[y]||0)-(CATQ[x]||0)                          /* ③それでも同じなら出題数が多い順 */
      ||(x<y?-1:1);
  });
}
function catsOrdered(){
  var out=[];bigsOrdered().forEach(function(b){out=out.concat(catsSorted(b))});return out;
}
/* 単元・小見出しを完走したときの「次」。単元学習をメインに据えたのに完走のたびに
   動画モードへ引き戻されていた（2026-08-15 批評）ので、単元側にも導線を作る。
   ①小見出しから入ったなら、まず同じ単元でまだ残りがある次の小見出し
   ②無ければ、一覧と同じ並びで次の（残りがある）単元。最後まで行ったら先頭へ回る
   動画・章から入ったとき（roundCat が無い）は null＝「次の章へ」に任せる。 */
function nextUnit(){
  if(!S.roundCat||!CINFO[S.roundCat])return null;
  var c=S.roundCat;
  if(typeof S.roundSub==='number'){
    var subs=catSubs(c).subs;
    for(var i=0;i<subs.length;i++){
      if(i===S.roundSub)continue;
      if(restCount(subs[i].ids.map(function(x){return BY[x]}).filter(Boolean))>0)
        return {cat:c,i:i,label:usubLab(subs[i]),sub:true};
    }
  }
  var a=catsOrdered(),k=a.indexOf(c);
  if(k<0)k=0;
  for(var j=1;j<=a.length;j++){
    var cc=a[(k+j)%a.length];
    if(cc===c)continue;
    if(restCount(itemsOfCat(cc))>0)return {cat:cc,i:null,label:cc,sub:false};
  }
  return null;
}
/* 「単元で進む」で開いている大分類。記録（settings.ubOpen）に残して次に開いたときも同じ状態にする。
   まだ一度も触っていないときの既定＝**残りがある最初の大分類だけ開く**。
   理由：①全部開くと約5,200px（iPhone 15 で6画面ぶん）＝目的の単元まで指が届かない
        ②全部閉じると毎回2タップ必要で「単元学習をメイン」に合わない
        ③カリキュラムは業法から始まるので、最初の未完了＝いま手を付ける所になる。
   一度でも開閉したらその状態を丸ごと保存するので、既定が効くのは最初の1回だけ。 */
function ubOpenMap(){
  if(S.ubOpen)return S.ubOpen;
  var saved=ST.settings&&ST.settings.ubOpen;
  if(saved&&typeof saved==='object'){S.ubOpen=saved;return saved}
  var m={},hit=false;
  bigsOrdered().forEach(function(b){
    var r=0;
    catsOfBig(b).forEach(function(c){r+=restCount(itemsOfCat(c))});
    m[b]=(!hit&&r>0);
    if(m[b])hit=true;
  });
  /* 残りが1問も無い（全部解き終えた）ときは上の条件で全部閉じてしまうので、先頭だけ開けておく
     ＝一覧が丸ごと畳まれた状態で始まらないようにする */
  if(!hit){var f=bigsOrdered()[0];if(f)m[f]=true}
  S.ubOpen=m;
  return m;
}
/* 単元の一覧。大分類ごとにまとめ、その中は講義で習う順（catSeqMap）に並べる。
   大分類のパネルは <details> で畳める（開閉はJSでやらない＝章・単元と同じ骨格）。 */
function vFieldsCat(){
  /* 絞り込み（すべて／残り）のボタンは vFields() の1行にまとめてある（2026-08-17 本人指示）。
     単元学習は『通しで学んだあとの取りこぼしを拾う』画面なので、終わった単元を消せないと
     拾う先を探せない。「習った残り」は作らない＝本人の定義では 習った＝残り0 で常に空になる。 */
  var h='',sq=catSeqMap(),om=ubOpenMap();
  bigsOrdered().forEach(function(b){
    var cs=catsOfBig(b);
    if(!cs.length)return;
    /* 並べ替えの式は catsSorted()（「次の単元へ」が使う）と**同じ**。
       検査 L2 が vFieldsCat の中の .sort を直接読むので、ここに式を残している。
       片方だけ変えると一覧の次の行と「次の単元へ」の行き先がずれる＝必ず両方直すこと。 */
    cs=cs.slice().sort(function(x,y){
      var a=sq[x]||{seq:99999,sec:0},d=sq[y]||{seq:99999,sec:0};
      return catTail(x)-catTail(y)                           /* ⓪寄せ集め（条文問題）は末尾 */
        ||a.seq-d.seq                                        /* ①講義で習う順（通し番号） */
        ||a.sec-d.sec                                        /* ②同じ動画なら章の秒が早い順 */
        ||(CATQ[y]||0)-(CATQ[x]||0)                          /* ③それでも同じなら出題数が多い順 */
        ||(x<y?-1:1);
    });
    var bq=0,br=0;
    cs.forEach(function(c){bq+=CATQ[c]||0;br+=restCount(itemsOfCat(c))});
    /* 「残り」を選んでいるときは、全部正解した単元を消す。
       大分類ごと空になったら見出しも出さない（空の箱を並べない）。 */
    if(S.urest){
      cs=cs.filter(function(c){var t=catStat(c);return !(t.n>0&&t.okn>=t.n)});
      if(!cs.length)return;
    }
    var bk='B:'+b,bo=!!om[b];             /* 開閉の記録（無ければ ubOpenMap() の既定） */
    h+='<details class="panel ub m6-det" data-k="'+esc(bk)+'"'+(bo?' open':'')+'>'
      +'<summary><span class="nm">'+esc(b)+'</span>'
      +'<span class="m6-mk">'+IC.chev+'</span>'
      +'<span class="sm">単元 '+cs.length+' ／ 毎年 '+bq.toFixed(1)+'問 ／ 残り '+n3(br)+'問'
      /* 大分類まるごとの残りを拾う入口。主役ではない（本人は基本、単元＝小分類で解く）ので
         大きなボタンにせず、見出しの右端に控えめに置く。閉じたままでも押せる。 */
      +(br?'<span class="ubrest" role="button" data-act="ubrest" data-b="'+esc(b)+'">残りを解く</span>':'')
      +'</span>'
      +'</summary><div class="vlist">';
    cs.forEach(function(c){h+=urowHtml(c)});
    h+='</div></details>';
  });
  /* 末尾の説明4行は置かない（2026-08-17 本人指示）。「小見出しなし」の印を消したので
     その説明も要らなくなった。並びの根拠と配点の根拠は SPEC.md に書いてある。 */
  return h;
}

function vFields(){
  /* 学習の入口は2つ。「動画で進む」＝今までの画面（動画→章→問題）、
     「単元で進む」＝小分類の一覧。選んだ側は記録（settings.fmode）に残し、次に開いたときも同じ側を出す。 */
  var cm=(S.fmode==='cat');
  var h='<div class="pad'+stag()+'"><div class="h">'+(cm?'単元学習':'動画学習')+'</div>'
    +'<div style="margin:0 0 12px">'
    /* 2026-08-17 本人指示：入口の切替と絞り込みを**1行**にまとめる
       （「動画学習　単元学習 / すべて　残り」）。呼び名も画面の見出しと同じ言葉にそろえる。 */
    +'<button class="tog'+(cm?'':' on')+'" style="margin:0 6px 6px 0" data-act="fmode" data-v="video">動画学習</button>'
    +'<button class="tog'+(cm?' on':'')+'" style="margin:0 6px 6px 0" data-act="fmode" data-v="cat">単元学習</button>'
    +(cm?('<span class="togsep">/</span>'
      +'<button class="tog'+(S.urest?'':' on')+'" style="margin:0 6px 6px 0"'
      +' data-act="ufilt" data-v="">すべて</button>'
      +'<button class="tog'+(S.urest?' on':'')+'" style="margin:0 6px 6px 0"'
      +' data-act="ufilt" data-v="rest">残り</button>'):'')
    +'</div>';
  h+=(cm?vFieldsCat():vFieldsVideo());
  h+='</div>';
  return h;
}
/* 動画で進む＝2026-08-15 までの学習タブそのもの（外枠と見出しだけ vFields() へ移した） */
function vFieldsVideo(){
  var h='';
  /* 動画学習はあこ課長だけ（2026-08-17 本人指示）。
     こざりえ・こうのすけは分かりやすいが範囲を覆えていないので、通しで学ぶ教材にはしない。
     この2人は**問題から飛ぶ補足のリンク**としてだけ残す（肢のリンクは今までどおり）。
     チャンネルを選ぶボタンと「他のチャンネル」の畳みは、選ぶ相手がいないので外した。 */
  h+='<div class="m3-heat">';
  bigsOrdered().forEach(function(b){
    var vids=(BIGVIDS[b]||[]),bp=bigProg(b),open=!!S.openBig[b];
    var mainN=vids.filter(function(v){return VSRC[v]===VIDSRC}).length;
    h+='<div class="bigrow" data-m6k="big:'+esc(b)+'"><button class="t" data-act="big" data-b="'+esc(b)+'">'
      +'<span>'+esc(b)+'</span>'
      +'<span class="cnt">動画 '+mainN+' ／ '+n3(bp.n)+'問</span>'
      +'<span class="ar">'+(open?IC.up:IC.down)+'</span></button>'
      +'<div class="bar3"><i data-m6v="'+(bp.pct/100).toFixed(4)+'" data-m6vk="big:'+esc(b)+'"></i></div></div>';
    if(!open)return;
    var main=[];
    /* あこ課長の動画だけを並べる（2026-08-17 本人指示）。他のチャンネルは一覧に出さない。 */
    vids.forEach(function(v){
      if(SRCHIDE[VSRC[v]])return;
      if(VSRC[v]===VIDSRC)main.push(v);
    });
    h+=nextCardHtml(main);          /* 次にやる1本＝主役のカード（全部完了なら出さない） */
    h+=cumRowHtml(b);               /* ここまでで解ける N問（累積で解く入口） */
    h+='<div class="vlist">'+vlistHtml(b,main)+'</div>';
  });
  h+='</div>';
  /* 章がない小分類（その他の法令など）と、章が付かなかった問題の件数は黙って消さずに出す */
  h+='<div class="panel"><div class="spread"><span class="mini">出題順</span></div>'
    +SORTS.map(function(s){return '<button class="tog'+(S.sort===s[0]?' on':'')+'" style="margin:0 6px 6px 0" data-act="sort" data-s="'+s[0]+'">'+s[1]+'</button>'}).join('');
  /* 下の「基準のチャンネル」は廃止（2026-08-15 本人指摘「意味ない」）。
     一覧はあこ課長で固定（2026-08-17）＝選ぶ相手がいないので絞り込みも置かない。 */
  if(S.baseVid){
    h+='<div class="li"><div class="nm"><div class="mini">基準の動画</div>'+esc(VTIT[S.baseVid]||S.baseVid)+'</div>'
      +'<button class="btn sm" data-act="basesrc" data-v="'+esc(baseSrc())+'">解除</button></div>';
  }
  /* 章が付かなかった問題と、通し番号が決まらなかった問題の件数（黙って消さない）。
     通し番号なしは「新規」には入れないが、復習・抜き打ち・絞り込みからは解ける。 */
  h+='<div class="mini">章なし '+n3(NOVID.length)
    +(NEEDOK?'　／　通し番号なし '+n3(ITEMS.filter(function(it){return needSeq(it)===null}).length)
      +'（新規に入れない）':'')+'</div>'
    +'</div>';
  h+='<button class="btn" data-act="startAll">全 '+n3(ITEMS.length)+'問から出題する</button>';
  return h;
}
/* 一覧の1行（動画1本）。進捗＝その動画に対応する問題のうち正解済みの割合。
   ・未着手＝「54問」だけ（「0/」は出さない）／着手中＝「31/83」／完了＝数字を出さずチェックだけ。
   ・実測時間は値があるときだけ出す（0のときは列ごと出さない＝「—」を並べない）。
   ・薄緑の塗りは進行中の行だけ（完了行は塗らない）。
   ・番号なしの補足動画は字下げして本編にぶら下げる。 */
function vrowHtml(vid){
  var vs=videoStat(vid),ms=vidMs(vid);
  var pc=vs.n?Math.round(vs.ok/vs.n*100):0;
  var no=vno(vid),cat=catOfVid(vid),sub=(no===null);
  /* どの状態でも「正解/全」を出す（2026-08-17 本人指示）。
     以前は未着手を「41問」、完了を数字なしの✓だけにしていたので、
     **何問あって何問できたか**が読めなかった。未着手は 0/41、完了は 41/41 ✓。 */
  var q=vs.n===0?'':(vs.ok+'/'+vs.n);
  /* 長押しの先読み＝行では省略される見出しの全文と尺・章数（長押しのたびに探索しない） */
  var pv=(no===null?'':'#'+no+'　')+(VLEN[vid]?mmss(VLEN[vid])+'　':'')+(VCHN[vid]?'章'+VCHN[vid]:'');
  return '<button class="vrow'+(sub?' sub':'')+(vs.done?' done':'')+'" data-act="vid" data-v="'+esc(vid)+'"'
    +' data-m6k="vid:'+esc(vid)+'" data-m6pv="'+esc(pv+'|'+(VTIT[vid]||vlab(vid)||vid))+'"'
    +(cat?' data-cat="'+esc(cat)+'"':'')+'>'
    +(pc>0&&pc<100?'<span class="fill" data-m6v="'+(pc/100).toFixed(4)+'" data-m6vk="vid:'+esc(vid)+'"></span>':'')
    +'<span class="rc">'
    +(sub?'':'<span class="no">'+(no===null?'':'#'+no)+'</span>')
    +'<span class="nm">'+esc(vlab(vid)||vid)+'</span>'
    +(ms?'<span class="n2">'+mmss(ms/1000)+'</span>':'')
    +(q?'<span class="n2">'+q+'</span>':'')
    +(vs.done?'<span class="ck">'+IC.check+'</span>':'<span class="ar">'+IC.chev+'</span>')
    +'</span></button>';
}
/* 次にやる1本＝その大分類で、通し番号が最小の「まだ完了していない」動画。
   完了＝videoStat().done（その動画で解ける問題を全部正解した状態）。
   対応する問題が0問の動画は完了になりようがないので飛ばす（ここで止まると先へ進めない）。
   byRest=true のときは完了を「未着手が0」で見る。ホームの「今日の流れ」はこちら＝
   こざりえは1本1,524問なので全問正解には事実上到達せず、同じ動画を出し続けていた
   （2026-08-15 批評。リザルト側は先に「一周した」に直してある）。 */
function nextVidOf(vids,byRest){
  for(var i=0;i<vids.length;i++){
    var vs=videoStat(vids[i]);
    if(vs.n===0)continue;
    if(byRest?(restCount(videoItemsUp(vids[i]))>0):!vs.done)return vids[i];
  }
  return null;
}
function nextCardHtml(vids){
  /* ホームの「今日の流れ」と同じ基準で選ぶ（byRest＝未着手が0で次へ）。
     ここだけ「全問正解」にしていると、ホームと学習タブで次の1本が食い違う。 */
  var vid=nextVidOf(vids,true);
  if(!vid)return '';                       /* 全部完了＝カードを出さない */
  var vs=videoStat(vid),no=vno(vid),len=VLEN[vid]||0,cn=VCHN[vid]||0,me=[];
  if(len)me.push('<span>'+mmss(len)+'</span>');
  if(cn)me.push('<span>章'+cn+'</span>');
  me.push('<span>'+(vs.ok>0?vs.ok+'/'+vs.n:vs.n)+'問</span>');
  return '<div class="next"><span class="lb">次はここから</span>'
    +'<div class="ti">'+(no===null?'':'#'+no+' ')+esc(vlab(vid)||vid)+'</div>'
    +'<div class="me">'+me.join('')+'</div>'
    +'<div class="bt">'
    +'<a class="p" href="'+vurl(vid,0)+'" target="_blank" rel="noreferrer" '
    +'data-act="vwatch" data-k="'+esc(vid+'#0')+'">'+IC.yt+'動画を見る</a>'
    +'<button class="s" data-act="startVid" data-v="'+esc(vid)+'">問題を解く</button>'
    +'</div></div>';
}
/* 一覧の本編。完了が3本以上になったら1行に畳む（タップで開閉。2本以下は畳まない） */
function vlistHtml(big,vids){
  var done=[],rest=[],qn=0;
  vids.forEach(function(v){
    var vs=videoStat(v);
    if(vs.done){done.push(v);qn+=vs.n}else rest.push(v);
  });
  if(done.length<3)return vids.map(vrowHtml).join('');
  var open=!!S.openDone[big];
  /* 開いているときも同じ行を残す（そこを押せば畳み直せる＝開閉が対称になる） */
  return '<button class="vfold" data-act="vdone" data-b="'+esc(big)+'">'
    +'<span class="ck">'+IC.check+'</span>'
    +'<span>済み '+done.length+'本 ／ '+n3(qn)+'問</span>'
    +'<span class="ar">'+(open?IC.up:IC.down)+'</span></button>'
    +(open?vids:rest).map(vrowHtml).join('');
}
/* ここまでで解ける＝need_seq ≦ 視聴済み動画の最大の通し番号 かつ 未着手（ホームの「新規」と同じ
   数え方＝unseenItems() の定義をそのまま使う）。need_seq が null の問題は含めない。
   置き場所がその大分類のカードの下なので、対象もその大分類に絞る。 */
function cumItems(big){
  if(!NEEDOK)return [];
  var cap=watchedMaxSeq();
  if(cap===null)return [];                 /* 視聴0本＝出さない */
  return unseenItems(true).filter(function(it){
    if(big&&it.big!==big)return false;
    var n=needSeq(it);
    return n!==null&&n<=cap;
  });
}
function cumRowHtml(big){
  var n=cumItems(big).length;
  if(!n)return '';                         /* 0問＝出さない */
  return '<button class="cum" data-act="startCum" data-b="'+esc(big)+'">'
    +'<span>ここまでで解ける <b>'+n3(n)+'</b>問</span>'
    +'<span class="ar">'+IC.chev+'</span></button>';
}

function selCount(){
  if(!F.cats.length&&!F.topics.length)return 0;
  return ITEMS.filter(function(it){
    if(F.topics.length&&F.topics.indexOf(it.cat+'|:|'+(it.topic||'未分類'))>=0)return true;
    if(F.cats.length&&F.cats.indexOf(it.cat)>=0)return true;
    return false;
  }).length;
}
function selItems(){
  return ITEMS.filter(function(it){
    if(F.topics.length&&F.topics.indexOf(it.cat+'|:|'+(it.topic||'未分類'))>=0)return true;
    if(F.cats.length&&F.cats.indexOf(it.cat)>=0)return true;
    return false;
  });
}

/* ---------- 動画学習（動画→章→問題） ----------
   ・手でチェックを付けさせない。「動画を見る」を押した時点で視聴として記録する。
   ・問題が0問の章は出さない（畳んだ件数は1行で明示する）。
   ・動画のヘッダーに、その動画に対応する問題数と「この動画の問題を解く」を置く。
   ・章の行をタップすると、入っている問題の頭と紐づけの根拠（videos[].why）が出る。 */
/* 単元ページ（2026-08-17）。一覧の行を押すと遷移してくる。
   中身は今まで <details> の中に畳んでいたものと同じ＝新しい部品は作っていない。
   ・見出し＝単元名／大分類・毎年N問・正解/全
   ・「残り」「全」の2ボタン（一覧の行から外したもの）
   ・小見出しの一覧（名前が長いので折り返す。数字は出さない＝押した先のボタンと重なるため） */
function vUnit(c,s){
  var q=CATQ[c]||0,off=CATQ_OFF[c];
  var rest=restCount(itemsOfCat(c));
  var h='<div class="pad'+stag()+'">'
   +'<button class="btn sm" data-act="tab" data-v="fields" style="margin-bottom:10px">一覧へ戻る</button>'
   +'<div class="panel" id="m1hero"><div class="h" style="margin:0">'+esc(c)+'</div>'
   +'<div class="sub" style="margin:6px 0 0">'+esc(CINFO[c]?CINFO[c].big:'')
   +' ／ '+(off?esc(off):'毎年 '+q.toFixed(1)+'問')+' ／ '+s.okn+'/'+s.n+'問</div>'
   +'<div class="bar3" style="margin-top:10px"><i style="width:'
   +(s.n?(s.okn/s.n*100).toFixed(1):'0')+'%"></i></div>'
   +'<div style="display:flex;gap:8px;margin-top:12px">'
   +twoBtns('startCat',' data-c="'+esc(c)+'"',rest,s.n,'','flex:1;width:auto;margin:0')
   +'</div>'
   +'</div>';
  /* 単元の中の小見出しは出さない（2026-08-17 本人裁定）。
     「別に小分類で区切る必要ないか。単元では残りの問題やるだけだしね。
       大体順番に出てくればいいし、出てきた問題でわからないところは動画に飛べるしね」。
     ＝区切りの名前を作り直す作業（あこ課長の章で割り直す案）ごと不要になった。
     代わりに**出題の並び**をあこ課長の習う順にする（sortQ）＝順番に出てくればよい、を満たす。 */
  return h+'</div>';
}
function vStudy(){
  var c=S.cat,s=catStat(c);
  if(S.ucat)return vUnit(c,s);          /* 単元ページ（2026-08-17） */
  /* 一覧から動画の行を押したときはその1本だけを出す
     （軸が「大分類 → 動画を再生リスト順」なので、小分類の全動画を並べない） */
  var vids=(CHAP[c]||[]);
  if(S.studyVid)vids=vids.filter(function(v){return v.vid===S.studyVid});
  if(!vids.length&&S.studyVid){              /* 別の小分類にしか載っていない動画のときの保険 */
    Object.keys(CHAP).forEach(function(k){
      (CHAP[k]||[]).forEach(function(v){if(v.vid===S.studyVid&&!vids.length)vids=[v]});
    });
  }
  var shown=0,seen=0;                       /* 表示した章／そのうち視聴済み */
  var vv0=S.studyVid?videoStat(S.studyVid):null;
  var h='<div class="pad'+stag()+'">'
   +'<button class="btn sm" data-act="tab" data-v="fields" style="margin-bottom:10px">一覧へ戻る</button>'
   /* M1：一覧の行から育ってくる着地点（hero） */
   +'<div class="panel" id="m1hero"><div class="h" style="margin:0">'
   +esc(S.studyVid?(vlab(S.studyVid)||c):c)+'</div>'
   +'<div class="sub" style="margin:6px 0 0">'
   +(S.studyVid
     ?(esc(CINFO[c].big)+' ／ '+esc(c)+' ／ '+vv0.ok+'/'+vv0.n+'問'
       +(vidMs(S.studyVid)?' ／ '+mmss(vidMs(S.studyVid)/1000):''))
     :(esc(CINFO[c].big)+' ／ '+s.n+'問 ／ 出題済 '+s.att+'問'
       +(s.rate===null?'':' ／ 正解率 '+pct(s.rate))
       +(closed(c)?' ／ <b style="color:var(--chipfg)">閉じた</b>':'')))
   +'</div></div>';
  /* この動画の記録をリセット（2026-08-18 本人指示）。
     図と動画リンクを付け直した動画は、正解率や卒業が**誤った材料の上**で付いている。
     まだ解いたことがない状態に戻して、直した材料で解き直せるようにする。
     消すのは肢の解答記録と動画の進捗だけ＝日別の実績・学習時間・通算は消さない
     （過去に勉強した事実を消すと記録として嘘になる）。 */
  if(S.studyVid&&vv0&&vv0.n)
    h+='<div class="rowx" style="gap:8px;margin:-4px 0 12px">'
      +'<button class="btn sm" style="width:auto" data-act="vreset" data-v="'+esc(S.studyVid)+'">'
      +'記録をリセット（'+vv0.n+'問）</button>'
      +'<span class="mini" style="flex:1;line-height:1.6">まだ解いたことがない状態に戻します。'
      +'解いた日数・学習時間は残ります。</span></div>';

  if(!vids.length){
    h+='<div class="panel"><div class="mini">'+IC.warn+' この小分類の動画データがありません（chapters.js 未整備）。</div></div>';
  }
  vids.forEach(function(v){
    /* 同じ秒に章が2つある動画が1本ある（章名が入れ子で重複）。同じ問題を2行に出さないよう
       秒で重複を畳む（先に出てくる章名を使う）。 */
    var sseen={},list=(v.chapters||[]).filter(function(x){
      if(x.skip)return false;
      if(sseen[x.sec])return false;
      sseen[x.sec]=1;return true;
    });
    /* この動画に対応する問題数＝その動画までの知識で解けるものだけ（後の動画の知識が必要な
       問題は混ぜない＝2026-08-14 本人指摘「動画に沿って欲しい」）。混ぜなかった件数は下に出す。 */
    var vall=videoItems(v.vid).length,vn=videoItemsUp(v.vid).length,vlater=vall-vn;
    var wkey=v.vid+'#0',wv=ST.watched[wkey];
    h+='<div class="panel"><div class="rowx" style="align-items:flex-start;margin-bottom:8px">'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:600;line-height:1.5">'+esc(v.title)+'</div>'
      +'<div class="mini num">'+mmss(v.len)+(v.source?'　'+esc(v.source):'')
      +(v.member?' ／ <span style="color:var(--ngdeep)">メンバー限定・視聴期限あり</span>':'')+'</div></div>'
      +(v.member?'<span class="chip">'+IC.lock+'限定</span>':'')+'</div>'
      +'<div class="spread" style="margin-bottom:8px"><span class="chip">この動画に対応 '+vn+'問</span>'
      +(wv?'<span class="mini num">視聴 '+esc(String(wv).slice(5))+'</span>':'')+'</div>'
      +(vlater?'<div class="mini" style="margin-bottom:8px">後の動画の知識が必要な '+n3(vlater)+'問は入れていません</div>':'')
      +'<a class="btn" href="'+vurl(v.vid,0)+'" target="_blank" rel="noreferrer" data-act="vwatch" data-k="'+esc(wkey)+'">'
      +IC.yt+'動画を見る</a>'
      +(vn?twoBtns('startVid',' data-v="'+esc(v.vid)+'"',restCount(videoItemsUp(v.vid)),vn,'','margin-top:8px')
          :'<button class="btn" style="margin-top:8px" disabled>この動画の問題を解く（0問）</button>')
      /* その動画の「間違えた問題」（2026-08-18 本人指示）。ホームは全部・大分類ごとはあったが
         動画・章ごとが無く、動画を3本またいで溜まると狙って直せなかった。
         数え方はホームと同じ wrongPool（間違えて、まだ連続正解が0の肢）。 */
      +(function(){var wv2=wrongInVid(v.vid).length;
        return wv2?'<button class="btn" style="margin-top:8px" data-act="startWrongVid" data-v="'
          +esc(v.vid)+'">間違えた '+n3(wv2)+'問</button>':''})();
    var empty=0;
    list.forEach(function(ch){
      var its=chapItemsUp(v.vid,ch.sec),n=its.length;
      /* 0問の章は畳む（2026-08-17 本人指示）。あこ課長の章1,077のうち588（55%）が0問で、
         一覧の半分が中身のない行になっていた。
         2026-08-15 の「省いてない？」とは矛盾しない＝あのときは**問題があるはずの章が
         抜けていた**という指摘で、今回は**問題が0問なのに出ている**という話（本人の説明）。
         開いたときは**その場（タイムスタンプの順）に戻す**＝末尾にまとめて並べない
         （本人「たたんだ場合順番に配置されるようにもしてね。順番が前後するのは避けて」）。
         この loop は章の秒の昇順なので、飛ばすのをやめるだけで順番は保たれる。 */
      /* 「視聴 ◯/◯」の分母は問題のある章だけで数える（0問を入れると分母が膨らむ）。 */
      if(!n){empty++}else{shown++}
      if(!n&&!S.openZero[v.vid])return;
      var key=v.vid+'#'+ch.sec,w=ST.watched[key];
      if(w&&n)seen++;
      var ck=v.vid+'|'+ch.sec,op=!!S.openChap[ck];
      /* まだ解いていない数を出す。「37/54」だと残りが何問か分からない（2026-08-15 本人指摘） */
      var rest=chapItemsUp(v.vid,ch.sec).filter(function(it){return att(R(it.id))===0}).length;
      /* 章の開閉は <details>＝JSで開閉しない（開くたびに render() を呼ばない）。
         入場は ::details-content ＋ @starting-style（iOS 18.4+／26.4+ で2回目以降も出る）。
         高さは動かさず、中身のフェード＋4pxだけ（高さを動かすと layout が起きる）。 */
      /* chrow＝章名を1段目に丸ごと置き、バッジ・動画・ボタン・開閉記号を2段目にまわす。
         2026-08-15 検証：「残り N問」「全 N問」の2つが並ぶと章名の列が 84px まで痩せ、
         「宅建業/の事務/所」と縦に折れていた。章名を「…」で切ると何の章か分からなくなるので、
         名前を優先して段を分ける（ボタンが1つの行も同じ形にして、行ごとに姿が変わらないようにする）。 */
      /* 行の名前は**動画の章名（タイムスタンプの題名）そのまま**（2026-08-17 本人指示で差し戻し）。
         2026-08-16 に判定の論点名を優先する形（chapRowLab）にしたが、動画学習を
         あこ課長だけにした今は 章＝タイムスタンプそのものなので、章名を差し置く理由がない。
         実測：問題がある章489のうち441（90%）で行の名前が章名と食い違っていた
         （章名『詐欺』→行『詐欺による取消しは善意無過失の第三者に対抗できな…』）。
         論点名は「何を問い答えがどちらか」を書いた文なので、**章の一覧に出すと答えが読める**
         （出題画面では隠す対応を入れたのに、ここが残っていた）。 */
      var rlab=ch.label;
      h+='<details class="m6-det chrow" data-k="'+esc(ck)+'"'+(op?' open':'')+'>'
        +'<summary data-act="openchap" data-k="'+esc(ck)+'">'
        +'<span class="nm">'+esc(rlab)+' <span class="sec">'+mmss(ch.sec)+'</span>'
        +(w?' <span class="mini num">視聴 '+esc(String(w).slice(5))+'</span>':'')
        +(rlab===ch.label?'':'<span class="chsrc">動画の章　'+esc(ch.label)+'</span>')+'</span>'
        +'<span class="badge">'+(rest>0&&rest<n?('残り '+rest):(n+'問'))+'</span>'
        +'<a class="btn sm" href="'+vurl(v.vid,ch.sec)+'" target="_blank" rel="noreferrer" data-act="vwatch" data-k="'+esc(key)+'">'+IC.yt+'</a>'
        +(n?'<span class="chbt">'+twoBtns('startChap',' data-v="'+esc(v.vid)+'" data-s="'+ch.sec+'" data-l="'+esc(rlab)+'"',rest,n,'sm','')
            +(function(){var wc2=wrongInChap(v.vid,ch.sec).length;
              return wc2?'<button class="btn sm" data-act="startWrongChap" data-v="'+esc(v.vid)
                +'" data-s="'+ch.sec+'" data-l="'+esc(rlab)+'">間違い '+n3(wc2)+'</button>':''})()
            +'</span>':'')
        +'<span class="m6-mk">'+IC.chev+'</span></summary>';
      /* 紐づけの根拠を見せる（本人の指摘「どういう基準でその問題を選んでいるか分からない」） */
      h+='<div class="m6-dtxt">';
      its.slice(0,12).forEach(function(it){
        var wy=whyOf(it,v.vid);
        h+='<div class="mini" style="margin-bottom:4px">・'+esc(String(it.stem||'').slice(0,20))+'…'
          +(wy.length?'　<span class="chip" style="font-size:11px">根拠 '+esc(wy.join('・'))+'</span>':'')+'</div>';
      });
      if(its.length>12)h+='<div class="mini">ほか '+(its.length-12)+'問</div>';
      h+='</div></details>';
    });
    /* 0問の章の開閉。押すと**その場**（タイムスタンプの順）に差し戻る（末尾に集めない）。 */
    if(empty)h+='<button class="vrow zrow" data-act="zerochap" data-v="'+esc(v.vid)+'">'
      +'<span class="rc"><span class="nm">問題のない章 '+empty+'件</span>'
      +'<span class="ar">'+(S.openZero[v.vid]?IC.up:IC.down)+'</span></span></button>';
    /* 動画には問題が紐づいているのに章が1つも出ない＝データの秒がずれている合図（黙って畳まない） */
    if(vn&&empty===list.length&&list.length)
      h+='<div class="warn" style="margin-top:8px">'+IC.warn+' この動画は '+vn+'問 紐づいていますが、'
        +'章の秒数が問題データと一致しないため章ごとに分けられません（データ側の確認が必要）。</div>';
    h+='</div>';
  });
  /* 学習の単位は動画1本なので、動画1本を開いているときは小分類まとめのボタンを出さない */
  if(!S.studyVid)
    h+='<div class="panel"><div class="mini" style="margin-bottom:8px">視聴 '+seen+'/'+shown+'</div>'
      +twoBtns('startCat',' data-c="'+esc(c)+'"',s.n-s.att,s.n,(shown&&seen===shown?'acc':'pri'),'')
      +'</div>';
  h+='</div>';
  return h;
}

/* ---------- 出題／解説 ---------- */
var STG={'新規':0,'学習中':1,'定着':2,'卒業':3};
/* 中断中のセッションがあるのに、出題の中身を持っていない状態＝3択を出す（勝手に始めない） */
function vResume(){
  var r=ST.run,at=Math.min((r.qi||0)+1,r.queue.length);
  var h='<div class="pad'+stag()+'"><div class="h">解きかけの問題があります</div>'
   +'<div class="sub" style="margin-bottom:10px">'+esc(r.label||'出題')
   +'　<span class="num">'+at+' / '+r.queue.length+'問</span>'
   +(r.lastAt?'　最後に解いたのは '+esc(r.lastAt.slice(0,16)):'')+'</div>';
  h+='<button class="btn acc" style="min-height:56px" data-act="runResume">'+IC.again
   +'途中から再開する（'+at+'問目 ／ 全'+r.queue.length+'問）</button>';
  h+='<button class="btn" style="min-height:56px;margin-top:8px" data-act="runRestart">'
   +'最初からやり直す（1問目から）</button>';
  h+='<button class="btn" style="min-height:56px;margin-top:8px;color:var(--ngdeep);border-color:#f0c9c4" data-act="runDrop">'
   +IC.close+'やめる（セッションを破棄）</button>';
  h+='</div>';
  return h;
}
function vQuiz(){
  var tot=S.queue.length;
  if(!tot&&hasRun())return vResume();
  if(!tot)return '<div class="pad'+stag()+'"><div class="panel"><div class="mini">出題できる問題がありません（卒業済み・除外・絞り込み0件）。</div>'
    +(S.lockedOut?'<div class="mini" id="qlock" style="margin-top:6px">未習 '+n3(S.lockedOut)
      +'問は出していません（設定の「未習の範囲も出す」で出せます）</div>':'')+'</div>'
    +'<button class="btn" data-act="tab" data-v="fields">動画学習へ</button></div>';
  if(S.qi>=tot){
    /* 完走＝リザルトを1回だけ重ねる（vDone の静的な終了画面は残す） */
    if(!S.doneShown){
      S.doneShown=true;
      setTimeout(function(){
        /* かかった時間は run.spent（解いていた時間の積み上げ）から出す。完走時は
           closeRunClock() が最後の1問ぶんを足して S.spent に確定させている
           （ST.run は dropRun で消えるので、そこから読むと 0:00 になる）。
           周回のときは startQueue の saveRun(true) で0に戻るので「その周」の時間になる。 */
        var _r=ST.run,_sp=S.spent||((_r&&_r.spent)||0);
        if(!S.spent&&_r&&_r.tick)_sp+=Math.min(180000,Math.max(0,Date.now()-_r.tick));
        if(!_sp&&S.t0)_sp=Date.now()-S.t0;
        var sec=Math.round(_sp/1000);
        var cs=CINFO[S.label]?catStat(S.label):null;
        /* 成績は「この1回（周回ならその周）」の集計を出す＝通算（ST.session）と混ぜない */
        var sT=S.sT||0,sR=S.sR||0,wn=S.wrongs.length;
        var vs=S.roundVid?videoStat(S.roundVid):null;
        var nc=nextChap(S.roundVid,S.roundSec);
        /* 「次の動画へ」は全問正解ではなく**一周した**（未着手が0）で出す。
           全問正解を条件にすると1,524問なので事実上出ない（2026-08-15 批評）。 */
        var vdone=!!(vs&&(vs.done||(S.roundVid&&restCount(videoItemsUp(S.roundVid))===0)));
        var nx=vdone?nextVid(S.roundVid):null;
        /* 単元・小見出しから入った回は、動画側の導線（次の章へ・次の動画へ）を出さない。
           基準の動画（catBaseVid）はこざりえの科目1本なので、そこへ飛ばすと別の単元へ移ってしまう。 */
        var nu=nextUnit();
        if(S.roundCat){nc=null;nx=null}
        var perfect=(wn===0&&sT>0&&sR===sT);
        setResultBtns(wn,nx,perfect,nc,nu);
        M5.showResult({
          right:sR,total:tot,
          rate:sT?(sR/sT*100):0,
          best:S.sBest||0,
          time:mmss(sec),per:sec/Math.max(1,sT||1),
          round:S.round||0,wrong:wn,perfect:perfect,
          catFrom:S.catFrom||0,
          catTo:cs?cs.prog:(S.catFrom||0),
          catLabel:(cs?esc(S.label)+'　達成度':'この範囲の達成度'),
          grad:Math.max(0,(cs?cs.grad:0)-(S.gradBefore||0))
        }).then(function(){
          /* 「この分野を閉じた」は回答時の最大演出とぶつけず、リザルトの後に単独で出す */
          if(S.closedCat){
            var cc=S.closedCat;S.closedCat=null;
            M5.showClosed(cc,itemsOfCat(cc).length);
          }
        });
      },0);
    }
    ghAuto('done');            /* 完走したら記録を上げる（失敗しても学習は止めない） */
    return vDone();
  }
  var id=S.queue[S.qi],it=BY[id],r=R(id);
  /* ヘッダーの成績は「このセッション（周回ならその周）」の数字。通算はホームと分析にある
     ので重複させない（2026-08-14 本人指摘「周回中に通算が出ていると今どこか分からない」）。 */
  var ses={total:S.sT||0,right:S.sR||0,streak:ST.session.streak||0};
  /* 入場アニメーション：新しい問題が出るときだけカードを動かす（回答時は動かさない）。
     解説は解説ブロックの中だけを段差で出す。 */
  var CA=(S.anim==='card'),EA=(S.anim==='exp');
  function ac(){return CA?' qin':''}
  function ad(i){return CA?' style="animation-delay:'+(i*50)+'ms"':''}
  var chs=chapsFor(it),why=whyOf(it,S.baseVid||null);
  if(!why.length)why=whyOf(it);
  var h='<div id="qhead">'+qHead(ses,S.qi/tot)+'</div>';
  h+='<div class="qwrap m3-persp" id="m1quizcard">';
  /* 引き算：章のチップ＋状態の点＋★だけ。根拠・出典は畳んでタップで開く */
  /* A2：花＋章名、右に何問目、その下に細い線を1本（2026-08-14 確定） */
  /* 論点名から作った長いラベルのときだけ段を分ける。
     出題中は論点名を出さない（答えが読めるため）ので、そのときは付けない。
     付けたままだと短い章名でも2段になり、小花だけ上に残って 1/90・星・∨ が下へ落ちる
     （2026-08-16 本人指摘の「上の方の変な線」の正体）。 */
  var qj=(chs[0]&&chs[0].jt&&!(S.view==='quiz'&&S.phase==='q'))?' j':'';
  h+='<div class="qhead m5-qr'+ac()+'"'+ad(0)+'><div class="qrow'+qj+'">'+flw(16)
    +'<span class="qname'+qj+'">'
    /* 出題中は**単元名だけ**（2026-08-18 本人指摘「上の方の論点で答えが推察できてしまう」）。
       論点名は既に隠していたが、隠すと小見出し・章名に落ちるので、そこも答えを示していた
       （例「公告せずに取戻し（例外）」）。答えた後は章名・論点名を出す。 */
    +esc((S.view==='quiz'&&S.phase==='q')?(it.cat||it.topic||'')
         :((chs[0]&&chs[0].label)||it.topic||it.cat))+'</span>'
    +(S.sneak[id]?'<span class="chip">抜き打ち</span>':'')
    +'<span class="sdot s'+STG[stateOf(id)]+' m4-badge" id="stBadge" data-stage="'+STG[stateOf(id)]
    +'" title="'+stateOf(id)+'" aria-label="'+stateOf(id)+'"></span>'
    +'<span class="qcnt"><span class="m6-roll" style="--rh:16px;font-size:12px"'
    +' data-m6id="qprog" data-fmt="'+new Array(String(tot).length+1).join('_')+'" data-m6r="'+(S.qi+1)+'"></span>'
    /* 「/ 2」も桁ロールと同じ 16px の箱に入れる。素のテキストのままだと、行の高さを
       まわりから受け継ぐので左右で行箱の高さが変わり、上下がずれる（2026-08-16 本人指摘・3度目）。 */
    +'<span class="qtot"> / '+n3(tot)+'</span></span>'
    +'<button class="star'+(r&&r.star?' on':'')+'" data-act="star" data-id="'+esc(id)+'">'+IC.star+'</button>'
    +'<button class="btn sm" style="min-height:28px;padding:0 8px" data-act="togsrc" aria-label="出典と根拠">'
    +IC.down+'</button></div><div class="qrule"></div></div>';
  /* 出典・根拠・他の章はシートで開く（その場で開かない＝問題文の座標が動かない＝SPEC §5-1／§5-2） */
  h+='<div class="lead m5-qr'+ac()+'"'+ad(1)+'>'+esc(it.lead)+'</div>';
  /* 肢＝主役（m3-hero）。光は主役の子要素にして中心を必ず一致させる。
     文字は span に入れて光より前に出す（.m3-hero>*:not(.m3-glow) が z-index:1） */
  h+='<div class="stem m3-hero m5-qr'+ac()+'" id="qstem"'+ad(2)+'>'
    +'<span class="m3-glow" aria-hidden="true"></span>'
    +'<span class="stemtx">'+esc(it.stem)+'</span></div>';
  /* 難易度＝3段階の点（易●○○／普●●○／難●●●）。文字は出さない。未評価は「—」 */
  h+='<div class="meta m5-qr'+ac()+'"'+ad(3)+'>'+dotsHtml(it)+'</div>';
  /* 同じ問題が複数の動画に現れるので、紐づいた動画すべての章リンクを出す。
     1行に収める（章名は長いので省略記号／時刻は折り返さない） */
  /* 既定は主教材の1本だけ（主役を1つに）。他の動画は「＋N」で開く。 */
  /* **出題中は動画のリンクを出さない**（2026-08-20 本人報告
       「広告不要の例外って動画リンクに書いてあったから答えがわかってしまった」）。
     見出しの章名は単元名に隠していたが、その下のリンクのラベルが章名のままで、
     そこに答えが書いてあった（例「公告せずに取戻し（例外）」）。
     答えた後（S.phase!==q）に出す＝学習の導線は失わない。 */
  var showLinks=(S.view==='quiz'&&S.phase==='q')?[]:chs.slice(0,1);
  showLinks.forEach(function(ch){
    h+='<a class="link'+ac()+'" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
      +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'"'+ad(4)+'>'+IC.yt
      +'<span class="lbl'+(ch.jt?' w':'')+'">'+esc(ch.label)+'</span>'
      +'<span class="tm num">'+mmss(ch.sec)+'</span>'+IC.chev+'</a>';
  });
  if(chs.length>1&&!(S.view==='quiz'&&S.phase==='q'))
    h+='<button class="btn sm" style="min-height:26px;padding:0 8px;align-self:flex-start" data-act="togsrc">＋'
      +(chs.length-1)+'</button>';
  /* 何問目はヘッダー（A2の行）へ移した。ここには置かない＝引き算の原則 */
  /* 未習で出さなかった件数は黙って消さずに小さく出す（設定「未習の範囲も出す」で外せる） */
  if(S.lockedOut)h+='<div class="mini'+ac()+'"'+ad(4)+' id="qlock">未習 '+n3(S.lockedOut)+'問は出していません</div>';

  if(S.phase==='q'){
    /* ○×とパスは1つの入れ物に入れ、0.2秒遅れて下から出す（誤タップ防止）。
       回答時はこの入れ物だけを外して解説を差し込む＝問題文のDOMに触らない。
       ○×はボタンのタップだけ（スワイプと案内文は廃止＝2026-08-14 本人指摘）。 */
    h+='<div class="qctl m5-qr'+(CA?' qin':'')+'"'+(CA?' style="animation-delay:200ms"':'')+'>'
      +'<div class="ans"><button class="b" data-act="ans" data-o="1">○</button>'
      +'<button class="b x" data-act="ans" data-o="0">×</button></div>'
      /* パスの右に「おかしいところ」。行は増やさない（2026-08-17 本人指定）。
         パスは中央のまま、報告はその右に小さく置く＝左右の重さを揃える。 */
      /* パスは廃止（2026-08-18 本人指定「報告＝送信がパスになるので要らない」）。
         報告も出題中には出さない＝答えた後に、解説を見てから出す。 */
      +'</div>';
  }else{
    h+='<div class="expwrap'+(EA?' stagexp':'')+'">'+expBlock(it,id)+'</div>';
  }
  /* 末尾の余白。解説の間は下に「次の問題」が固定で乗るので、その高さぶん多く空ける
     （一番下までスクロールしたときに解説の末尾が固定ボタンに隠れないように） */
  h+='<div class="qsp" style="height:'+(S.phase==='exp'?76:20)+'px"></div></div>';
  return h;
}
/* 解説の間だけ、画面の下に固定した「次の問題」を出す。
   完走の演出（M5）は z-index 45 で上に乗るので、そのときは queue の終わりで自動的に消える。 */
function syncNextBar(){
  var b=document.getElementById('nextbar');
  if(!b)return;
  b.hidden=!(S.view==='quiz'&&S.phase==='exp'&&S.queue.length&&S.qi<S.queue.length);
}
/* 回答したら、正誤の行が画面の上（固定ヘッダーのすぐ下）に来るまでスクロールする。
   これが無いと、長い問題では○×を押しても解説の頭が画面の外にあって読めない。
   演出（stagexp・m2-press）と喧嘩しないよう瞬間移動（behavior:auto）にする。 */
function scrollToAnsline(){
  var el=document.querySelector('.ansline');
  if(!el)return;
  var hd=document.querySelector('.hd'),off=hd?hd.getBoundingClientRect().height:0;
  var y=window.scrollY+el.getBoundingClientRect().top-off-10;
  var max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
  window.scrollTo(0,Math.min(Math.max(0,y),max));
}
/* 難易度＝3段階の点（易=1／普=2／難=3）。色は使わず塗り／抜きで示す。
   diff_ai が null（未評価）は点を出さず「—」＝数字・記号の表記を他の未測定と揃える。 */
function dotsHtml(it){
  var g=d3(it);
  if(!g)return '<span class="dots mini num" title="難易度 —" aria-label="難易度 未評価">—</span>';
  var n=D3.indexOf(g)+1,s='';
  for(var i=0;i<3;i++)s+='<i'+(i<n?' class="on"':'')+'></i>';
  return '<span class="dots" title="難易度 '+esc(g)+'" aria-label="難易度 '+esc(g)+'">'+s+'</span>';
}
/* 回答時：問題カードのDOMを作り直さずに、解説だけを差し込む。
   （作り直すと入場アニメーションの途中で座標が飛ぶため。指摘「問題文を動かさない」の構造的な対策） */
function applyExpDom(it,id){
  var w=document.querySelector('.qwrap');
  if(!w||w.querySelector('.expwrap'))return false;
  var ctl=w.querySelector('.qctl');
  if(!ctl)return false;
  /* ヘッダーはDOMを作り直さず、値だけカウントアップさせる（M4）。
     出どころはこのセッションの集計（S.sT/S.sR）＝通算とは混ぜない。 */
  m4UpdateHead({total:S.sT||0,right:S.sR||0});
  var cw=document.querySelector('.hd .combow');
  if(cw){
    var sk=ST.session.streak||0,ch='';
    if(sk>=2)ch=comboHtml(sk);
    else if(S.broke){ch='<span class="combo broke">'+FXST.lost+'連続 → 0</span>';S.broke=false}
    cw.innerHTML=ch;
    m6Rolls(cw);      /* 差分更新の経路でも桁を回す（ここは render() を通らない） */
  }
  var lab=w.querySelector('.qlabel');if(lab)lab.textContent='解説';
  /* 状態は色の点1つ。色をなめらかに差し替える（文字は出さない） */
  var bd=document.getElementById('stBadge'),ns=stateOf(id);
  if(bd&&bd.getAttribute('title')!==ns){
    bd.className='sdot s'+STG[ns]+' m4-badge';
    bd.setAttribute('title',ns);bd.setAttribute('aria-label',ns);bd.setAttribute('data-stage',STG[ns]);
  }
  ctl.parentNode.removeChild(ctl);
  var ew=document.createElement('div');
  ew.className='expwrap stagexp';
  ew.innerHTML=expBlock(it,id);
  var sp=w.querySelector('.qsp');
  if(sp){w.insertBefore(ew,sp);sp.style.height='76px';}   /* 固定した「次の問題」のぶん末尾を空ける */
  else w.appendChild(ew);
  m4BoxPlay(id);
  return true;
}
/* 復習の箱＝6段の目盛りを、回答前の箱から今の箱へ動かす */
function m4BoxPlay(id){
  var r=R(id);if(!r)return;
  var segs=document.getElementById('bxSegs'),ind=document.getElementById('bxInd');
  if(!segs||!ind)return;
  m4AdvanceBox(segs,ind,Math.max(0,(r._pre||0)),Math.max(0,r.box||0));
}
/* 休ませる段（1→3→7→14日）を目盛りで示す。文字は日数だけ（引き算の原則） */
function boxMeterHtml(r){
  var pre=Math.min(4,Math.max(0,(r&&r._pre)||0)),s='';
  for(var i=0;i<4;i++)s+='<div class="m4-seg'+(i<=pre-1?' on':'')+'"><i></i></div>';
  return '<div class="m4-box"><div class="m4-ind" id="bxInd" style="left:'+((Math.max(1,pre)-0.5)/4*100).toFixed(2)+'%"></div>'
    +'<div class="m4-segs" id="bxSegs">'+s+'</div>'
    +'<div class="m4-boxlab"><span>1</span><span>3</span><span>7</span><span>14</span></div></div>';
}
function qHead(ses,p){
  var tot=ses.total||0,ri=ses.right||0,sk=ses.streak||0;
  /* 連続正解は常時ヘッダーに（2連続以上で表示・5連続以上は金色）。
     枠の高さは固定なので、表示が増えても下のカードは1pxも動かない。 */
  var cw='';
  if(sk>=2)cw=comboHtml(sk);
  else if(S.broke){cw='<span class="combo broke">'+FXST.lost+'連続 → 0</span>';S.broke=false}
  /* 数字は span で切り出し、min-width を最大桁で予約する（M4：桁が揺れない）。
     成績はDOMを作り直さず m4UpdateHead で値だけ動かす。 */
  var rate=tot?(ri/tot*100):0;
  PROGNEW=p;
  M4PREV={total:tot,right:ri,rate:rate,prog:M4PREV.prog};
  /* 未解答のときは「0.0%」ではなく「—」（ホーム・分析の表記と揃える） */
  /* 数字は等幅。桁が増えても右の「正解率」がずれないよう、入れ物の幅を最大桁で予約する
     （個々の数字に min-width を持たせると「0/ 0問」のように隙間が開くため入れ物側で持つ） */
  /* 前の問題へ＝**正解率の行の左端**（2026-08-17 本人指定）。出題中で2問目以降だけ出す。 */
  var pv=(S.view==='quiz'&&S.qi>0)
    ?'<button class="hprev" data-act="prevq" aria-label="前の問題へ">'+IC.chevL+'</button>':'';
  /* 解説中の「おかしいところ」＝この行の右端（2026-08-18 本人指摘。
     下の「次の問題」の横に30pxのアイコンで置いたら、隅に潰れて見えなくなった）。
     出題中はパスの横に出しているので、ここには出さない＝二重にしない。 */
  return '<div class="hd">'+pv+'<div class="sc"><b class="scn">'
    +'<span class="m4-num" id="hRight">'+ri+'</span>/'
    +'<span class="m4-num" id="hTotal">'+tot+'</span>問</b>　正解率 <b class="scr">'
    +'<span class="m4-num" id="hRate">'+(tot?rate.toFixed(1)+'%':'—')+'</span></b></div>'
    +'<div class="combow">'+cw+'</div>'
    +'<button class="rst" data-act="rsess">リセット</button>'
    /* 進捗バーはヘッダーの中（下辺）に置く。外に出して position:sticky; top:50px で
       浮かせていたが、50px はヘッダーの実際の高さと合っておらず、
       開始の演出で親に transform が掛かると貼り付き先を失って本文の途中に落ちる
       （2026-08-16 本人指摘「ここも線が変」）。中に入れれば常に下辺に付く。 */
    +'<div class="bar"><i id="hBar" style="transform:scaleX('+PROGPREV.toFixed(4)+')"></i>'
    +'<span class="m4-tip" id="hTip" style="left:'+(PROGPREV*100).toFixed(1)+'%"></span></div>'
    +'</div>';
}
var PROGPREV=0,PROGNEW=0;
/* 殻が版を確認し終えたら、ホームの版の行を描き直す（押さなくても分かるように） */
window.addEventListener('takken-data',function(){if(S.view==='home')render()});
/* 連続正解の数字＝入れ替わる整数なので桁ロール（qHead と applyExpDom の2か所で同じものを使う） */
function comboHtml(sk){
  return '<span class="combo'+(sk>=5?' hot':'')+'"><span class="m6-roll"'
    +' style="--rh:16px;font-size:11px;font-weight:600" data-m6id="streak" data-fmt="'
    +new Array(Math.max(2,String(sk).length)+1).join('_')+'" data-m6r="'+sk+'"></span>連続正解</span>';
}
function expBlock(it,id){
  var res=S.res||{},r=mk(id);
  /* 出すのは正解の1行だけ。当たり外れは演出で伝える。 */
  var h='<div class="ansline">正解：<em>'+(it.ox?'○':'×')+'</em></div>';
  /* 文字は .exptx で包む＝枠（.exp の背景・罫線）は元の幅のまま、中の文字だけを
     全角の整数倍の幅にして左右の余白を揃えるため（CSSの「本文の左右の余白」の節を参照）。 */
  h+='<div class="exp"><div class="exptx">'
    +(it.exp?esc(it.exp):'<span class="mini">解説データがありません。</span>')+'</div></div>';
  /* 図表は枠内に収める。表組みで細かいものは横スクロールできる入れ物に入れる（縦横比は保つ） */
  (it.figs||[]).forEach(function(f){
    h+='<div class="figbox"><img class="fig" src="'+esc(figSrc(f))+'" alt="図表" onerror="this.parentNode.style.display=\'none\'"></div>';
  });
  if((it.refs||[]).length){
    h+='<div>'+it.refs.map(function(u){return '<a class="link" href="'+esc(u)+'" target="_blank" rel="noreferrer">参考 '+esc(u)+'</a>'}).join('')+'</div>';
  }
  if(!res.ok){
    h+='<div class="hr"></div><div class="mini" style="margin-bottom:6px">なぜ間違えた？</div><div class="whys">'
      +WHYS.map(function(w){return '<button class="tog'+(r._why===w?' on':'')+'" data-act="why" data-w="'+w+'" data-id="'+esc(id)+'">'+w+'</button>'}).join('')
      +'</div>';
    if(r._why){
      h+='<div class="mini" style="margin-top:6px">次は '+restDays(r)+'日後</div>';
      var ch=chapFor(it);
      if(r._why==='知らなかった'&&ch)h+='<a class="btn" style="margin-top:8px" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.yt+'この章の動画を '+mmss(ch.sec)+' から見る</a>';
    }
  }
  /* 抜き打ちで間違えたら「この分野は怪しい」＋その章のタイムスタンプへ（自分で見に行く導線） */
  if(!res.ok&&S.sneak[id]){
    var ch2=chapFor(it);
    h+='<div class="warn" style="margin-top:10px">'+IC.warn+' この分野は怪しい'
      +(ch2?'<a class="link" style="margin-top:6px;color:#a33a2f" href="'+vurl(ch2.vid,ch2.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch2.vid+'#'+ch2.sec)+'"><span class="lbl'+(ch2.jt?' w':'')+'">'+esc(ch2.label)+'</span>'
        +'<span class="tm num">'+mmss(ch2.sec)+' から見る</span>'+IC.chev+'</a>':'')+'</div>';
  }
  /* データの間違いを、その場で1タップ報告する（2026-08-17 本人の設計）。
     いままで誤りを見つけるのは本人がチャットで言うときだけで、**発見が最後**だった。
     ここに置けば学習を止めずに溜まり、あとでまとめて直せる。
     正誤に関係なく出す（図や動画のずれは正解した肢でも起きる）。 */
  /* 「おかしいところ」＝**解説の末尾**（休ませる段の直前）。最初に置いていた位置に戻した
     （2026-08-18 本人指摘「解説の時は前の位置にもどして」）。出題中はパスの横。 */
  h+=repInline(id);        /* シートを開かず、その場で押せる（2026-08-18 本人指定） */
  h+=boxMeterHtml(r);      /* 休ませる段が動く（M4：進む＝Ease Out／戻る＝Ease In） */
  var sv=severeTopics().filter(function(x){return x.cat===it.cat&&x.topic===(it.topic||'未分類')})[0];
  if(sv)h+='<div class="warn" style="margin-top:10px">'+IC.warn+' 重症：この章は動画に戻る（'+esc(sv.topic)+'／誤答'+sv.ng+'回）</div>';
  /* 「次の問題」はカードの中に置かない。画面の下に固定した #nextbar が唯一の置き場所
     （同じボタンを2つ見せない。2026-08-15 本人指示）。 */
  return h;
}
/* 完走リザルトのボタンの出し分け（2026-08-14 本人の指示）
   ・全問正解（perfect）＝「もう一度この範囲を解く」は出さない
   ・間違いが残っている＝「間違えた N問を解く」が最上段（主役）。0になるまで周回する
   ・0になったときだけ「次の動画へ」を主役にする（この動画を仕上げた合図）
   ・「ホームへ戻る」は置かない（下部タブがある） */
/* 完走画面で開く動画＝いま解いた範囲の代表。基準の動画があればそれ、無ければ
   最後に答えた肢の章（chapFor）。あこ課長のリンクを優先する。 */
function resultWatch(){
  if(S.roundVid)return {vid:S.roundVid,sec:S.roundSec||0,
    label:vlab(S.roundVid)||''};
  var ids=S.queue||[],it=null,i;
  for(i=ids.length-1;i>=0&&!it;i--)if(BY[ids[i]])it=BY[ids[i]];
  if(!it)return null;
  var vs=vidsOf(it),v=null;
  for(i=0;i<vs.length;i++)if(VSRC[vs[i].vid]===VIDSRC){v=vs[i];break}
  if(!v)v=vs[0];
  if(!v)return null;
  return {vid:v.vid,sec:(typeof v.sec==='number'?v.sec:0),
    label:v.chapter||vlab(v.vid)||''};
}
function setResultBtns(wn,nx,perfect,nc,nu){
  var rb=document.getElementById('r-round'),nb=document.getElementById('r-next'),
      ag=document.getElementById('r-again'),cb=document.getElementById('r-nextchap'),
      ub=document.getElementById('r-nextcat'),
      wb=document.getElementById('r-watch');
  /* いま解いた範囲の動画（あこ課長）を開くリンク。最後に答えた肢の章を使う。 */
  if(wb){
    var wv=resultWatch();
    wb.hidden=!wv;
    if(wv){wb.href=vurl(wv.vid,wv.sec);wb.setAttribute('data-k',wv.vid+'#'+wv.sec);
      wb.innerHTML=IC.yt+'動画を見る（'+esc(wv.label)+' '+mmss(wv.sec)+'）'}
  }
  if(rb){rb.hidden=!wn;if(wn)rb.textContent='間違えた '+n3(wn)+'問を解く'}
  /* 章を解き終えたら次の章へ。動画の続きを1回分ずつ進める導線（2026-08-15） */
  if(cb){cb.hidden=!nc;if(nc){cb.setAttribute('data-s',nc.sec);
    cb.textContent='次の章へ（'+chapRowLab(nc.vid||S.roundVid,nc.sec,nc.label)+'）';cb.className=wn?'pri':'acc'}}
  /* 単元・小見出しを解き終えたら単元側の次へ（動画側の nc・nx とは排他＝両方は出ない） */
  if(ub){
    ub.hidden=!nu;
    if(nu){
      ub.setAttribute('data-c',nu.cat);
      if(nu.i===null||nu.i===undefined)ub.removeAttribute('data-i');else ub.setAttribute('data-i',nu.i);
      ub.textContent=(nu.sub?'次の小見出しへ（':'次の単元へ（')+nu.label+'）';
      ub.className=wn?'pri':'acc';
    }
  }
  if(nb){nb.hidden=!nx;if(nx){nb.setAttribute('data-v',nx.vid);nb.className=(wn||nc)?'pri':'acc'}}
  /* パスで解き残しがあるときだけ「もう一度この範囲を解く」を残す
     （全問正解なら不要、間違いがあるなら上の「間違えた…」がその役目） */
  if(ag)ag.hidden=(wn>0||perfect);
}
function vDone(){
  var tot=S.queue.length,nw=S.wrongs.length,sT=S.sT||0,sR=S.sR||0;
  var vs=S.roundVid?videoStat(S.roundVid):null;
  var nc=nextChap(S.roundVid,S.roundSec);
  var vdone=!!(vs&&(vs.done||(S.roundVid&&restCount(videoItemsUp(S.roundVid))===0)));
  var nx=vdone?nextVid(S.roundVid):null;
  /* 静的な #r-btns と同じ出し分けにする（片方だけ直すと本人には見えない＝検査 Z1） */
  var nu=nextUnit();
  if(S.roundCat){nc=null;nx=null}
  var perfect=(nw===0&&sT>0&&sR===sT);
  /* 完走画面のヘッダーは「この1回（周回ならその周）」の成績。通算（ST.session）と混ぜない */
  /* 連続正解のチップだけは通算（ST.session.streak）＝アプリを通した連続数という1つの意味に揃える */
  var h=qHead({total:sT,right:sR,streak:ST.session.streak||0},1)+'<div class="pad"><div class="panel">';
  if(S.round)h+='<div class="mini">'+S.round+'周目</div>';
  /* ①その場の間違い直し＝全問正解になるまで当日中に周回する（最上段） */
  if(nw){
    h+='<div class="h">'+n3(nw)+'問 間違い</div>'
      +'<button class="btn pri" data-act="round">間違えた '+n3(nw)+'問を解く</button>';
  }else if(vs&&vs.done){
    h+='<div class="h" style="color:var(--chipfg)">この動画は完了</div>'
      +'<div class="mini">'+n3(vs.n)+'問すべて正解'+(vs.round?'（周回 '+vs.round+'）':'')+'</div>';
  }else{
    h+='<div class="h">'+(perfect?'全問正解':n3(tot)+'問 終了')+'</div>';
  }
  if(nc)h+='<button class="btn '+(nw?'':'acc')+'" style="margin-top:10px" data-act="nextchap" data-s="'+nc.sec+'">次の章へ（'
    +esc(chapRowLab(S.roundVid,nc.sec,nc.label))+'）</button>';
  if(nu)h+='<button class="btn '+(nw?'':'acc')+'" style="margin-top:10px" data-act="nextcat" data-c="'+esc(nu.cat)+'"'
    +(nu.sub?' data-i="'+nu.i+'"':'')+'>'+(nu.sub?'次の小見出しへ（':'次の単元へ（')+esc(nu.label)+'）</button>';
  if(nx)h+='<button class="btn '+((nw||nc)?'':'acc')+'" style="margin-top:10px" data-act="nextvid" data-v="'+esc(nx.vid)+'">次の動画へ</button>';
  /* 静的な #r-btns と同じものを出す（片方だけだと本人には見えない＝検査Z1） */
  var rw=resultWatch();
  if(rw)h+='<a class="btn" style="margin-top:10px" href="'+vurl(rw.vid,rw.sec)+'" target="_blank"'
    +' rel="noreferrer" data-act="vwatch" data-k="'+esc(rw.vid+'#'+rw.sec)+'">'
    +IC.yt+'動画を見る（'+esc(rw.label)+' '+mmss(rw.sec)+'）</a>';
  h+='<div class="hr"></div>';
  /* 全問正解なら「もう一度」は出さない。 */
  if(!nw&&!perfect)h+='<button class="btn" data-act="again">もう一度この範囲を解く</button>';
  /* 終わったらホームへ（2026-08-15 本人指示。分野選択に置き去りにしない） */
  h+='<button class="btn" style="margin-top:8px" data-act="tab" data-v="home">ホームへ戻る</button>'
   +'</div></div>';
  return h;
}

/* ---------- 復習（3層：①その場の間違い直し ②間隔をあけた復習 ③抜き打ち） ---------- */
function vReview(){
  var fl=filtered(),sev=severeTopics(),pl=plan();
  var wt=wrongToday();
  var h='<div class="pad'+stag()+'">';
  h+='<div class="panel">'
    +(sneakDone()
       ?'<div class="li"><div class="nm">抜き打ち</div><span class="mini">今日は済</span></div>'
       :rline('抜き打ち',pl.sneak.length,'startSneak',true))
    +rline('今日の間違い',wt.length,'startWrong',false)
    +rline('間違い',pl.wrong,'startWrongAll',false)
    +'</div>';
  /* 間違いの分野ごとの内訳（期限で追い立てない。件数だけ見せる） */
  var wb=wrongByBigMap(),wtot=pl.wrong;
  if(wtot){
    h+='<div class="panel">'+BIGS.filter(function(b){return wb[b]}).sort(function(a,b){return wb[b]-wb[a]})
      .map(function(b){return '<div class="li"><div class="nm">'+esc(b)
        +'<div class="track" style="margin-top:4px"><i class="ngbar" data-m6v="'+(wb[b]/wtot).toFixed(4)+'" data-m6vk="wb:'+esc(b)+'"></i></div></div>'
        +'<span class="mini num">'+n3(wb[b])+'</span>'
        +'<button class="btn sm" data-act="startWrongBig" data-b="'+esc(b)+'">解く</button></div>'}).join('')
      +'</div>';
  }

  h+='<div class="panel"><button class="tapline" data-act="togFilter"><span style="flex:1;font-weight:600">絞り込み</span>'
    +'<span class="badge">'+n3(fl.length)+'問</span>'+(S.openFilter?IC.up:IC.down)+'</button>';
  if(S.openFilter){
    h+='<div class="hr"></div><div>'
      +tg('wrong','間違えた問題のみ',F.wrong)
      +tg2('ngMin',2,'2回以上間違えた',F.ngMin===2)
      +tg2('ngMin',3,'3回以上間違えた',F.ngMin===3)
      +tg2('recent',1,'今日間違えた',F.recent===1)
      +tg2('recent',3,'3日以内に間違えた',F.recent===3)
      +tg2('recent',7,'7日以内に間違えた',F.recent===7)
      +tg('star',IC.star+'のみ',F.star)   /* ★も自作SVG（記号文字を使わない） */
      +tg('unseen','未出題のみ',F.unseen)
      +tg2('rateMax',50,'正解率50%以下',F.rateMax===50)
      +tg2('rateMax',70,'正解率70%以下',F.rateMax===70)
      +'</div>';
    /* 難易度の絞り込み＝3段階の3チップ（易＝A・B／普＝C／難＝D・E。未評価は該当しない） */
    h+='<div class="hr"></div><div class="mini" style="margin-bottom:6px">難易度</div><div>'
      +D3.map(function(d){return '<button class="tog'+(F.difs.indexOf(d)>=0?' on':'')+'" style="margin:0 6px 6px 0" data-act="fdif" data-d="'+d+'">'+d+'</button>'}).join('')
      +'</div>';
    /* 49分類の章の一覧は動画学習と重複して長いので、既定は畳む */
    h+='<div class="hr"></div><button class="tapline" data-act="togchaps"><span style="flex:1">章</span>'
      +(F.topics.length?'<span class="chip">'+F.topics.length+'</span>':'')
      +(S.openChaps?IC.up:IC.down)+'</button>';
    if(S.openChaps)CATS.forEach(function(c){
      var ts=CINFO[c].topics,open=!!S.openCat[c];
      var nsel=ts.filter(function(t){return F.topics.indexOf(c+'|:|'+t)>=0}).length;
      h+='<button class="tapline" data-act="opencat" data-c="'+esc(c)+'" style="min-height:40px">'
        +'<span style="flex:1">'+esc(c)+'</span>'
        +(nsel?'<span class="chip">'+nsel+'選択</span>':'')
        +'<span class="badge">'+ts.length+'章</span>'+(open?IC.up:IC.down)+'</button>';
      if(open){
        h+='<div style="padding:0 0 8px">';
        ts.forEach(function(t){
          var key=c+'|:|'+t,on=F.topics.indexOf(key)>=0;
          h+='<button class="tog'+(on?' on':'')+'" style="margin:0 6px 6px 0" data-act="ftopic" data-k="'+esc(key)+'">'+esc(t)+' '+itemsOfTopic(c,t).length+'</button>';
        });
        h+='</div>';
      }
    });
    h+='<div class="hr"></div><div class="spread"><span class="mini">該当 <b class="num">'+n3(fl.length)+'</b> 問'
      +(fActive()?'':'（条件なし＝全問）')+'</span>'
      +'<button class="btn sm" data-act="fclear">条件クリア</button></div>'
      +'<button class="btn pri" style="margin-top:10px" data-act="startFilter"'+(fl.length?'':' disabled')+'>この条件で解く</button>';
  }
  h+='</div>';

  h+='<div class="panel"><div class="h">重症リスト（'+sev.length+'章）</div>';
  if(!sev.length)h+='<div class="mini">5問以上解いて誤答が35%以上の章、または誤答3回の問題が2つ以上ある章が出ます。今はありません。</div>';
  sev.forEach(function(x){
    var ch=chapsOf(x.cat).filter(function(cc){return cc.topic===x.topic})[0];
    /* 長押し＝その章で間違えた問題の出典と解説の先読み（押している間だけ） */
    var pit=BY[x.ids[0]],pv=pit?(srcLabel(pit)+'|'+String(pit.exp||pit.stem||'').slice(0,70)):'';
    h+='<div class="li"'+(pv?' data-m6pv="'+esc(pv)+'"':'')+'><div class="nm"><b>'+esc(x.topic)+'</b><div class="mini">'+esc(x.cat)+' ／ '+x.att+'問中 '+x.ids.length+'問がまだ直っていない（'+Math.round(x.rate*100)+'%） — この章は動画に戻る</div></div>'
      +(ch?'<a class="btn sm" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.yt+mmss(ch.sec)+' から</a>':'')
      +'<button class="btn sm" data-act="startTopic" data-c="'+esc(x.cat)+'" data-t="'+esc(x.topic)+'">解く</button></div>';
  });
  h+='</div></div>';
  return h;
}
/* 復習の1行＝ラベル・件数・解くボタン（0件なら押せない見た目） */
function rline(label,n,act,strong){
  /* 件数＝解いたあとに「値が入れ替わる」数字なので桁ロール（4桁以上は区切りを優先して回さない） */
  var rn=(n<1000)?('<span class="m6-roll" style="--rh:28px;font-size:20px;font-weight:600"'
    +' data-m6id="rl:'+esc(act)+'" data-fmt="'+new Array(Math.max(2,String(n).length)+1).join('_')
    +'" data-m6r="'+n+'"></span>'):n3(n);
  return '<div class="li"><div class="nm">'+esc(label)+'</div>'
    +'<b class="num" style="font-size:20px">'+rn+'</b>'
    +(n?'<button class="btn sm'+(strong?' acc':'')+'" data-act="'+act+'">解く</button>'
       :'<span class="mini">—</span>')+'</div>';
}
function tg(k,label,on){return '<button class="tog'+(on?' on':'')+'" style="margin:0 6px 6px 0" data-act="ftog" data-k="'+k+'">'+label+'</button>'}
function tg2(k,v,label,on){return '<button class="tog'+(on?' on':'')+'" style="margin:0 6px 6px 0" data-act="fset" data-k="'+k+'" data-v="'+v+'">'+label+'</button>'}

/* ---------- 分析（すべての項目が「次に何をするか」に直結すること）
   棒グラフの羅列（分野別・難易度別・章別の正解率）は廃止した。 ---------- */
function bigStat(big){
  var ok=0,ng=0,n=0,a=0,ready=0;
  ITEMS.forEach(function(it){
    if(it.big!==big)return;n++;
    var r=R(it.id);if(!r)return;
    ok+=r.ok||0;ng+=r.ng||0;
    if(att(r)>0){a++;if((r.streak||0)>0||r.state==='卒業')ready++}
  });
  /* rate＝通算の正誤比（復習で正解を積むと膨らむ）。
     nowRate＝解いた問題のうち「直近が正解」の割合＝いま出されたら解ける割合。
     得点予測には nowRate を使う（2026-08-14 本人指摘。通算比は予測に向かない）。 */
  return {big:big,n:n,att:a,ok:ok,ng:ng,ready:ready,
          rate:(ok+ng)?ok/(ok+ng):null,
          nowRate:a?ready/a:null,q:BIGQ[big]||0};
}
/* MINQ＝分析③の失点ランキングに出すための下限（その大分類で10問以上解いていること）。
   1問の誤答で「権利関係 −14.0」と出さないための足切り。
   ★①の得点予測では MINQ は使っていない（2026-08-15 に論点ベースへ変えたときに外した）。
     論点ごとに到達度を出すので「1問だけ解いた分野を丸ごと推定する」という問題が
     そもそも起きない＝分野単位の足切りが要らなくなったため。 */
var MINQ=10;
/* ---------- 単元の到達度＝論点ごとの到達度の平均 ----------
   論点の到達度＝その論点で解いた肢のうち「直近が正解」の割合（1肢も解いていない論点は 0）。
   「直近が正解」の判定は nowRate と同じ定義（streak>0 または state==='卒業'）を使う
   ＝ catStat()/bigStat() と揃える。ここで新しい定義を作らない。
   論点の束ね方は CINFO[c].topics / severeTopics() と同じ（cat の中を it.topic で束ね、
   topic が無い肢は「未分類」という1つの論点として扱う）。

   ★この関数は it.topic に依存する。topic は全数調査で約16%が誤っていると分かっており
     （2026-08-15 時点で付け直し作業中）、付け直しの結果を入れると点は動く。
     論点の数が変われば単元ごとの分母（tn）が変わるため、上下どちらにも動きうる。 */
function catReach(c){
  var info=CINFO[c];
  if(!info)return {reach:0,tn:0,tdone:0,aq:0,nq:0};
  var ts=info.topics,tn=ts.length;
  if(!tn)return {reach:0,tn:0,tdone:0,aq:0,nq:0};      /* 論点0の単元＝0で割らない */
  var m={};ts.forEach(function(t){m[t]={a:0,ready:0,n:0}});
  var aq=0,nq=0;
  itemsOfCat(c).forEach(function(it){
    if(!it)return;
    var o=m[it.topic||'未分類'];if(!o)return;
    nq++;o.n++;
    var r=R(it.id);if(!r||att(r)===0)return;
    o.a++;aq++;
    if((r.streak||0)>0||r.state==='卒業')o.ready++;
  });
  /* 到達度＝その論点で「直近が正解」の肢の数 ÷ NEED。NEED は2本（肢が1本しかない
     論点は1本）。1本正解しただけで満額にすると、26肢ある論点でも1肢で100%になり、
     本人が読む「確実に取れる点数」として甘くなる（2026-08-15 実装担当の自己申告）。
     2本正解を求めるのは、たまたま当たった1本を実力と数えないため。
     式は「直近の正答率 × 手ごたえ（解いた肢数/NEED・上限1）」。正答率をそのまま残すので、
     26肢を8割で正解した論点が満額になることはない（正解数だけで見るとそうなってしまう）。 */
  var sum=0,tdone=0;
  ts.forEach(function(t){
    var o=m[t];if(!o.a)return;                        /* 肢0の論点は 0 扱い＝0で割らない */
    var need=Math.min(2,o.n)||1;
    sum+=(o.ready/o.a)*Math.min(1,o.a/need);tdone++;
  });
  return {reach:sum/tn,tn:tn,tdone:tdone,aq:aq,nq:nq};
}
/* 「いま確実に取れると言える点数」（2026-08-15 本人指摘で作り直し）。
   旧①：その分野を10問解いたら、配点20点ぶんを正答率で丸ごと推定していた（甘すぎた）。
   旧②：配点 × 肢の消化率(att/n) × 直近の正答率。未着手のぶんは0点。
   新 ：配点 × 論点ごとの到達度の平均。

   なぜ変えたか（2026-08-15 批評指摘・実測の裏付けあり）：
   旧②は復習を回すと nowRate が 0.95 前後に張り付くので、点が実質「50 × 肢の消化率」になる。
   実測で 消化率61%・正答率95% → 28.9点／消化率61%・正答率100% → 30.4点。
   つまり全問正解でも 35点（合格ライン）に届かせるには 5,237肢の70%を解くしかなく、
   残り64日で1日60肢。実力があってもプールを終えるまで「届かない」と言い続ける道具になっていた。

   根本の原因は、過去問26年分なので同じ論点の肢が何本もあること。
   実測：5,237肢に対して論点は674個・平均7.8肢/論点。偏りが大きい。
     37条書面   155肢/6論点  ＝25.8肢/論点
     8種制限    288肢/11論点 ＝26.2肢/論点
     建築基準法 224肢/60論点 ＝3.7肢/論点
   37条書面は6論点を155肢で問うているだけなので、論点を押さえれば点は取れる。
   肢を全部潰すまで数字が上がらないのは、測っているものが間違っている。

   本人の言葉：「確実に取れる点数が分かった方がいいよね。実質その単元を復習したらそこの点は
   取れるでしょ？」＝1本の数字のまま出す。楽観的な外挿（未着手の論点を「たぶん取れる」と
   見積もる等）は足さない＝1肢も解いていない論点は 0 のまま。

   分母は CATQ_TOTAL＝49.00（統計の1問は過去問で測れないので別枠。CATQ のコメント参照）。 */
function scoreNow(){
  var pts=0,covered=0,agg={};
  CATS.forEach(function(c){
    var q=CATQ[c];
    if(!q)return;                                       /* 配点0（贈与税）と別枠（統計）は寄与しない */
    var s=catReach(c);
    if(!s.tn)return;
    var b=CINFO[c].big,g=agg[b]||(agg[b]={big:b,q:0,pts:0,tn:0,tdone:0,aq:0,nq:0});
    g.q+=q;g.pts+=q*s.reach;g.tn+=s.tn;g.tdone+=s.tdone;g.aq+=s.aq;g.nq+=s.nq;
    pts+=q*s.reach;
    covered+=q*(s.tdone/s.tn);                          /* 手を付けた論点ぶんの配点＝測定できた範囲 */
  });
  /* 内訳は大分類で出す。単元で出した点を大分類へ足すだけなので、
     内訳の合計は必ず見出しの数字に一致する（2026-08-15 批評指摘：4行までで税と価格が永久に出ず、
     内訳の合計46.97 対 見出し50.00 とズレていた。上位N件で切るのをやめて6行すべて出す）。 */
  var done=[];
  Object.keys(agg).forEach(function(b){
    var g=agg[b];
    done.push({big:b,q:g.q,pts:g.pts,tn:g.tn,tdone:g.tdone,att:g.aq,n:g.nq});
  });
  done.sort(function(x,y){return y.pts-x.pts||y.q-x.q});
  /* 画面に出す1桁の数字（show）は、各行を別々に四捨五入すると合計が見出しとズレる
     （0.05×6行で最大0.3）。行ごとに切り捨ててから、端数の大きい行へ 0.1 ずつ配り直す
     ＝最大剰余法。これで「内訳を足したら見出しの数字になる」が必ず成り立つ。 */
  var want=Math.round(pts*10),fl=[],sum=0;
  done.forEach(function(d,i){var v=Math.floor(d.pts*10);fl[i]=v;sum+=v});
  var idx=done.map(function(d,i){return i}).sort(function(a,b){
    return (done[b].pts*10-fl[b])-(done[a].pts*10-fl[a])||(done[b].pts-done[a].pts)});
  for(var k=0;k<want-sum;k++)fl[idx[k%idx.length]]++;
  done.forEach(function(d,i){d.show=fl[i]/10});
  return {pts:pts,covered:covered,done:done,total:CATQ_TOTAL};
}
function pace7(){
  var n=0;
  for(var i=0;i<7;i++){var d=addD(today(),-i);n+=(ST.days[d]||{}).n||0}
  return n/7;
}
function vAnalysis(){
  var st=allStats(),pl=plan(),sc=scoreNow(),h='<div class="pad'+stag()+'">';
  M4ANA=null;

  /* ① 今受けたら何点（合格ラインの線が入ったゲージ・数字は点数だけ大きく）
     式＝Σ（単元の配点 × その単元の論点ごとの到達度の平均）。理由は scoreNow() のコメント。
     分母は 50 ではなく CATQ_TOTAL＝49（統計の1問は過去問で測れないので別枠）。 */
  var tot=sc.total;
  h+='<div class="panel">'
    +'<div class="spread" style="align-items:flex-end;margin-bottom:8px">'
    +'<div><span class="score">'+sc.pts.toFixed(1)+'</span>'
    /* ホームのカードは「/ 49点」なので、ここだけ単位を落とすと表記が食い違う
       （2026-08-16 実機検証で指摘）。 */
    +'<span class="mini num"> / '+tot+'点</span></div>'
    +'<div class="mini">いま確実に取れる点数</div></div>'
    /* 目盛りは49点。手を付けた論点ぶんの配点（covered）まで薄く、その中の得点を濃く出す。
       まだ触っていない論点を「取れる」ように見せない（2026-08-14 本人指摘の修正）。 */
    +'<div class="gauge"><i style="width:'+(sc.pts/tot*100).toFixed(1)+'%"></i>'
    +'<span class="gmeas" style="left:'+((sc.covered||0)/tot*100).toFixed(1)+'%"></span>'
    +'<span class="gline" style="left:'+(PASS_LINE/tot*100).toFixed(1)+'%"></span></div>'
    +'<div class="spread" style="margin-top:4px"><span class="mini num">0</span>'
    +'<span class="mini num">'+PASS_LINE+'</span><span class="mini num">'+tot+'</span></div>'
    +'<div class="mini" style="margin-top:6px">配点 × 論点ごとの到達度の平均。'
    +'到達度＝その論点で解いた肢のうち直近が正解の割合。まだ1肢も解いていない論点は0点です</div>'
    /* 内訳は上位N件で切らない＝6分野すべて出す。切ると税（2.00）と価格の評定（1.00）は
       配点の上限が低いので永久に上位に入らず、内訳の合計と見出しの数字も一致しなくなる。 */
    +(sc.done.length?'<div class="mini" style="margin-top:4px">'
      +sc.done.map(function(d){
        return esc(d.big)+' '+d.show.toFixed(1)+' / '+d.q.toFixed(0)+'点（論点 '
          +n3(d.tdone)+'/'+n3(d.tn)+'）'}).join('<br>')+'</div>':'')
    /* 統計は得点予測に入っていないことを1行だけ断る（数字を出さない＝軽視も過大評価もさせない） */
    +'<div class="mini" style="margin-top:4px">統計（毎年1問）は過去問で測れないため別枠</div>';
  h+='</div>';

  /* ② 間に合うか（必要ペースと実ペースの2本の線） */
  var p7=pace7(),needD=p7>0?Math.ceil(pl.unseen/p7):null;
  var short=(needD===null)?null:needD-pl.daysLeft;
  h+='<div class="panel">'
    +'<div class="spread"><span class="mini">必要 '+n3(pl.needNew)+' / 日</span>'
    +'<span class="mini num">実際 '+p7.toFixed(0)+' / 日</span></div>'
    +paceSvg(pl.needNew,p7)
    +'<div class="spread" style="margin-top:6px"><span class="mini num">残り '+n3(pl.daysLeft)+'日</span>'
    +'<span class="mini num">未着手 '+n3(pl.unseen)+'</span></div>';
  if(short!==null&&short>0)
    h+='<div class="mini" style="margin-top:4px;color:var(--ngdeep)">'
      +(short>pl.daysLeft?'このペースでは終わりません':'このままだと '+n3(short)+'日 足りません')+'</div>';
  if(pl.over)
    h+='<div class="mini" style="margin-top:6px;color:var(--ngdeep)">必要ペースが1日の枠（'+n3(pl.cap)+'問／'
      +((ST.settings.min)||120)+'分）を超えています</div>'
      +'<div class="rowx" style="gap:8px;margin-top:8px">'
      +'<button class="btn sm" data-act="setmin" data-v="'+(((ST.settings.min)||120)+60)+'">1日を '+((((ST.settings.min)||120)+60))+'分にする</button>'
      +'<button class="btn sm'+(ST.settings.later?' acc':'')+'" data-act="later">「難」を後回し</button></div>';
  h+='</div>';

  /* ③ 失点が大きい分野 上位5（出題数×不正解率／棒の長さで示す） */
  /* 下限＝その大分類で MINQ（10問）以上解いていない分野はランキングに出さない。
     1問の誤答で「権利関係 −14.0」と出るのを避けるため。
     10問未満の分野は、ランキングの下に1行でまとめて「測定中 …4/10問」と出す。
     ★①（得点予測）は 2026-08-15 に論点ベースへ変えて MINQ を使わなくなった。
       下限が要るのはここだけ＝大分類まるごとの失点を1本の数字で言い切る場所だから。 */
  /* 不正解率は「通算の正誤比 ng/(ok+ng)」ではなく「1 − nowRate」＝いま出されたら落とす割合を使う。
     2026-08-15 批評指摘：①のコメントに「通算比は予測に向かない（本人指摘）」と書いてあるのに
     ③だけ通算比のままだった。通算比は復習で正解を積むと勝手に下がるので、
     ①の点が動いていないのに③の失点だけ減る＝同じ画面で矛盾した話をすることになる。 */
  var lossAll=BIGS.map(function(b){
    var s=bigStat(b),wr=(s.nowRate===null)?null:1-s.nowRate;
    return {big:b,att:s.att,q:s.q,wr:wr,loss:wr===null?null:s.q*wr,rate:s.rate};
  });
  var loss=lossAll.filter(function(x){return x.att>=MINQ&&x.loss!==null})
                  .sort(function(a,b){return b.loss-a.loss}).slice(0,5);
  var lmeas=lossAll.filter(function(x){return x.att>0&&x.att<MINQ});
  h+='<div class="panel">';
  /* どの分野も10問未満なら棒を出さず1行だけ（何も解いていないときは今までどおりの文言） */
  if(!loss.length)h+='<div class="mini">'+(lmeas.length?'まだ測定できません':'まだ解答がありません')+'</div>';
  var mx=loss.length?loss[0].loss:0;
  loss.forEach(function(x){
    /* 失点0のときは 0/0=NaN で幅の指定が無効になり、棒が全幅で残っていた（0なら棒も0にする） */
    var bw=(mx>0?x.loss/mx*100:0).toFixed(1);
    h+='<div class="li"><div class="nm">'+esc(x.big)
      +'<div class="track" style="margin-top:4px"><i class="ngbar" data-m6v="'+(bw/100).toFixed(4)+'" data-m6vk="loss:'+esc(x.big)+'"></i></div></div>'
      /* 失点0は「−0.00」と書かず「—」（未測定・0件の表記と揃える＝SPEC §5-1 引き算の原則） */
      +'<span class="mini num">'+(x.loss>0?'−'+(x.loss<0.1?x.loss.toFixed(2):x.loss.toFixed(1)):'—')+'</span>'
      +'<button class="btn sm" data-act="gobig" data-b="'+esc(x.big)+'">動画</button></div>';
  });
  /* 測定待ちの分野は1行にまとめる（何が測定待ちか分かるように・文字は増やさない） */
  if(loss.length&&lmeas.length)
    h+='<div class="mini" style="margin-top:6px">測定中 '+lmeas.map(function(x){
        return esc(x.big)+' <span class="num">'+x.att+'/'+MINQ+'問</span>'}).join('・')+'</div>';
  h+='</div>';

  /* ④ 弱い章 上位10（3問以上解いた章のみ・その章のタイムスタンプへ） */
  var tp=[];
  CATS.forEach(function(c){CINFO[c].topics.forEach(function(t){
    var ok=0,ng=0,its=itemsOfTopic(c,t);
    its.forEach(function(it){var r=R(it.id);if(r){ok+=r.ok||0;ng+=r.ng||0}});
    if(ok+ng>=3)tp.push({c:c,t:t,ok:ok,ng:ng,wr:ng/(ok+ng),it:its[0]});
  })});
  h+='<div class="panel">';
  if(!tp.length)h+='<div class="mini">3問以上解いた章がまだありません</div>';
  tp.sort(function(a,b){return b.wr-a.wr}).slice(0,10).forEach(function(x){
    var ch=x.it?chapFor(x.it):null;
    h+='<div class="li"><div class="nm">'+esc(x.t)+'<div class="mini">'+esc(x.c)+'</div></div>'
      +'<span class="mini num">'+(x.wr*100).toFixed(0)+'%</span>'
      +(ch?'<a class="btn sm" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.yt+mmss(ch.sec)+'</a>':'')+'</div>';
  });
  h+='</div>';

  /* ⑤ 推移（直近14日・棒＝解答数／中の緑＝正解） */
  var ds=[],mxd=1;
  for(var i=13;i>=0;i--){var d=addD(today(),-i),v=ST.days[d]||{n:0,ok:0};ds.push({d:d,n:v.n,ok:v.ok});if(v.n>mxd)mxd=v.n}
  h+='<div class="panel"><div class="days">'
    +ds.map(function(x){return '<div style="height:'+Math.max(2,(x.n/mxd)*100)+'%"><i style="height:'+(x.n?(x.ok/x.n)*100:0)+'%"></i></div>'}).join('')
    +'</div><div class="spread" style="margin-top:4px"><span class="mini num">'+ds[0].d.slice(5)+'</span>'
    +'<span class="mini num">最大 '+n3(mxd)+'</span>'
    +'<span class="mini num">'+ds[13].d.slice(5)+'</span></div></div>';

  /* ⑤-2 学習時間（実測）＝動画／新規／復習／抜き打ちの4内訳と合計。今日・直近7日・通算。
     2026-08-14 本人指示「復習や抜き打ちでやった時間も足してほしい。それは分析で出してほしい」。
     動画の行に出すのはその動画ぶんだけなので、横断の合計はここでしか見られない。
     引き算の原則に従い、数字と細い帯だけ（説明文は置かない）。 */
  h+='<div class="panel">';
  [['今日',1],['7日',7],['通算',null]].forEach(function(pr){
    var t=tlogSum(pr[1]),mins=Math.round(t.total/60000);
    h+='<div class="li" style="display:block;padding:8px 0">'
      +'<div class="spread"><span class="mini">'+pr[0]+'</span>'
      +'<span class="mini num">'+(mins?mins+'分':'—')+'</span></div>'
      +'<div class="band thin" style="cursor:default">'
      /* 1分未満は「—」なので帯も空にして揃える（数字と帯で齟齬を出さない） */
      +(mins?TKINDS.map(function(k,i){var v=t[k[0]];return v?'<i class="t'+i+'" style="flex:'+v+'"></i>':''}).join('')
            :'<i class="u" style="flex:1"></i>')+'</div></div>';
  });
  var tall=tlogSum(null);
  h+='<div class="rowx" style="flex-wrap:wrap;gap:8px;margin-top:8px">'
    +TKINDS.map(function(k,i){return '<span class="mini"><i class="wdot t'+i+'"></i>'+k[1]
      +' <span class="num">'+Math.round((tall[k[0]]||0)/60000)+'</span></span>'}).join('')
    +'</div>';
  var vr=vminReal();
  if(vr!==null)h+='<div class="mini" style="margin-top:6px">動画の実測平均 <span class="num">'+vr+'</span>分／日（1日の枠に反映）</div>';
  h+='</div>';

  /* ⑥ 忘れかけ（期限超過・最も放置している分野） */
  var over=wrongPool();
  var oldest=null;
  CATS.forEach(function(c){
    var last=null;
    itemsOfCat(c).forEach(function(it){var r=R(it.id);if(r&&r.last&&(!last||r.last>last))last=r.last});
    if(last&&(!oldest||last<oldest.last))oldest={cat:c,last:last};
  });
  h+='<div class="panel"><div class="li"><div class="nm">間違えたまま</div>'
    +'<b class="num">'+n3(over.length)+'</b>'
    +(over.length?'<button class="btn sm" data-act="startWrongAll">解く</button>':'<span class="mini">—</span>')+'</div>'
    +(oldest?'<div class="li"><div class="nm">'+esc(oldest.cat)+'<div class="mini">'
      +n3(dgap(oldest.last,today()))+'日 放置</div></div>'
      +'<button class="btn sm" data-act="cat" data-c="'+esc(oldest.cat)+'">動画</button></div>':'')
    +'</div>';

  /* ⑦ 誤答理由の内訳（4色の帯1本） */
  var wc={},wt=0;
  WHYS.forEach(function(w){wc[w]=0});
  Object.keys(ST.items).forEach(function(id){(ST.items[id].why||[]).forEach(function(w){if(wc[w]===undefined)wc[w]=0;wc[w]++;wt++})});
  h+='<div class="panel">';
  if(!wt)h+='<div class="mini">誤答の理由はまだありません</div>';
  else{
    h+='<div class="band" style="cursor:default">'
      +WHYS.map(function(w,i){return wc[w]?'<i class="w'+i+'" style="flex:'+wc[w]+'"></i>':''}).join('')+'</div>'
      +'<div class="rowx" style="flex-wrap:wrap;gap:8px;margin-top:8px">'
      +WHYS.map(function(w,i){return '<span class="mini"><i class="wdot w'+i+'"></i>'+esc(w)+' '+n3(wc[w])+'</span>'}).join('')
      +'</div>';
  }
  h+='</div>';

  /* 状態の色の凡例はここに1回だけ置く（他の画面では点だけ） */
  h+='<div class="panel"><div class="rowx" style="flex-wrap:wrap;gap:10px">'
    +'<span class="mini"><i class="sdot s3"></i> 卒業 '+n3(st.grad)+'</span>'
    +'<span class="mini"><i class="sdot s2"></i> 定着 '+n3(st.keep)+'</span>'
    +'<span class="mini"><i class="sdot s1"></i> 学習中 '+n3(st.learn)+'</span>'
    +'<span class="mini"><i class="sdot"></i> 未着手 '+n3(ITEMS.length-st.grad-st.keep-st.learn)+'</span>'
    +'<span class="mini" style="color:var(--ngdeep)">重症 '+n3(st.sev)+'</span>'
    +'</div></div>';
  h+='</div>';
  return h;
}
/* ②の2本の線：必要ペース（濃い）と実ペース（淡い）。文字は「必要」「実際」だけ */
function paceSvg(need,real){
  var w=300,hh=64,mx=Math.max(need,real,1),y=function(v){return hh-4-(v/mx)*(hh-12)};
  return '<svg class="spark" viewBox="0 0 '+w+' '+hh+'" preserveAspectRatio="none" aria-hidden="true">'
    +'<line x1="0" y1="'+y(need).toFixed(1)+'" x2="'+w+'" y2="'+y(need).toFixed(1)
    +'" stroke="var(--fg)" stroke-width="2"/>'
    +'<line x1="0" y1="'+y(real).toFixed(1)+'" x2="'+w+'" y2="'+y(real).toFixed(1)
    +'" stroke="var(--acc)" stroke-width="2" stroke-dasharray="5 4"/>'
    +'</svg>';
}
function bars(rows){
  return rows.map(function(x){
    var a=x.ok+x.ng,r=a?x.ok/a:null;
    return '<div class="gr"><div class="lbl"><span>'+esc(x.k)+' <span class="mini">'+n3(x.n||0)+'問</span></span>'
      +'<b>'+(r===null?'—':pct(r,1))+' <span class="mini">'+x.ok+'/'+a+'</span></b></div>'
      +'<div class="track"><i class="'+(r!==null&&r<0.6?'ngbar':'')+'" data-m6v="'+(r===null?0:r.toFixed(4))+'" data-m6vk="bar:'+esc(x.k)+'"></i></div></div>';
  }).join('');
}

/* ---------- データ書き出し／読み込み ---------- */
/* 報告の一覧＝そのままコピーして貼れる形（肢id・種別・出典）。
   直す側は肢idさえあれば場所が特定できる。 */
/* 報告は「印を複数＋メモ」。古い形（文字列1つ）で入っていたものも読めるようにする。 */
/* 報告の印。**出題中（答える前）にも解説の下にも同じものを出す**（2026-08-17 本人指示）。 */
/* 報告のシート（ヘッダーのアイコンから開く）。行を占めずに6つの印とメモを出す。 */
/* 報告＝解説の末尾にその場で出す（2026-08-18 本人の設計）。
   ・選ぶのは2つだけ ・コメントは任意 ・**送信を押した時点でパス扱い**
   ・パス＝この1問の記録を取り消して「まだ解いてない問題」に戻す
     （報告した問題は直したあともう一度解く必要があるので、解いた扱いにしてはいけない） */
function repInline(id){
  var d=(S.repDraft&&S.repDraft.id===id)?S.repDraft:{id:id,tags:[],memo:''};
  S.repDraft=d;
  return '<div class="hr"></div><div class="repbox">'
    +'<div class="mini" style="margin-bottom:6px">'+IC.warn+' おかしいところ</div>'
    +'<div class="whys">'+REPS.map(function(w){
        return '<button class="tog'+(d.tags.indexOf(w)>=0?' on':'')+'" data-act="rep"'
          +' data-w="'+esc(w)+'" data-id="'+esc(id)+'">'+esc(w)+'</button>'}).join('')
    +'</div>'
    +'<input id="repmemo" data-act="repmemo" data-id="'+esc(id)+'" value="'+esc(d.memo||'')
    +'" placeholder="コメント（任意）" style="width:100%;margin-top:8px">'
    /* コメントだけでも送れる（2026-08-18 本人指示）。打っている途中に描き直さないので、
       押せる状態を変えずに、押したときに中身を見て判断する。文言は「送信」だけ。 */
    +'<button class="btn sm" data-act="repsend" data-id="'+esc(id)+'" style="margin-top:8px">'
    +'送信</button>'
    +'</div>';
}
/* 答える直前の控え。送信＝パスのときに、この1問ぶんだけ元へ戻す。
   件数を引き算で戻すと取りこぼすので、触られる場所をまるごと控える。 */
function snapAns(id){
  var it=BY[id]||{},vid=(it.vids&&it.vids[0]&&it.vids[0].vid)||null,t=today();
  function cp(o){return o?JSON.parse(JSON.stringify(o)):null}
  return {id:id,vid:vid,day:t,
    rec:cp(ST.items[id]),
    sess:cp(ST.session),
    days:cp(ST.days[t]),
    vp:vid?cp(ST.vp[vid]):null,
    wrongs:(S.wrongs||[]).slice(),
    sT:S.sT,sR:S.sR,sStreak:S.sStreak,sBest:S.sBest,
    lost:FXST.lost,streak:FXST.streak};
}
function undoAns(sp){
  if(!sp)return;
  if(sp.rec)ST.items[sp.id]=sp.rec;else delete ST.items[sp.id];
  if(sp.sess)ST.session=sp.sess;
  if(sp.days)ST.days[sp.day]=sp.days;else delete ST.days[sp.day];
  if(sp.vid){if(sp.vp)ST.vp[sp.vid]=sp.vp;else delete ST.vp[sp.vid]}
  S.wrongs=sp.wrongs;
  S.sT=sp.sT;S.sR=sp.sR;S.sStreak=sp.sStreak;S.sBest=sp.sBest;
  FXST.lost=sp.lost;FXST.streak=sp.streak;
  saveST();
}
/* ---------- この動画の記録をリセット（2026-08-18 本人指示） ----------
   対象＝その動画の「ここまでで解ける」肢（画面に出ている数と同じ範囲にする）。
   消す＝肢ごとの解答記録（正誤・連続正解・卒業・休ませる段・最後に解いた日）と動画の進捗。
   消さない＝日別の実績・学習時間・通算の累計・報告。 */
function vResetTargets(vid){
  return videoItemsUp(vid).filter(function(it){return att(R(it.id))>0});
}
function vResetAsk(vid){
  var its=vResetTargets(vid),all=videoItemsUp(vid).length;
  var m=document.getElementById('modal');
  m.innerHTML='<div class="sheet">'
   +'<div class="spread" style="margin-bottom:10px"><div class="h" style="margin:0">記録をリセット</div>'
   +'<button class="btn sm" data-act="closeModal">'+IC.close+'閉じる</button></div>'
   +'<div class="mini" style="line-height:1.9">'+esc(vlab(vid)||vid)+'<br>'
   +'この動画の '+all+'問のうち、<b>解いた記録がある '+its.length+'問</b>を'
   +'「まだ解いたことがない」状態に戻します。<br>'
   +'消えるのは正誤・連続正解・卒業・休ませる段です。<br>'
   +'<b>解いた日数・学習時間・報告は残ります。</b><br>'
   +'元に戻せません。</div>'
   +'<div class="rowx" style="gap:8px;margin-top:12px">'
   +'<button class="btn sm" style="width:auto" data-act="vresetgo" data-v="'+esc(vid)+'">'
   +'リセットする（'+its.length+'問）</button>'
   +'<button class="btn sm" style="width:auto" data-act="closeModal">やめる</button></div></div>';
  m6SheetOpen();
}
function vResetGo(vid){
  var its=vResetTargets(vid),k=0;
  its.forEach(function(it){if(ST.items[it.id]){delete ST.items[it.id];k++}});
  var vp=ST.vp[vid];
  if(vp){
    var ids={};its.forEach(function(it){ids[it.id]=1});
    if(vp.done)vp.done=vp.done.filter(function(i){return !ids[i]});
    if(vp.wrong)vp.wrong=vp.wrong.filter(function(i){return !ids[i]});
    vp.completedAt=null;vp.round=0;
  }
  saveST();
  var mm=document.getElementById('modal');if(mm)mm.hidden=true;
  msg(k+'問を「まだ解いてない」に戻しました');
  render();
}
function repSheet(id){
  var m=document.getElementById('modal'),it=BY[id]||{};
  m.innerHTML='<div class="sheet">'
   +'<div class="spread" style="margin-bottom:10px"><div class="h" style="margin:0">おかしいところ</div>'
   +'<button class="btn sm" data-act="closeModal">'+IC.close+'閉じる</button></div>'
   +'<div class="mini" style="margin-bottom:8px">'+esc(String(it.stem||'').slice(0,44))+'…</div>'
   +repHtml(id)+'</div>';
  m6SheetOpen();      /* 開き方は他のシートと同じ手順にそろえる（m.hidden は中で外れる） */
}
function repHtml(id){
  var rp=repOf(id);
  return '<div class="hr"></div><div class="mini" style="margin-bottom:6px">おかしいところ（複数えらべます）</div><div class="whys">'
    +REPS.map(function(w){return '<button class="tog'+(rp.tags.indexOf(w)>=0?' on':'')+'" data-act="rep"'
      +' data-w="'+esc(w)+'" data-id="'+esc(id)+'">'+esc(w)+'</button>'}).join('')
    +'</div>'
    +(rp.tags.length
      ?'<input id="repmemo" data-act="repmemo" data-id="'+esc(id)+'" value="'+esc(rp.memo||'')
       +'" placeholder="何がどうおかしいか（任意）" style="width:100%;margin-top:8px">'
       +'<div class="mini" style="margin-top:6px">報告しました。設定の「おかしいところの報告」で一覧をコピーできます</div>'
      :'');
}
function repOf(id){
  var v=(ST.reports||{})[id];
  if(!v)return {tags:[],memo:''};
  if(typeof v==='string')return {tags:[v],memo:''};
  return {tags:v.tags||[],memo:v.memo||''};
}
function repText(){
  var r=ST.reports||{},k=Object.keys(r);
  if(!k.length)return '';
  return k.map(function(i){
    var it=BY[i],s=(it&&it.src)||{},o=repOf(i);
    return i+'\t'+o.tags.join('・')+'\t'+((s.year?s.year+'年問'+s.q:'')||'')
      +'\t'+((it&&it.cat)||'')+(o.memo?'\t'+o.memo:'');
  }).join('\n');
}
function repListHtml(){
  var r=ST.reports||{},n=Object.keys(r).length;
  if(!n)return '';
  return '<div class="panel" style="margin-bottom:12px"><div class="spread" style="margin-bottom:6px">'
    +'<div class="mini">おかしいところの報告 '+n+'件</div>'
    +'<button class="btn sm" style="width:auto" data-act="repcopy">コピー</button></div>'
    +'<textarea id="repta" readonly style="width:100%;height:96px;font-size:11px">'
    +esc(repText())+'</textarea>'
    +'<button class="btn sm" style="margin-top:6px" data-act="repclear">報告を消す</button></div>';
}
function dataSheet(){
  var m=document.getElementById('modal');
  var json=stOut();
  var lv=fxLevel();
  var lvs=[['auto','デフォルト（3段階）'],['strong','強'],['weak','弱'],['off','なし']];
  m.innerHTML='<div class="sheet">'
   +'<div class="spread" style="margin-bottom:10px"><div class="h" style="margin:0">設定とデータ</div>'
   +'<button class="btn sm" data-act="closeModal">'+IC.close+'閉じる</button></div>'
   /* 報告の一覧は置かない（2026-08-18 本人指示）。
      私が `gh api repos/yamanezumi42/takken-records/contents/takken_records.json` で
      直接読めるようになったので、コピペしてもらう必要がなくなった。 */
   +'<div class="mini" style="margin-bottom:6px">試験日</div>'
   +'<input id="sExam" type="date" value="'+esc(examDay())+'" style="width:100%">'
   +'<div class="rowx" style="gap:8px;margin:8px 0 0">'
   +'<button class="btn sm" data-act="setexam">保存</button>'
   +'<span class="mini num">あと '+n3(daysLeft())+'日</span></div>'
   +'<div class="hr"></div>'
   +'<div class="mini" style="margin-bottom:6px">1日の学習時間（分）／うち動画</div>'
   +'<div class="rowx" style="gap:8px">'
   +'<input id="sMin" type="number" min="10" max="600" value="'+((ST.settings.min)||120)+'" style="width:90px">'
   +'<input id="sVmin" type="number" min="0" max="300" value="'+((ST.settings.vmin)||0)+'" style="width:90px">'
   +'<button class="btn sm" data-act="setminutes">保存</button></div>'
   +'<div class="mini" style="margin-top:6px">1問30秒換算で 1日 '+n3(dayCap())+'問</div>'
   +'<div class="hr"></div>'
   /* 出題は既定で「見た動画の通し番号まで」。まだ習っていない知識が必要な問題は出さない。 */
   +'<div class="mini" style="margin-bottom:6px">未習の範囲も出す</div><div>'
   +'<button class="tog'+(ST.settings.ahead?' on':'')+'" style="margin:0 6px 6px 0" data-act="ahead" data-v="1">オン</button>'
   +'<button class="tog'+(ST.settings.ahead?'':' on')+'" style="margin:0 6px 6px 0" data-act="ahead" data-v="0">オフ（既定）</button>'
   +'</div>'
   +'<div class="mini">'+(NEEDOK?('見た動画 '+(watchedMaxSeq()===null?'なし':'#'+watchedMaxSeq()+'まで')
       +' ／ 出せる新規 '+n3(unseenItems().length)+'問'):'この問題データには通し番号がないため制限しません')+'</div>'
   +'<div class="hr"></div>'
   /* アプリの中から入れ直せるようにする。これが無いとURLに #import を打つために
      Safariへ戻ることになり、アイコンを付け直して記録を失う事故につながる
      （2026-08-14 実際に発生。ホーム画面のWebアプリはアイコンごとに別のデータを持ち、
      アイコンを消すとその記録も消える）。 */
   +'<div class="mini" style="margin-bottom:6px">問題データ</div>'
   +'<button class="btn" data-act="reimport">問題データを入れ直す</button>'
   +'<div class="mini" style="margin-top:6px">いま '+n3(ITEMS.length)+'問。'
   +'PCで作り直した takken_data.json を選び直します（学習の記録は消えません）。</div>'
   +'<div class="hr"></div>'
   +'<div class="mini" style="margin-bottom:6px">記録のバックアップ</div>'
   +'<button class="btn" data-act="share">'+IC.io+'ファイルにして保存・送る</button>'
   +'<div class="mini" style="margin-top:6px">共有から iCloud Drive やメールへ。'
   +'<b>ホーム画面のアイコンを消すと記録も消えます</b>ので、たまに取ってください。</div>'
   /* GitHubの非公開リポジトリへ自動で上げる。記録は問題文を含まないので置ける。
      トークンはこの端末の中（localStorage）だけに置き、公開されるコードには入らない。 */
   +'<div class="hr"></div>'
   +'<div class="mini" style="margin-bottom:6px">GitHubへ自動バックアップ（非公開リポジトリ）</div>'
   +'<div class="rowx" style="gap:8px;flex-wrap:wrap">'
   +'<input id="ghRepo" placeholder="owner/repo" value="'+esc(GH().repo||'')+'" style="flex:1;min-width:150px">'
   +'<input id="ghTok" type="password" placeholder="トークン" value="'+(GH().token?'••••••••':'')+'" style="flex:1;min-width:120px">'
   +'<button class="btn sm" style="width:auto" data-act="ghsave">保存</button></div>'
   +'<div class="rowx" style="gap:8px;margin-top:8px">'
   +'<button class="btn sm" style="width:auto" data-act="ghpush">今すぐ上げる</button>'
   +'<button class="btn sm" style="width:auto" data-act="ghpull">記録を取り戻す</button></div>'
   /* 問題データは**起動時に勝手に取り込む**。押すボタンは置かない（2026-08-18 本人指示）。
      ここには「いま何で動いているか」だけ出す。 */
   +'<div class="mini" id="dpstat" style="margin-top:8px;min-height:16px">'
   +(window.TAKKEN_SRC?('いま使っているデータ＝'+esc(window.TAKKEN_SRC.src)+'／'
      +n3(window.TAKKEN_SRC.n)+'問／'+window.TAKKEN_SRC.files+'ファイル'):'')+'</div>'
   +'<div class="mini" style="margin-top:2px">問題・図は '+esc(GH().repo||'—')
   +' の <b>data</b> ブランチから取り込みます（記録は main。触りません）。'
   +'変わったファイルだけ落とすので数百KBで済みます。</div>'
   +'<div class="mini" style="margin-top:6px">最後に上げた '+(GH().at?esc(GH().at):'—')
   +(GH().err?' ／ <span style="color:var(--ngdeep)">'+esc(GH().err)+'</span>':'')
   +'<br>トークンはこの端末の中だけに保存します（公開されるコードには入りません）。'
   +'アプリを開いたときと完走したときに、記録が変わっていれば自動で上がります。</div>'
   +'<div class="hr"></div>'
   /* 配色は9つ。骨格（配置・余白・丸み・動き）は変わらず、色だけが入れ替わる。 */
   +'<div class="mini" style="margin-bottom:6px">配色</div><div class="throw">'
   +THEMES.map(function(t,i){var k=String(i+1);
     return '<button class="thbtn'+(themeNow()===k?' on':'')+'" data-act="theme" data-v="'+k+'"'
       +' aria-label="'+t[1]+'"><span class="thsw" data-theme="'+k+'"><i></i><b></b></span>'
       +'<span class="thnm">'+t[1]+'</span></button>';}).join('')
   +'</div>'
   +'<div class="hr"></div>'
   +'<div class="mini" style="margin-bottom:6px">演出（回答したときの見た目）</div><div>'
   +lvs.map(function(x){return '<button class="tog'+(lv===x[0]?' on':'')+'" style="margin:0 6px 6px 0" data-act="fxlv" data-v="'+x[0]+'">'+x[1]+'</button>'}).join('')
   +'</div>'
   +'<div class="hr"></div>'
   +'<div class="mini" style="margin-bottom:6px">音（正解・不正解・タップ。自作の合成音のみ）</div><div>'
   +'<button class="tog'+(ST.settings.sound?' on':'')+'" style="margin:0 6px 6px 0" data-act="snd" data-v="1">オン</button>'
   +'<button class="tog'+(ST.settings.sound?'':' on')+'" style="margin:0 6px 6px 0" data-act="snd" data-v="0">オフ</button>'
   +'</div>'
   +'<div class="mini">デフォルト＝毎問は軽く0.45秒、節目（5連続・章を解き切る・「難」を正解）で紙吹雪、'
   +'小分類を閉じた瞬間だけ最大。強＝毎問フル／弱＝マークと光だけ（約0.6秒）／なし＝すぐ解説。<br>'
   +'連続正解の最高記録 '+(ST.session.best||0)+' ／ 閉じた分野 '+Object.keys(ST.closedSeen||{}).length+'</div>'
   +'<div class="hr"></div>'
   +'<div class="mini">書き出し：下のテキストを全選択してコピー（メモ帳やメールに貼って保管）。</div>'
   +'<textarea id="ta" readonly>'+esc(json)+'</textarea>'
   +'<div class="rowx" style="gap:8px;margin:8px 0 14px"><button class="btn" data-act="selall">全選択</button>'
   +'<button class="btn" data-act="copy">コピー</button></div>'
   +'<div class="hr"></div>'
   +'<div class="mini">読み込み：保管したJSONを貼って「読み込む」。現在のデータは上書きされます。</div>'
   +'<textarea id="tb" placeholder=\'{"items":{...},"watched":{...},"session":{...}}\'></textarea>'
   +'<button class="btn pri" style="margin-top:8px" data-act="doimport">読み込む</button>'
   +'<div class="hr"></div>'
   +'<div class="mini">保存キー：takken_v1 ／ 全 '+n3(ITEMS.length)+'問（除外 '+n3(NEXCL)+'）／ 記録済 '+n3(Object.keys(ST.items).length)+'問</div>'
   +'<div class="mini">ホーム画面から起動 '+(standalone()?'はい':'いいえ（共有 → ホーム画面に追加）')
     +' ／ 永続化 '+(ST.settings.persist===true?'許可':(ST.settings.persist===false?'不許可':'—'))
     +' ／ 最後の書き出し '+(ST.settings.lastExport?esc(ST.settings.lastExport):'—')+'</div>'
   +'<button class="btn" style="margin-top:10px;color:var(--ngdeep);border-color:#f0c9c4" data-act="wipe">進行状況を全消去</button>'
   +'<div id="msg" class="mini" style="margin-top:10px"></div></div>';
  m6SheetOpen();
}
function msg(t){var e=document.getElementById('msg');if(e)e.textContent=t}
/* 記録をJSONのファイルにして共有シートへ渡す。iOSは navigator.share でファイルを扱える。
   使えない場合は既存のテキスト（全選択してコピー）に落とす。 */
/* ---------- GitHub（非公開リポジトリ）への記録バックアップ ----------
   置くのは学習記録だけ＝問題文・解説は含まない（著作権の対象にならない）。
   トークンは端末のlocalStorageのみ。公開しているコードには入れない。 */
var GHFILE='takken_records.json';
function GH(){var g=(ST.settings&&ST.settings.gh)||{};
  return {repo:g.repo||'',token:g.token||'',at:g.at||'',err:g.err||'',sha:g.sha||'',fp:g.fp||''}}
function ghSet(o){ST.settings.gh=Object.assign(GH(),o);saveST()}
function ghSave(){
  var r=document.getElementById('ghRepo'),t=document.getElementById('ghTok');
  var repo=(r&&r.value||'').trim(),tok=(t&&t.value||'').trim();
  if(repo&&!/^[\w.-]+\/[\w.-]+$/.test(repo)){msg('リポジトリは owner/repo の形で入れてください');return}
  var o={repo:repo,err:''};
  if(tok&&tok.indexOf('•')<0)o.token=tok;      /* 伏せ字のままなら変更しない */
  ghSet(o);msg('保存しました');dataSheet();
}
/* 非公開リポジトリから問題データを取り込む（2026-08-18 本人指示）。
   仕組みは殻の側（build_pwa の LOADER）にある＝アプリより先に動く必要があるため。
   ここはその呼び出し口。単体の app.html（配信前の確認用）には無いので、無ければ断る。 */
function dataPull(){
  var say=function(t){
    var e=document.getElementById('dpstat');
    if(e)e.textContent=t; else msg(t);
    try{console.log('[データ更新] '+t)}catch(e2){}
  };
  var b=document.getElementById('dpbtn');
  if(typeof window.TAKKEN_SYNC!=='function'){
    /* 殻（index.html）が古いキャッシュのまま＝もう一度開き直すと新しくなる */
    say('この版では使えません。いったん閉じて、もう一度開いてから押してください');return;
  }
  if(b)b.disabled=true;
  say('版を確認しています…');
  window.TAKKEN_SYNC(say).then(function(k){
    if(!k){say('最新です（落としたファイル0）');if(b)b.disabled=false;return}
    say(k+'ファイルを取り込みました。開き直します…');
    setTimeout(function(){location.reload()},700);
  }).catch(function(err){
    if(b)b.disabled=false;
    say('取り込めませんでした：'+((err&&err.message)||'不明'));
  });
}
function ghHeaders(){return {Authorization:'Bearer '+GH().token,Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28'}}
function b64(str){
  var u=new TextEncoder().encode(str),s='';
  for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);
  return btoa(s);
}
function unb64(b){
  var s=atob(b),u=new Uint8Array(s.length);
  for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
  return new TextDecoder().decode(u);
}
function ghErr(st){
  if(st===401)return 'トークンが違います（401）';
  if(st===403)return '権限が足りません（403・Contents の書き込みを許可）';
  if(st===404)return 'リポジトリかパスが見つかりません（404）';
  if(st===409)return '競合しました（409）。もう一度';
  if(st===422)return '中身を受け付けられませんでした（422）';
  return '通信に失敗しました（'+st+'）';
}
/* quiet=true なら画面には出さない（自動実行のとき） */
function ghPush(quiet){
  var g=GH();
  if(!g.repo||!g.token){if(!quiet)msg('リポジトリとトークンを先に保存してください');return Promise.resolve(false)}
  var url='https://api.github.com/repos/'+g.repo+'/contents/'+GHFILE;
  if(!quiet)msg('上げています…');
  /* いまの sha を取ってから上書きする（無ければ新規作成） */
  return fetch(url,{headers:ghHeaders(),cache:'no-store'})
    .then(function(res){return res.status===200?res.json():null})
    .then(function(cur){
      var body={message:'宅建の記録 '+nowStamp(),content:b64(stOut())};
      if(cur&&cur.sha)body.sha=cur.sha;
      return fetch(url,{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});
    })
    .then(function(res){
      if(!res.ok){ghSet({err:ghErr(res.status)});if(!quiet){msg(ghErr(res.status));dataSheet()}return false}
      return res.json().then(function(j){
        ghSet({at:nowStamp(),err:'',sha:(j.content&&j.content.sha)||''});
        if(!quiet){msg('上げました');dataSheet()}
        return true;
      });
    })
    .catch(function(){ghSet({err:'通信できませんでした'});if(!quiet){msg('通信できませんでした');dataSheet()}return false});
}
function ghPull(){
  var g=GH();
  if(!g.repo||!g.token){msg('リポジトリとトークンを先に保存してください');return}
  if(!confirm('GitHubの記録で、いまの記録を置き換えます。よろしいですか。'))return;
  msg('取ってきています…');
  fetch('https://api.github.com/repos/'+g.repo+'/contents/'+GHFILE,{headers:ghHeaders(),cache:'no-store'})
    .then(function(res){if(!res.ok)throw res.status;return res.json()})
    .then(function(j){
      var o=JSON.parse(unb64(j.content||''));   /* atob は空白と改行を無視するので取り除かなくてよい */
      if(!o||!o.items)throw 422;
      var keep=ST.settings.gh;                 /* 接続の設定は残す */
      ST=normST(o);ST.settings.gh=keep;saveST();
      msg('取り戻しました（'+Object.keys(ST.items).length+'問）');
      render();dataSheet();
    })
    .catch(function(st){msg(typeof st==='number'?ghErr(st):'読み込めませんでした')});
}
/* 記録の中身の指紋。前回上げた時から変わっていなければ上げない（無駄なコミットを作らない）。 */
/* 外に出す記録からは接続の設定（トークン）を必ず落とす。
   これを忘れると PAT が GitHub のコミットと共有ファイルに平文で載る（2026-08-15 批評）。 */
function stOut(){
  var c=JSON.parse(JSON.stringify(ST));
  if(c.settings&&c.settings.gh)delete c.settings.gh;
  return JSON.stringify(c);
}
function ghFP(){
  /* 問題の記録だけでなく、視聴の印・動画ごとの進捗・学習時間・日ごとの記録も見る。
     items だけだと「今日は動画を見ただけ」の日が丸ごと上がらない（2026-08-15 批評）。
     settings.gh は入れない（at が毎回変わって無限に上げてしまう）。 */
  /* **報告と模試も見る**（2026-08-21）。ここに入れないと「模試だけやった」「報告だけした」日が
     『中身が変わっていない』と判定されて自動で上がらない（実際に模試の結果が届かなかった）。 */
  var s2=JSON.stringify([ST.items||{},ST.watched||{},ST.vp||{},ST.tlog||{},ST.days||{},
                         ST.closedSeen||{},ST.reports||{},ST.mock||[]]),h=5381;
  for(var i=0;i<s2.length;i++){h=((h*33)^s2.charCodeAt(i))>>>0}
  return s2.length+'-'+h.toString(36);
}
/* 自動で上げる場面：
   ・起動したとき（タスクキル→開き直しでも上がる。2026-08-15 本人指定）
   ・完走したとき
   どちらも「前回から中身が変わっていれば」だけ実行する。 */
function ghAuto(reason){
  var g=GH();
  if(!g.repo||!g.token)return;
  if(!Object.keys(ST.items||{}).length)return;      /* 記録が無いなら何もしない */
  var fp=ghFP();
  if(g.fp===fp)return;                              /* 前回上げた時から変わっていない */
  ghPush(true).then(function(ok){if(ok)ghSet({fp:fp})});
}
function shareBackup(){
  var json=stOut(),name='takken_'+today()+'.json';
  try{
    var f=new File([json],name,{type:'application/json'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){
      navigator.share({files:[f],title:'宅建の記録'})
        .then(function(){markExport();msg('保存しました（'+name+'）')})
        .catch(function(){/* 取り消しは何も言わない */});
      return;
    }
  }catch(e){}
  /* 共有が使えない端末：ダウンロードを試し、それも無理ならテキストを出す */
  try{
    var url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    var a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(function(){URL.revokeObjectURL(url)},1000);
    markExport();msg('保存しました（'+name+'）');return;
  }catch(e){}
  msg('この端末では共有が使えません。下のテキストをコピーして保管してください。');
}

/* =========================================================
   演出（preview_effect6.html と同一。時間＝正解1.55s／不正解1.4s）
   参考＝ゲームUI演出の基本 https://gameanimation.info/archives/5603
   ========================================================= */
var FXST={streak:0,lost:0,cat:''},FXT=null,SADT=null,ANSLOCK=false,NEXTLOCK=false;
/* 設定：auto＝3段階（既定）／strong＝毎問フル／weak＝弱／off＝なし */
function fxLevel(){return (ST.settings&&ST.settings.fx)||'auto'}
function rnd(a,b){return a+Math.random()*(b-a)}
function launchHtml(n,isMax){
  var col=['#2fa37c','#e0b64a','#7fd0b0','#f2d98b','#4bbf95','#bfe6d5'],s='';
  for(var i=0;i<n;i++){
    var ang=rnd(-62,62),d=rnd(isMax?420:340,isMax?620:520),fall=rnd(620,860),
        dl=0.14+rnd(0,0.2),spin=rnd(-960,960),thin=(isMax&&i%3===0);
    s+='<div class="p" style="animation-delay:'+dl.toFixed(2)+'s;--fall:'+fall.toFixed(0)+'px">'
      +'<div class="dir" style="--ang:'+ang.toFixed(1)+'deg">'
      +'<div class="up" style="--d:'+d.toFixed(0)+'px;animation-delay:'+dl.toFixed(2)+'s">'
      +'<span class="pc'+(thin?' thin':'')+'" style="background:'+col[i%col.length]+';--spin:'+spin.toFixed(0)
      +'deg;animation-delay:'+dl.toFixed(2)+'s"></span></div></div></div>';
  }
  return '<div class="launch">'+s+'</div>';
}
function rainHtml(n){
  var s='';
  for(var i=0;i<n;i++)s+='<i style="left:'+rnd(6,94).toFixed(1)+'%;animation-delay:'+(0.12+rnd(0,0.45)).toFixed(2)+'s"></i>';
  return '<div class="rain">'+s+'</div>';
}
function debrisHtml(n){
  var s='';
  for(var i=0;i<n;i++)s+='<i style="--dx:'+rnd(-46,46).toFixed(0)+'px;--dy:'+rnd(160,260).toFixed(0)
    +'px;--spin:'+rnd(-420,420).toFixed(0)+'deg;animation-delay:'+rnd(0.4,0.6).toFixed(2)+'s"></i>';
  return '<div class="deb">'+s+'</div>';
}
/* 演出の段（価値に見合った派手さと頻度／同じ演出を毎回見せない）
   正解 lite＝毎問（0.45s・紙吹雪なし）／full＝節目（紙吹雪34片）／max＝小分類を閉じた瞬間（60片）
   不正解 badLite＝毎問（0.5s・雨と破片なし）／badFull＝重症のときだけ */
function pickTier(id,ok,ev){
  var lv=fxLevel();
  if(lv==='off')return 'off';
  if(lv==='weak')return ok?'weak':'badWeak';
  if(lv==='strong')return ok?'full':'badFull';
  if(ok){
    if(ev.closed)return 'max';                       /* 小分類を閉じた瞬間（1回だけ） */
    var sk=ST.session.streak||0;
    if(sk>=5&&sk%5===0)return 'full';                /* 連続正解が5の倍数 */
    if(ev.topicDone)return 'full';                   /* その論点の肢を全部解き終えた */
    if(d3(BY[id])==='難')return 'full';              /* 難しい問題（3段階の「難」＝D・E）を正解 */
    return 'lite';
  }
  return ev.severe?'badFull':'badLite';              /* 重症のときだけ雨・破片・暗さ */
}
function fxHtml(ok,tier){
  var h,mod=(tier==='lite'||tier==='badLite')?' lite':(tier==='max'?' max':((tier==='weak'||tier==='badWeak')?' weak':''));
  /* 紙吹雪・雨・破片を出す段は full／max（正解）と badFull（不正解・重症）だけ */
  var slim=!(tier==='full'||tier==='max'||tier==='badFull');
  if(ok){
    var sk=FXST.streak,hot=sk>=5;
    h='<div class="fx out ok'+mod+'">'+(slim?'':launchHtml(tier==='max'?60:34,tier==='max'))
     +'<div class="mid"><div class="mark"><div class="glow"></div>'
     +'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15.5"/></svg></div>';
    if(tier!=='lite'){
      h+=(sk>=2)?'<div class="cmb'+(hot?' hot':'')+'"><span class="n">'+sk+'</span><span class="t">連続正解</span></div>'
                :'<div class="word">正解</div>';
      if(tier==='max')h+='<div class="fixed"><div class="t1">この分野を閉じました</div>'
        +'<div class="t2">'+esc(FXST.cat)+' ／ 全問を2回以上正解</div></div>';
    }
    return h+'</div></div>';
  }
  h='<div class="fx out bad'+mod+'">';
  if(!slim)h+='<div class="shade"></div>'+rainHtml(11)+debrisHtml(6);
  h+='<div class="mid"><div class="mark"><svg viewBox="0 0 48 48">'
   +'<path d="M13 13l22 22"/><path class="p2" d="M35 13L13 35"/></svg></div>'
   +'<div class="word">不正解</div>';
  if(!slim&&FXST.lost>=2)h+='<div class="lost">連続 <s>'+FXST.lost+'</s> → 0</div>';
  return h+'</div></div>';
}
/* オーバーレイを外す時刻。各段のフェード終了（正解フル1.84s／最大2.04s）より必ず後にする */
var FXDUR={lite:600,full:1900,max:2100,weak:750,badLite:620,badFull:1900,badWeak:750};
function playFx(ok,tier){
  clearFx();
  if(!tier||tier==='off')return;
  var box=document.getElementById('fx');
  box.innerHTML=fxHtml(ok,tier);
  box.hidden=false;
  if(!ok){          /* 彩度と明るさだけ（filterのtransition＝座標に一切触らない） */
    setSad(true);
    var hold=(tier==='badFull')?750:400;
    SADT=setTimeout(function(){setSad(false)},hold);
  }
  FXT=setTimeout(clearFx,FXDUR[tier]||1500);
}
function setSad(on){
  ['view','tabs'].forEach(function(idv){
    var e=document.getElementById(idv);
    if(e)e.style.filter=on?'saturate(.2) brightness(.93)':'';
  });
}
function clearFx(){
  if(FXT){clearTimeout(FXT);FXT=null}
  if(SADT){clearTimeout(SADT);SADT=null}
  var box=document.getElementById('fx');
  box.innerHTML='';box.hidden=true;
  setSad(false);
}
/* 入力確認（0.12s）：押した要素をその場で沈ませる */
function tapFx(el){
  if(!el||!el.classList)return;
  el.classList.remove('tapfx');void el.offsetWidth;el.classList.add('tapfx');
  setTimeout(function(){if(el.classList)el.classList.remove('tapfx')},140);
}

/* ---------- 操作 ---------- */
function doAnswer(userOx){
  var id=S.queue[S.qi];if(!id||S.phase!=='q')return;
  var it=BY[id],tKey=(it.topic||'未分類'),sibs=itemsOfTopic(it.cat,tKey);
  /* 演出の段を決めるため、回答前の状態を控える */
  var wasClosed=closed(it.cat);
  var doneBefore=sibs.every(function(x){return att(R(x.id))>0});
  S.ansSnap=snapAns(id);          /* 送信＝パスで戻せるように、答える前を控える */
  S.res=answer(id,userOx);S.phase='exp';
  /* この回ぶんの答えを控える。前の問題へ戻ったときに解説を出し直すのに使う
     （2026-08-17 本人指示「答えた後に前の問題にも戻れるように」）。 */
  /* 番号だけで持つと、別のセッションの控えが同じ番号で残って解説が先に出る
     （2026-08-18 本人報告「抜き打ちで解答が既に出ている」「次の問題で解説が出る」）。
     問題idを一緒に控え、取り出すときに一致を確かめる。 */
  S.ansLog=S.ansLog||{};S.ansLog[S.qi]={id:id,res:S.res};
  S.broke=(!S.res.ok&&FXST.lost>=2);
  var r=R(id),ev={closed:false,topicDone:false,severe:false};
  if(S.res.ok){
    if(closed(it.cat)&&!wasClosed&&!ST.closedSeen[it.cat]){
      ev.closed=true;ST.closedSeen[it.cat]=today();saveST();
      S.closedCat=it.cat;      /* 確定表示は完走リザルトの後に単独で出す（M5） */
    }
    ev.topicDone=(!doneBefore&&sibs.every(function(x){return att(R(x.id))>0}));
  }else{
    /* 演出の「重症」も判定と揃える。同じ章で2問ミスした程度で暗い演出は出さない。 */
    ev.severe=severeItem(id);
  }
  FXST.cat=it.cat;
  S.tier=pickTier(id,S.res.ok,ev);S.ev=ev;
  /* 効果音（既定オフ）。節目は少し遅らせて重ねる */
  M2.sfx(S.res.ok?'ok':'ng');
  if(S.res.ok&&(S.tier==='full'||S.tier==='max'))setTimeout(function(){M2.sfx('combo')},170);
  /* ホームへ戻ったときに、解いた小分類のマスを1回だけ膨らませる（卒業なら金の枠） */
  S.bump={cat:it.cat,stage:catStat(it.cat).lv,grad:(stateOf(id)==='卒業'&&S.res.ok)};
  saveRun();         /* 中断しても続きから解けるように lastAt を更新 */
  S.anim='exp';      /* 解説の中だけを段差で出す（問題文は動かさない） */
  /* まずはDOMを作り直さない差分更新を試す。できなければ通常の描画に落とす。 */
  if(!applyExpDom(it,id))render();
  S.anim=null;
  syncNextBar();          /* 差分更新（applyExpDom）は render を通らないのでここでも合わせる */
  scrollToAnsline();      /* 正誤の行を画面の上へ＝押した直後に○×と解説の頭が目に入る */
  playFx(S.res.ok,S.tier);
}
/* 「次の問題」＝今のカードを上へ8pxフェードアウト（0.16s）→ 次のカードが下から入る */
/* 控えてある答え。**いま並んでいる問題と id が一致したときだけ**返す。
   一致を見ないと、別のセッションの控えが同じ番号で残っていて解説が先に出る。 */
function ansLogAt(i){
  var lg=(S.ansLog||{})[i];
  if(!lg)return null;
  if(!lg.id||lg.id!==S.queue[i]){delete S.ansLog[i];return null}
  return lg.res;
}
function next(){
  if(NEXTLOCK)return;
  var w=document.querySelector('.qwrap');
  if(w){
    NEXTLOCK=true;
    w.classList.add('qout');
    setTimeout(function(){NEXTLOCK=false;advance()},160);
    return;
  }
  advance();
}
function advance(){
  clearFx();
  S.qi++;S.broke=false;
  /* 前へ戻ったあと進むときは、控えてある答えを出し直す（また答えさせない） */
  var lg=ansLogAt(S.qi);
  if(lg){S.res=lg;S.phase='exp'}else{S.phase='q';S.res=null}
  if(S.qi>=S.queue.length){
    /* 抜き打ちは「解き終えたとき」に今日の印を付ける（開始時に付けると、途中でやめただけで
       その日の抜き打ちが失われる。途中でやめたら印は付かない＝またできる。2026-08-15 批評）。 */
    if(S.kind==='sneak'){var ds=ST.days[today()]||{n:0,ok:0};ds.sneak=1;ST.days[today()]=ds;saveST()}
    /* 完走。間違いが残っていなくて動画を仕上げていたら「この動画は完了」を記録する */
    if(!S.wrongs.length&&S.roundVid){
      var vp2=vpOf(S.roundVid);
      if(videoStat(S.roundVid).done&&!vp2.completedAt)vp2.completedAt=today();
    }
    /* チェックの回を最後まで解き切った＝ホームから消す（本人指示 2026-08-18）。
       解き直したいときは、私が次の回を配信すれば別の dataAt で再び出る。 */
    if(S.checkAt){
      if(!ST.checkDone)ST.checkDone={};
      ST.checkDone[S.checkAt]=today();
      S.checkAt='';saveST();
    }
    closeRunClock();     /* dropRun で ST.run が消える前に、かかった時間を確定させる */
    dropRun();S.anim=null;M2.sfx('clear');render();return;
  }
  saveRun();
  S.anim='card';
  render();
}
document.addEventListener('click',function(e){
  /* 演出中のタップは常に「即終了」。リザルトの3ボタンだけは、終了させた上で処理も進める */
  if(M5.running()){
    M5.skip();
    if(!(e.target.closest&&e.target.closest('#m5-result .rbtns')))return;
  }
  /* 「この分野を閉じた」の確定表示は、画面のどこをタップしても閉じる（ボタンを置かない） */
  var cl=document.getElementById('m5-closed');
  if(cl&&!cl.hidden){M5.closeAll();render();return}
  var t=e.target.closest?e.target.closest('[data-act]'):null;
  if(!t)return;
  /* リザルトの上のボタンは、閉じてから既存処理へ流す */
  if(t.closest&&t.closest('.m5-ov'))M5.closeAll();
  var a=t.getAttribute('data-act');
  /* <summary> の中のボタン・リンクは、既定の開閉を起こさずにその操作だけを行う */
  if(a!=='openchap'&&t.closest&&t.closest('summary'))e.preventDefault();
  tapFx(t);                                  /* すべてのボタンに入力確認を返す */
  if(a!=='ans')M2.sfx('tap');                /* ○×は ok/ng を鳴らすので除く */
  if(a==='tab'){
    var v=t.getAttribute('data-v');
    /* 学習カードから分野選択へ戻るときは逆再生（ヘッダー→もとのマス） */
    if(v==='fields'&&S.view==='study'&&m1Back())return;
    /* タブは横方向。進む＝左から／戻る＝右から */
    var oi=-1,ni=-1;
    TABS.forEach(function(x,i){
      if(x[0]===v)ni=i;
      if(x[0]===((S.view==='study')?'fields':S.view))oi=i;
    });
    S.dir=(oi>=0&&ni>=0)?(ni>oi?'fwd':(ni<oi?'bwd':null)):null;
    go(v);return;
  }
  if(a==='runResume'){resumeRun(false);return}
  if(a==='runRestart'){resumeRun(true);return}
  if(a==='runDrop'){
    if(!confirm('解きかけのセッションを破棄します。問題ごとの履歴は残ります。'))return;
    closeRunClock();      /* 破棄でも、それまでに解いていた時間は実測に残す */
    dropRun();S.queue=[];S.qi=0;go('home');return;
  }
  /* 学習タブの入口の切り替え（動画で進む／単元で進む）。次に開いたときも同じ側を出す */
  if(a==='fmode'){
    var fm=(t.getAttribute('data-v')==='cat')?'cat':'video';
    if(S.fmode===fm)return;
    S.fmode=fm;ST.settings.fmode=fm;saveST();
    S.dir=null;go('fields');return;
  }
  if(a==='cat'){S.studyVid=null;m1ToStudy(t,t.getAttribute('data-c'));return}
  /* 一覧の動画の行＝その動画1本の画面（章と問題）へ */
  if(a==='vid'){
    var tv=t.getAttribute('data-v'),tc=catOfVid(tv);
    if(!tc)return;
    S.fieldsY=window.scrollY||0;S.ucat=false;
    S.studyVid=tv;m1ToStudy(t,tc);return;
  }
  /* 単元の行 → 単元ページ。画面を新設せず vStudy を単元向けに分岐させる
     （vStudy は元から studyVid が無いとき小分類を出す作りなので、そこに乗せる）。
     戻ったとき一覧の同じ位置に戻す＝拾う作業は「下まで見る→入る→戻る→次」の繰り返しで、
     先頭へ跳ぶと下の単元に指が届かない（2026-08-17）。 */
  if(a==='ucat'){
    var uc=t.getAttribute('data-c');
    if(!uc)return;
    S.fieldsY=window.scrollY||0;
    S.studyVid=null;S.ucat=true;m1ToStudy(t,uc);return;
  }
  if(a==='ufilt'){S.urest=(t.getAttribute('data-v')==='rest');S.fieldsY=0;render();return}
  /* 0問の章の開閉（動画ページ）。開くとタイムスタンプの順のその場に戻る。 */
  if(a==='zerochap'){var zv=t.getAttribute('data-v');
    m6FlipRender(function(){S.openZero[zv]=!S.openZero[zv];S.enter=false;render()});return}
  /* 大分類まるごとの残り。本人が明示的に押した範囲なので未習フィルタは通さない。 */
  if(a==='ubrest'){
    var ub=t.getAttribute('data-b');
    var ua=[];catsOfBig(ub).forEach(function(c){
      itemsOfCat(c).forEach(function(it){ua.push(it)})});
    if(!restOnly(ua).length)return;
    var uv=catBaseVid(catsOfBig(ub)[0],ub);
    S.kind='new';m1ToQuiz(t,function(){
      S.pickExplicit=true;S.pendBig=ub;startQueue(restOnly(ua),ub+'の残り',false,uv);
      S.roundCat=null;S.roundSub=null;});
    return;
  }
  /* 一覧の開閉・並び替えは FLIP で（消える行はゴースト・残る行は移動・入る行はフェードイン）。
     S.enter=false は必須＝既存の .viewin/.stag と入場アニメを重ねない（M3_depth.md §6-5） */
  if(a==='other'){var ob=t.getAttribute('data-b');
    m6FlipRender(function(){S.openOther[ob]=!S.openOther[ob];S.enter=false;render()});return}
  /* 畳んだ完了分（済み N本）の開閉 */
  if(a==='vdone'){var db=t.getAttribute('data-b');
    m6FlipRender(function(){S.openDone[db]=!S.openDone[db];S.enter=false;render()});return}
  /* ホームの「まず1本目の動画から」＝その動画の動画学習の画面へ直行する */
  if(a==='firstvid'){var fvid=t.getAttribute('data-v'),fc=catOfVid(fvid);if(fc){S.studyVid=fvid;m1ToStudy(t,fc)}return}
  if(a==='big'){var b=t.getAttribute('data-b');
    m6FlipRender(function(){S.openBig[b]=!S.openBig[b];S.enter=false;render()});return}
  if(a==='opencat'){var c=t.getAttribute('data-c');S.openCat[c]=!S.openCat[c];render();return}
  if(a==='fcat'){var c2=t.getAttribute('data-c'),i=F.cats.indexOf(c2);if(i<0)F.cats.push(c2);else F.cats.splice(i,1);render();return}
  if(a==='ftopic'){var k=t.getAttribute('data-k'),j=F.topics.indexOf(k);if(j<0)F.topics.push(k);else F.topics.splice(j,1);render();return}
  if(a==='fdif'){var d=t.getAttribute('data-d'),m=F.difs.indexOf(d);if(m<0)F.difs.push(d);else F.difs.splice(m,1);render();return}
  if(a==='ftog'){var kk=t.getAttribute('data-k');F[kk]=!F[kk];render();return}
  if(a==='fset'){var k2=t.getAttribute('data-k'),v2=+t.getAttribute('data-v');F[k2]=(F[k2]===v2)?(k2==='rateMax'?null:0):v2;render();return}
  if(a==='fclear'){F.wrong=false;F.ngMin=0;F.recent=0;F.star=false;F.unseen=false;F.rateMax=null;F.difs=[];F.cats=[];F.topics=[];render();return}
  if(a==='togFilter'){S.openFilter=!S.openFilter;render();return}
  if(a==='togchaps'){S.openChaps=!S.openChaps;render();return}
  if(a==='togsrc'){srcSheet(S.queue[S.qi]);return}
  if(a==='sort'){var so=t.getAttribute('data-s');
    m6FlipRender(function(){S.sort=so;S.enter=false;render()});return}
  /* 動画・章のリンクを押した時点で視聴として記録する（手でチェックを付けさせない）。
     リンクの既定動作（新しいタブで開く）を止めないよう、描画は次のタスクに回す。 */
  if(a==='vwatch'){
    var wk=t.getAttribute('data-k');
    if(wk&&!ST.watched[wk]){ST.watched[wk]=today();saveST()}
    /* 視聴の実測を開始（アプリに戻ってきた時点との差を watchMs に積む） */
    if(wk)watchStart(String(wk).split('#')[0]);
    /* 一覧から「動画を見る」を押したときも、次の1本と「ここまでで解ける」を数え直す */
    setTimeout(function(){if(S.view==='study'||S.view==='fields')render()},0);
    return;
  }
  /* 章の開閉は <details> が自分でやる（state は toggle で写す）。ここでは何もしない */
  if(a==='openchap'){return}
  if(a==='basesrc'){S.baseVid=null;S.baseSrc=t.getAttribute('data-v')||DEFSRC;render();return}
  if(a==='star'){var sid=t.getAttribute('data-id'),r=mk(sid);r.star=!r.star;saveST();render();return}
  /* 押した感（0.12s）が演出より先に返るように、判定は入力確認の後 */
  if(a==='ans'){
    if(ANSLOCK)return;
    ANSLOCK=true;
    var o=t.getAttribute('data-o')==='1';
    setTimeout(function(){ANSLOCK=false;doAnswer(o)},120);
    return;
  }
  if(a==='fxlv'){ST.settings.fx=t.getAttribute('data-v');saveST();dataSheet();return}
  if(a==='snd'){
    ST.settings.sound=(t.getAttribute('data-v')==='1');
    saveST();M2.setSound(ST.settings.sound);
    if(ST.settings.sound)M2.sfx('ok');        /* 切り替えた場所で1回鳴らして確認できる */
    dataSheet();return;
  }
  if(a==='pass'){next();return}
  /* 前の問題へ戻る（答える前でも答えた後でも）。控えがあれば解説つきで、無ければ問題のまま。
     記録は動かさない＝戻って眺めるだけ（2026-08-17 本人指示）。 */
  if(a==='prevq'){
    if(S.qi<=0)return;
    clearFx();S.qi--;
    var pl=ansLogAt(S.qi);
    if(pl){S.res=pl;S.phase='exp'}else{S.res=null;S.phase='q'}
    S.anim=null;S.enter=false;render();window.scrollTo(0,0);return;
  }
  if(a==='next'){next();return}
  if(a==='startCheck'){startCheck(t.getAttribute('data-at')||'');return}
  if(a==='startMock'){startMock(+(t.getAttribute('data-n')||0));return}
  if(a==='resumeMock'){resumeMock();return}
  if(a==='mkrev'){S.mockRev=+(t.getAttribute('data-i')||0);render();return}
  if(a==='mkans'){mockAnswer(+(t.getAttribute('data-k')||0));return}
  if(a==='datapull'){dataPull();return}
  if(a==='dreload'){location.reload();return}
  /* 版が変わったらホームを描き直す（チェックの行の出し入れがすぐ効くように） */
  /* 記録のリセット。押し間違いは戻せないので、必ず件数を出して確認を取る。 */
  if(a==='vreset'){vResetAsk(t.getAttribute('data-v'));return}
  if(a==='vresetgo'){vResetGo(t.getAttribute('data-v'));return}
  if(a==='why'){applyWhy(t.getAttribute('data-id'),t.getAttribute('data-w'));render();return}
  /* データの間違いの報告。同じものをもう一度押したら取り消し。 */
  /* 選んだだけでは保存しない＝**送信で確定**（2026-08-18 本人の設計）。 */
  if(a==='rep'){
    var ri=t.getAttribute('data-id'),rw=t.getAttribute('data-w');
    var d=(S.repDraft&&S.repDraft.id===ri)?S.repDraft:{id:ri,tags:[],memo:''};
    var mi=document.getElementById('repmemo');
    if(mi)d.memo=mi.value||'';        /* 打ちかけのコメントを消さない */
    var k=d.tags.indexOf(rw);
    if(k>=0)d.tags.splice(k,1);else d.tags.push(rw);
    S.repDraft=d;render();return;
  }
  /* 送信＝報告を確定し、**この1問をパスにする**（記録を取り消して未解答に戻す）。
     報告した内容を一瞬見せてから次の問題へ（2026-08-18 本人了承）。 */
  if(a==='repsend'){
    var si=t.getAttribute('data-id');
    var d2=(S.repDraft&&S.repDraft.id===si)?S.repDraft:{id:si,tags:[],memo:''};
    var mi2=document.getElementById('repmemo');
    if(mi2)d2.memo=mi2.value||'';
    /* 選択が無くてもコメントがあれば送れる（本人指示 2026-08-18）。両方空のときだけ断る。 */
    if(!d2.tags.length&&!String(d2.memo||'').trim()){
      msg('選ぶか、コメントを書いてください');return;
    }
    S.repDraft=d2;
    if(!ST.reports)ST.reports={};
    ST.reports[si]={tags:d2.tags.slice(),memo:d2.memo||'',at:nowStamp()};
    if(S.ansSnap&&S.ansSnap.id===si)undoAns(S.ansSnap);else saveST();
    S.ansSnap=null;S.repDraft=null;
    if(S.ansLog)delete S.ansLog[S.qi];        /* 戻ったときに解説を出さない＝未解答に戻す */
    /* 報告は**送った直後に上げる**（本人指示 2026-08-18）。起動時と完走時だけだと、
       私が報告を読めるのが遅れて、直しの往復が伸びる。 */
    try{ghAuto('report')}catch(e3){}
    msg('報告しました'+(d2.tags.length?'（'+d2.tags.join('・')+'）':'（コメント）')
        +'／この問題はパス＝まだ解いてない問題に戻します');
    setTimeout(function(){next()},900);
    return;
  }
  if(a==='repcopy'){
    var ta=document.getElementById('repta');
    if(ta){ta.focus();ta.setSelectionRange(0,ta.value.length);
      try{document.execCommand('copy')}catch(e){}
      msg('コピーしました。チャットに貼ってください。');}
    return;
  }
  if(a==='repclear'){ST.reports={};saveST();dataSheet();return}
  if(a==='repsheet'){repSheet(t.getAttribute('data-id'));return}
  if(a==='repmemo')return;      /* メモは下の change で拾う（押しただけでは再描画しない） */
  if(a==='rsess'){if(confirm('ヘッダーの成績（このセッションの集計）をリセットします。問題ごとの履歴は消えません。'))
    {ST.session={total:0,right:0,streak:0,best:ST.session.best||0};
     S.sT=0;S.sR=0;S.sStreak=0;S.sBest=0;saveRun();saveST();render()}return}
  if(a==='togstat'){S.openStat=!S.openStat;render();return}
  /* ホーム画面に追加の案内を閉じる（二度出さない） */
  if(a==='a2hsOK'){ST.settings.a2hs=true;saveST();render();return}
  if(a==='setmin'){ST.settings.min=+t.getAttribute('data-v')||120;saveST();render();return}
  if(a==='setexam'){
    var v=document.getElementById('sExam');
    if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v.value)){ST.settings.exam=v.value;saveST();dataSheet();msg('試験日を保存しました')}
    else msg('日付の形式が違います');
    return;
  }
  if(a==='setminutes'){
    var m1=document.getElementById('sMin'),m2=document.getElementById('sVmin');
    if(m1&&+m1.value>=10)ST.settings.min=Math.round(+m1.value);
    if(m2&&+m2.value>=0)ST.settings.vmin=Math.round(+m2.value);
    saveST();dataSheet();msg('保存しました（1日 '+n3(dayCap())+'問）');return;
  }
  if(a==='later'){ST.settings.later=!ST.settings.later;saveST();render();return}
  /* 未習の範囲も出す（既定＝オフ。オフのときは need_seq が見た動画の番号を超える問題を出さない） */
  if(a==='ahead'){ST.settings.ahead=(t.getAttribute('data-v')==='1');saveST();dataSheet();return}
  /* 問題データの入れ直し。アプリの中で完結させる（Safariに戻らせない） */
  if(a==='reimport'){location.hash='import';location.reload();return}
  /* 記録をファイルにして共有シートへ。使えない端末は下のテキスト方式に落ちる */
  if(a==='share'){shareBackup();return}
  if(a==='ghsave'){ghSave();return}
  if(a==='ghpush'){ghPush(false);return}
  if(a==='ghpull'){ghPull();return}
  /* 配色の切替。色だけを入れ替えるので、開いている画面はそのままでよい */
  if(a==='theme'){var tv=t.getAttribute('data-v');if(/^[1-9]$/.test(tv)){ST.settings.theme=tv;saveST();
    applyTheme();dataSheet();}return}
  if(a==='srcf'){var sv=t.getAttribute('data-v');S.srcF=sv||null;render();return}
  /* 分析の「動画」ボタン＝その大分類の動画の一覧へ。単元側を開いていると行き先が無いので
     このときだけ動画側に切り替える。記録（settings.fmode）は書き換えない
     ＝寄り道であって「動画で進む」に変えた訳ではない（次に開いたときは本人の設定に戻る）。 */
  if(a==='gobig'){var gb=t.getAttribute('data-b');S.fmode='video';S.openBig={};S.openBig[gb]=true;go('fields');return}
  /* 新規は「デフォルト」の出題順（need_seq 昇順→章の秒数→難易度）で解く。
     need_seq が無い古いデータのときだけ従来の「章のタイムライン順」に落とす。 */
  if(a==='startNew'){S.round=0;S.kind='new';S.sort=NEEDOK?'std':'timeline';startQueue(newQueue(plan().newN),'新規',false);return}
  if(a==='startSneak'){
    if(sneakDone()){msg&&msg('今日の抜き打ちは終わっています');return}
    S.round=0;S.kind='sneak';var sq=plan().sneak;
    if(!sq.length)return;
    /* 「今日は済」の印は完走したときに付ける（advance()）。ここで付けると、誤タップや
       ホームに戻っただけで1問も解かずにその日の抜き打ちが消えていた（2026-08-15 批評）。 */
    startQueue(sq,'抜き打ち',false,null,true);
    sq.forEach(function(it){S.sneak[it.id]=true});   /* 画面に「抜き打ち」の印を出す */
    render();return;
  }
  if(a==='startWrong'){S.round=0;S.kind='review';startQueue(wrongToday(),'今日の間違い',false);return}
  if(a==='startWrongAll'){S.round=0;S.kind='review';startQueue(wrongPool(),'間違い',false);return}
  if(a==='startWrongVid'){
    var wv3=t.getAttribute('data-v');
    S.round=0;S.kind='review';S.pickExplicit=true;
    m1ToQuiz(t,function(){startQueue(wrongInVid(wv3),(vlab(wv3)||'この動画')+' の間違い',false,wv3);
      S.roundVid=wv3});
    return;
  }
  if(a==='startWrongChap'){
    var wc3=t.getAttribute('data-v'),ws3=+t.getAttribute('data-s'),wl3=t.getAttribute('data-l')||'章';
    S.round=0;S.kind='review';S.pickExplicit=true;
    m1ToQuiz(t,function(){startQueue(wrongInChap(wc3,ws3),wl3+' の間違い',false,wc3);
      S.roundVid=wc3;S.roundSec=ws3});
    return;
  }
  if(a==='startWrongBig'){
    var wbg=t.getAttribute('data-b');
    S.round=0;S.kind='review';startQueue(wrongPool().filter(function(it){return it.big===wbg}),wbg+' の間違い',false);return;
  }
  /* 本人が範囲を選んだ入口は未習フィルタを通さない（pickExplicit）。
     通していたせいで、絞り込みで権利関係を選ぶと0問になっていた（2026-08-15 批評）。 */
  if(a==='startFilter'){S.kind='review';S.pickExplicit=true;startQueue(filtered(),'絞り込み');return}
  if(a==='startSel'){S.kind='new';S.pickExplicit=true;startQueue(selItems(),'選択範囲');return}
  if(a==='startAll'){S.kind='new';S.pickExplicit=true;startQueue(ITEMS,'全範囲');return}
  /* ここまでで解ける＝視聴済みの範囲で解ける未着手をまとめて解く（出題順はデフォルト＝need_seq 昇順） */
  if(a==='startCum'){
    var cb=t.getAttribute('data-b'),cl=cumItems(cb);
    if(!cl.length)return;
    S.round=0;S.kind='new';S.roundVid=null;S.sort='std';
    m1ToQuiz(t,function(){startQueue(cl,'ここまでで解ける',false)});
    return;
  }
  if(a==='startCat'){
    var cc=t.getAttribute('data-c');
    /* 章・動画と揃えて未着手だけ（2026-08-15 の見直しで漏れていた） */
    /* 小分類から解くときも基準の動画を渡す（渡さないと解禁判定で全部落ちて0問になる。
       章・動画は渡していたのにここだけ抜けていた＝2026-08-15 批評で判明）。
       基準の動画は catBaseVid() で選ぶ＝その小分類と同じ科目の動画に限る。
       動画が無い小分類もあるので、科目そのものを基準にする S.pendBig を併用する。 */
    var cbb=CINFO[cc]?CINFO[cc].big:null;
    /* 2026-08-17：単元から解くときは**基準の動画を渡さない**。渡すとその1本の中の秒で並び、
       その動画に載っていない肢が全部うしろへ回る。単元は複数の動画にまたがる（中央3本）ので、
       あこ課長の習う順（通し番号→秒）で並べたい＝sortQ の S.baseVid なし の道を通す。
       解禁は S.pendBig（科目そのもの）で足りる＝基準の動画は解禁のために要らない。 */
    var cbv=null;
    /* startQueue が冒頭で roundCat を落とすので、印は**呼んだ後**に付ける（startChap と同じ形） */
    S.kind='new';m1ToQuiz(t,function(){S.pendBig=cbb;startQueue(pickRest(itemsOfCat(cc),t),cc,false,cbv);
      S.roundCat=cc;S.roundSub=null;});return;
  }
  /* 単元の中の小見出し（字幕で割った区切り）から解く。本人が範囲を選んだ入口なので
     未習フィルタは通さない（pickExplicit）。基準の動画＝その小見出しが載っている動画。 */
  if(a==='startSub'){
    var su=t.getAttribute('data-c'),si=+t.getAttribute('data-i');
    var sg=(catSubs(su)||{}).subs[si];
    if(!sg)return;
    var sl=sg.ids.map(function(x){return BY[x]}).filter(Boolean);
    if(!sl.length)return;
    /* 基準の動画（sg.vid）は こざりえ＝1本1科目なので、科目が食い違うことがある。
       解禁は pickExplicit で外れるが、保険として科目基準も同じ1回だけ渡しておく。 */
    var sb=CINFO[su]?CINFO[su].big:null;
    S.kind='new';m1ToQuiz(t,function(){
      S.pickExplicit=true;S.pendBig=sb;startQueue(pickRest(sl,t),usubLab(sg),false,sg.vid);
      S.roundCat=su;S.roundSub=si;      /* 完走時に「次の小見出しへ／次の単元へ」を出すため */
    });return;
  }
  /* 単元・小見出しを完走したあとの「次」。動画側の nextchap と対になる、単元側の導線。
     data-i があれば同じ単元の次の小見出し、無ければ次の単元。 */
  if(a==='nextcat'){
    var uc=t.getAttribute('data-c'),ui=t.getAttribute('data-i');
    if(!uc||!CINFO[uc]){go('fields');return}
    var ubg=CINFO[uc].big,uv=catBaseVid(uc,ubg);
    S.round=0;S.kind='new';
    if(ui===null||ui===''){
      m1ToQuiz(t,function(){
        S.pendBig=ubg;startQueue(restOnly(itemsOfCat(uc)),uc,false,uv);
        S.roundCat=uc;S.roundSub=null;
      });
      return;
    }
    var ug=(catSubs(uc)||{subs:[]}).subs[+ui];
    if(!ug){go('fields');return}
    var ul=ug.ids.map(function(x){return BY[x]}).filter(Boolean);
    if(!ul.length){go('fields');return}
    m1ToQuiz(t,function(){
      S.pickExplicit=true;S.pendBig=ubg;startQueue(restOnly(ul),usubLab(ug),false,ug.vid);
      S.roundCat=uc;S.roundSub=+ui;
    });
    return;
  }
  if(a==='startTopic'){
    var c3=t.getAttribute('data-c'),t3=t.getAttribute('data-t');
    /* 章（小分類の中の章）も本人が選んだ範囲なので未習フィルタを通さない */
    S.kind='review';m1ToQuiz(t,function(){S.pickExplicit=true;startQueue(itemsOfTopic(c3,t3||'未分類'),t3||'未分類')});return;
  }
  /* 動画単位でまとめて解く＝その動画の章の秒数の昇順（基準の動画＝この動画） */
  if(a==='startVid'){
    var vv=t.getAttribute('data-v');
    m1ToQuiz(t,function(){
      S.sort='timeline';S.round=0;S.kind='new';S.roundVid=vv;
      startQueue(pickRest(videoItemsUp(vv),t),VTIT[vv]||vv,true,vv);   /* 既定は未着手だけ・data-all で全部 */
      S.roundSec=null;                     /* 動画まるごとなので章の続きではない */
    });return;
  }
  /* 間違い直しの周回（間隔なし・当日中・全問正解するまで） */
  if(a==='round'){
    if(!S.wrongs.length)return;
    S.kind='review';                                 /* 間違い直しの時間は「復習」に積む */
    S.round=(S.round||0)+1;
    if(S.roundVid){var vp=vpOf(S.roundVid);vp.round=S.round;saveST()}
    /* 第6引数 keepRound=true ＝ startQueue で周回数を0に戻さない（周回を続ける唯一の呼び出し） */
    startQueue(S.wrongs.map(function(i){return BY[i]}).filter(Boolean),'間違い直し '+S.round+'周目',false,S.baseVid,false,true);
    return;
  }
  if(a==='nextchap'){
    var ns=+t.getAttribute('data-s'),nvid=S.roundVid;
    var nch=nextChap(nvid,S.roundSec);
    if(!nch||isNaN(ns)){go('home');return}
    var nlab=chapRowLab(nvid,nch.sec,nch.label);   /* 出題の見出しも章の行と同じ名前にそろえる */
    S.round=0;S.kind='new';S.sort='timeline';
    ST.lastChap={vid:nvid,sec:ns,label:nlab||'章'};saveST();   /* ホームの「続き」の起点を進める */
    m1ToQuiz(t,function(){
      startQueue(restOnly(chapItemsUp(nvid,ns)),nlab||'章',true,nvid);
      S.roundSec=ns;
    });
    return;
  }
  if(a==='nextvid'){
    var nv=t.getAttribute('data-v');
    if(!nv){var nx2=S.roundVid?nextVid(S.roundVid):null;nv=nx2&&nx2.vid}
    if(!nv){go('fields');return}
    /* 完了を記録してから次の動画の1問目へ */
    if(S.roundVid){var p2=vpOf(S.roundVid);if(videoStat(S.roundVid).done&&!p2.completedAt){p2.completedAt=today();saveST()}}
    S.round=0;S.kind='new';S.roundVid=nv;S.studyVid=nv;S.sort='timeline';
    var cat2=null;
    Object.keys(CHAP).forEach(function(c){if(cat2)return;if((CHAP[c]||[]).some(function(v){return v.vid===nv}))cat2=c});
    if(cat2)S.cat=cat2;
    startQueue(restOnly(videoItemsUp(nv)),VTIT[nv]||nv,true,nv);   /* 解き済みを頭から出さない */
    return;
  }
  if(a==='startChap'){
    var cv=t.getAttribute('data-v'),cs2=+t.getAttribute('data-s'),cl=t.getAttribute('data-l');
    /* 既定は未着手だけ。「全 N問」を押したときは解いた分も含めて全部（2026-08-15 本人指摘）。 */
    ST.lastChap={vid:cv,sec:cs2,label:cl||'章'};saveST();      /* ホームの「続き」の起点にする */
    /* 章から解くときも、その章が載っている小分類の科目を解禁する。
       基準の動画（cv）の科目だけでは足りない。こざりえは1本＝1科目なので、
       たとえば「税・価格」1本の中に 税に関する法令 と 不動産価格の評定 が同居しており、
       固定資産税の章（肢は全部「税に関する法令」）を押しても
       bigOfVid(cv)＝不動産価格の評定 しか解禁されず 0問になっていた。
       2026-08-15 に startCat で塞いだのと同じ穴が、ここに残っていた
       （2026-08-16 実測：いまのデータで49行、判定を当てると69行が0問になる）。
       本人が章を選んで押している＝明示の選択なので、その科目は解禁してよい。 */
    var chb=(S.cat&&CINFO[S.cat])?CINFO[S.cat].big:null;
    S.kind='new';m1ToQuiz(t,function(){
      S.pendBig=chb;
      startQueue(pickRest(chapItemsUp(cv,cs2),t),cl||'章',true,cv);
      S.roundSec=cs2;                      /* 完走時に「次の章へ」を出すため */
    });return;
  }
  if(a==='again'){S.qi=0;S.phase='q';S.res=null;saveRun(true);S.anim='card';S.enter=true;render();return}
  if(a==='data'){dataSheet();return}
  if(a==='closeModal'){m6SheetClose(0,function(){render()});return}
  if(a==='selall'){var ta=document.getElementById('ta');ta.focus();ta.setSelectionRange(0,ta.value.length);
    markExport();msg('全選択しました。長押し→コピーでも取れます。');return}
  if(a==='copy'){var ta2=document.getElementById('ta');ta2.focus();ta2.setSelectionRange(0,ta2.value.length);
    var okc=false;try{okc=document.execCommand('copy')}catch(err){okc=false}
    if(okc)markExport();                       /* 書き出した日を控える（促しの基準） */
    msg(okc?'コピーしました。':'コピーできませんでした。全選択して手動でコピーしてください。');return}
  if(a==='doimport'){
    var s=document.getElementById('tb').value.trim();
    if(!s){msg('貼り付けてください。');return}
    var o;try{o=JSON.parse(s)}catch(err){msg('JSONとして読めません：'+err.message);return}
    if(!o||typeof o!=='object'||!o.items){msg('items が無いため読み込みません。');return}
    if(!confirm('現在の進行状況を上書きします。よろしいですか。'))return;
    var keepgh=ST.settings&&ST.settings.gh;    /* 接続の設定は残す（ghPull と同じ扱い） */
    ST=normST(o);if(keepgh)ST.settings.gh=keepgh;
    saveST();msg('読み込みました（'+Object.keys(ST.items).length+'問）。');render();return;
  }
  if(a==='wipe'){
    if(!confirm('進行状況（takken_v1）を全消去します。取り消せません。'))return;
    ST=normST({});S.queue=[];S.qi=0;try{localStorage.removeItem(LSK)}catch(err){}
    msg('消去しました。');render();return;
  }
});

/* ---------- 問題カードの傾き（M3。スワイプは廃止） ----------
   2026-08-14 本人指摘「問題のスワイプ機能は必要ないかな」で ○×スワイプを全廃した。
   残すのは M3 の傾き（最大2度）だけなので、transform の合成は m3Set() のまま1か所で組む
   （横移動 m3T.dx は常に0。スワイプと傾きが transform を奪い合う問題自体が無くなった）。 */
function bindTilt(){
  var c=document.getElementById('qstem');if(!c)return;
  if(c._m3bound)return;                 /* 二重bind防止（renderのたびに呼ばれる） */
  c._m3bound=true;
  var pid=null;
  c.addEventListener('pointerdown',function(e){
    if(e.button!==undefined&&e.button!==0)return;
    pid=e.pointerId;
    /* 入場アニメーション（cardIn）は fill:both で transform を握っているため、
       触られた時点で終わらせて指に主導権を渡す（残り最大10pxだけ進む）。 */
    c.getAnimations().forEach(function(a){
      if(a.animationName==='cardIn'){try{a.finish()}catch(_){}}
    });
    c.classList.remove('qin','m3-ret');
    c.classList.add('m3-on');
    if(e.pointerType!=='touch')m3Tilt(e,c);
  });
  c.addEventListener('pointermove',function(e){
    if(pid===null||e.pointerId!==pid)return;
    m3Tilt(e,c);
  });
  function up(e){
    if(pid===null||(e&&e.pointerId!==undefined&&e.pointerId!==pid))return;
    pid=null;m3T.dx=0;m3Release();c.classList.remove('m3-on');
  }
  c.addEventListener('pointerup',up);
  c.addEventListener('pointercancel',up);
  c.addEventListener('pointerleave',up);
}

/* =========================================================================
   M2 — 入力の手触りと効果音（polish/M2_feel.html から移植）
   app.html 用の変更点：
     ① デモ用のログ出力を無効化（no-op）
     ② スワイプ（bindSwipe / fly）は 2026-08-14 に削除（○×はボタンのタップだけ）。
        残しているのは押下の手触り（沈む・離しでBack・リップル）と効果音だけ。
   ========================================================================= */
var M2=(function(){
'use strict';
var D={down:60,up:140,ripple:400};        /* fly/ret/inn はスワイプ廃止で不要になった */
var E={
  linear:'linear',
  back:'cubic-bezier(.2,1.5,.4,1)',
  backSoft:'cubic-bezier(.34,1.4,.64,1)',
  easeIn:'cubic-bezier(.7,0,.84,0)',
  easeOut:'cubic-bezier(.16,1,.3,1)'
};
var SCALE_DOWN=.96;
var reduce=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||false;
function log(){}                                  /* ①デモ用ログは持ち込まない */

function anim(el,key,frames,dur,ease){
  el._m2a=el._m2a||{};
  if(el._m2a[key]){try{el._m2a[key].cancel()}catch(e){}}
  if(reduce)return null;
  var a=el.animate(frames,{duration:dur,easing:ease,fill:'forwards'});
  el._m2a[key]=a;
  return a;
}
function pressIn(el){
  el.classList.add('m2-held');
  return anim(el,'press',[{transform:'scale(1)'},{transform:'scale('+SCALE_DOWN+')'}],D.down,E.linear);
}
function pressOut(el){
  el.classList.remove('m2-held');
  return anim(el,'press',[{transform:'scale('+SCALE_DOWN+')'},{transform:'scale(1)'}],D.up,E.back);
}
function inside(el,x,y){
  var r=el.getBoundingClientRect();
  return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
}
function ripple(el,x,y){
  if(reduce)return null;
  var r=el.getBoundingClientRect();
  if(!isFinite(x)){x=r.left+r.width/2;y=r.top+r.height/2}
  var d=Math.max(r.width,r.height)*2.2;
  var s=document.createElement('span');
  s.className='m2-ripple';
  s.style.width=s.style.height=d+'px';
  s.style.left=(x-r.left-d/2)+'px';
  s.style.top=(y-r.top-d/2)+'px';
  el.appendChild(s);
  var a=s.animate([{transform:'scale(.28)',opacity:.30},{transform:'scale(1)',opacity:0}],
                  {duration:D.ripple,easing:E.easeOut});
  a.onfinish=function(){if(s.parentNode)s.parentNode.removeChild(s)};
  a.oncancel=a.onfinish;
  el._m2ripple=a;
  return a;
}
/* 押した感（見た目）だけを委譲で当てる。再描画で消えない＝app.html はこれを使う */
function delegate(sel,root){
  root=root||document;
  var cur=null;
  root.addEventListener('pointerdown',function(e){
    if(e.button!==undefined&&e.button!==0)return;
    var el=e.target&&e.target.closest?e.target.closest(sel):null;
    if(!el)return;
    resumeCtx();
    el.classList.add('m2-press');
    cur={el:el,id:e.pointerId,cancelled:false};
    pressIn(el);
    ripple(el,e.clientX,e.clientY);
  },true);
  root.addEventListener('pointermove',function(e){
    if(!cur||e.pointerId!==cur.id)return;
    var inb=inside(cur.el,e.clientX,e.clientY);
    if(!inb&&!cur.cancelled){cur.cancelled=true;pressOut(cur.el)}
    else if(inb&&cur.cancelled){cur.cancelled=false;pressIn(cur.el)}
  },true);
  function up(){if(!cur)return;pressOut(cur.el);cur=null}
  root.addEventListener('pointerup',up,true);
  root.addEventListener('pointercancel',up,true);
  return sel;
}
/* スワイプ（bindSwipe / fly）は 2026-08-14 に削除した。
   本人指摘「問題のスワイプ機能は必要ないかな」で ○×のスワイプを全廃したため、
   ここに残しておくと transform を奪い合う経路だけが生き残る。押下の手触り
   （pressIn / pressOut / ripple / delegate）はそのまま残している。 */
/* ---- 効果音（Web Audio・合成のみ。既定オフ） ---- */
var ctx=null,master=null,sndOn=false;
function resumeCtx(){
  if(!sndOn)return null;
  if(!ctx)openCtx();
  if(ctx&&ctx.state==='suspended'&&ctx.resume)ctx.resume();
  return ctx;
}
function openCtx(){
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  try{
    ctx=new AC();
    master=ctx.createGain();
    master.gain.value=.7;
    master.connect(ctx.destination);
  }catch(e){ctx=null}
  return ctx;
}
function setSound(on){sndOn=!!on;if(sndOn){resumeCtx()}return sndOn}
function soundOn(){return sndOn}
function voice(c,dest,type,f0,f1,t0,dur,peak){
  var o=c.createOscillator(),g=c.createGain();
  o.type=type;
  o.frequency.setValueAtTime(f0,t0);
  if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t0+dur);
  g.gain.setValueAtTime(.0001,t0);
  g.gain.exponentialRampToValueAtTime(peak,t0+Math.min(.006,dur*.35));
  g.gain.exponentialRampToValueAtTime(.0002,t0+dur);
  g.gain.linearRampToValueAtTime(0,t0+dur+.004);
  o.connect(g);g.connect(dest);
  o.start(t0);o.stop(t0+dur+.006);
  return t0+dur+.004;
}
var VOICES={
  tap:function(c,d,t){return voice(c,d,'square',1500,900,t,.010,.055)},
  ok:function(c,d,t){
    var e=voice(c,d,'triangle',880,880,t,.10,.10);
    return Math.max(e,voice(c,d,'triangle',1318.5,1318.5,t+.085,.15,.09));
  },
  ng:function(c,d,t){return voice(c,d,'sine',220,150,t,.185,.12)},
  combo:function(c,d,t){
    var e=t;[659.3,880,1174.7].forEach(function(f,i){
      e=Math.max(e,voice(c,d,'triangle',f,f,t+i*.055,.095,.085));
    });return e;
  },
  clear:function(c,d,t){
    var e=t;[587.3,740,880,1174.7].forEach(function(f,i){
      e=Math.max(e,voice(c,d,'triangle',f,f,t+i*.05,.085,.08));
    });return e;
  }
};
function sfx(name){
  if(!sndOn||!VOICES[name])return 0;
  var c=resumeCtx();
  if(!c)return 0;
  var t0=c.currentTime+.005;
  var end=VOICES[name](c,master,t0);
  return +(end-t0).toFixed(4);
}
function measure(name){
  var OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!OAC||!VOICES[name])return Promise.resolve(null);
  var sr=48000,oc=new OAC(1,sr,sr),g=oc.createGain();
  g.gain.value=1;g.connect(oc.destination);
  VOICES[name](oc,g,0);
  return oc.startRendering().then(function(buf){
    var d=buf.getChannelData(0),last=-1,peak=0;
    for(var i=0;i<d.length;i++){
      var a=Math.abs(d[i]);
      if(a>peak)peak=a;
      if(a>1e-3)last=i;
    }
    return {name:name,sec:+((last+1)/sr).toFixed(4),peak:+peak.toFixed(4),samples:last+1};
  });
}
function measureAll(){
  var names=Object.keys(VOICES),out=[];
  return names.reduce(function(p,n){
    return p.then(function(){return measure(n)}).then(function(r){out.push(r)});
  },Promise.resolve()).then(function(){return out});
}
return {D:D,E:E,reduce:reduce,
  bindPress:null,delegate:delegate,ripple:ripple,
  sfx:sfx,setSound:setSound,soundOn:soundOn,measure:measure,measureAll:measureAll,
  ctx:function(){return ctx},log:log};
})();

/* =========================================================================
   M3 — 奥行き・視差・光（polish/M3_depth.md §4）
   transform は m3Set() の1か所でだけ組む（横移動 m3T.dx はスワイプ廃止で常に0）
   ========================================================================= */
var m3bg=null,m3fg=null,m3veil=null,m3hero=null;
var m3raf=0,M3BG=0.30,M3FG=1.15,m3bgScale=1;
var m3T={dx:0,rx:0,ry:0,sc:1};
function m3Init(){
  m3bg=document.getElementById('m3bg');
  m3fg=document.getElementById('m3fg');
  m3veil=document.getElementById('m3veil');
  if(m3fg&&!m3fg.querySelector('i')){        /* 前景の粒9個（動くのは親1個だけ） */
    var pos=[[8,6,120],[72,14,90],[40,26,70],[86,38,110],[18,46,80],[60,58,100],[30,70,70],[80,78,120],[50,88,90]];
    var html='';
    pos.forEach(function(p,i){
      var op=(0.15+(i%5)*0.05).toFixed(2);
      html+='<i style="left:'+p[0]+'%;top:'+p[1]+'%;width:'+p[2]+'px;height:'+p[2]+'px;opacity:'+op+'"></i>';
    });
    m3fg.insertAdjacentHTML('beforeend',html);
  }
  if(!M2.reduce)window.addEventListener('scroll',function(){
    if(!m3raf)m3raf=requestAnimationFrame(m3Apply);
  },{passive:true});
}
function m3Apply(){
  m3raf=0;
  if(!m3bg)return;
  var y=window.scrollY||document.documentElement.scrollTop||0;
  m3bg.style.transform='translate3d(0,'+(-y*M3BG).toFixed(2)+'px,0) scale('+m3bgScale+')';
  m3fg.style.transform='translate3d(0,'+(-y*M3FG).toFixed(2)+'px,0)';
}
/* 主役に寄る／戻る（背景を後退させる。カード自身は拡大しない＝文字を鈍らせない） */
function m3Focus(on){
  m3bgScale=on?0.985:1;
  if(m3veil)m3veil.style.opacity=on?'1':'0';
  document.body.classList.toggle('m3-focus',!!on);
  m3Apply();
}
function m3Set(){
  if(!m3hero)return;
  m3hero.style.transform='translateX('+m3T.dx.toFixed(1)+'px) '
    +'rotateX('+m3T.rx.toFixed(2)+'deg) rotateY('+m3T.ry.toFixed(2)+'deg) scale('+m3T.sc+')';
}
function m3Tilt(e,el){
  if(M2.reduce)return;
  var r=el.getBoundingClientRect(),MAX=2;
  var px=(e.clientX-r.left)/r.width-0.5,py=(e.clientY-r.top)/r.height-0.5;
  m3T.ry=Math.max(-MAX,Math.min(MAX,px*MAX*2));
  m3T.rx=Math.max(-MAX,Math.min(MAX,-py*MAX*2));
  m3Set();
}
function m3Release(){
  if(!m3hero)return;
  m3hero.classList.add('m3-ret');
  m3T.rx=0;m3T.ry=0;m3Set();
}
/* ヒートマップ：奥から手前へ。--i は対角（行＋列）で最大13段＝0.52秒に畳む
   （M3_depth.md §6-1「49×40ms＝1.96秒は待たせすぎ」への対応） */
function m3Heat(el){
  var cols=1;
  try{cols=getComputedStyle(el).gridTemplateColumns.split(' ').filter(function(s){return s}).length}catch(e){}
  if(!cols||cols<1)cols=1;
  var k=el.children;
  for(var i=0;i<k.length;i++){
    var d=Math.min(12,Math.floor(i/cols)+(i%cols));
    k[i].style.setProperty('--i',d);
  }
  el.classList.remove('m3-in');void el.offsetWidth;el.classList.add('m3-in');
}

/* =========================================================================
   M4 — 数値と状態変化（polish/M4_numbers.html から移植・そのまま）
   ========================================================================= */
var M4={dNum:450,dBar:500,dCell:280,dFade:400,dBox:300,dBadge:300,
  easeOut:'cubic-bezier(.16,1,.3,1)',easeIn:'cubic-bezier(.7,0,.84,0)',back:'cubic-bezier(.34,1.4,.64,1)'};
function m4Fmt(v,dec){return dec>0?v.toFixed(dec):String(Math.round(v))}
function m4EaseOutCubic(t){return 1-Math.pow(1-t,3)}
function m4CountUp(el,from,to,ms,opt){
  if(!el)return null;
  opt=opt||{};
  var dec=opt.dec||0,dur=ms||M4.dNum,delta=to-from,suf=opt.suf||'';
  if(el._m4raf){cancelAnimationFrame(el._m4raf);el._m4raf=0}
  if(delta===0){el.textContent=m4Fmt(to,dec)+suf;return null}
  var mag=Math.min(1,Math.abs(delta)/(opt.big||10));
  var dist=(3+7*mag)*(delta>0?-1:1);
  var slide=M2.reduce?null:el.animate(
    [{transform:'translateY('+dist+'px)',opacity:.25},{transform:'translateY(0)',opacity:1}],
    {duration:Math.round(dur*0.5),easing:M4.easeOut,fill:'both'});
  if(opt.tile&&mag>=0.6){
    opt.tile.classList.remove('m4-strong');void opt.tile.offsetWidth;
    opt.tile.classList.add('m4-strong');
  }
  var t0=performance.now();
  (function step(now){
    var t=Math.min(1,(now-t0)/dur);
    el.textContent=m4Fmt(from+delta*m4EaseOutCubic(t),dec)+suf;
    if(t<1)el._m4raf=requestAnimationFrame(step);
    else{el.textContent=m4Fmt(to,dec)+suf;el._m4raf=0}
  })(t0);
  clearTimeout(el._m4to);
  el._m4to=setTimeout(function(){
    if(el._m4raf){cancelAnimationFrame(el._m4raf);el._m4raf=0}
    el.textContent=m4Fmt(to,dec)+suf;
  },dur+80);
  return slide;
}
function m4Gauge(fill,tip,from,to){
  if(!fill)return null;
  var a=fill.animate([{transform:'scaleX('+(from/100)+')'},{transform:'scaleX('+(to/100)+')'}],
    {duration:M4.dBar,easing:M4.easeOut,fill:'forwards'});
  if(tip){
    /* SPEC §5-2「transform と opacity だけで動かす（top/left は使わない）」に合わせ、
       先端の光は left ではなく translateX で移動させる（レイアウトを起こさない） */
    var bw=(fill.parentNode&&fill.parentNode.offsetWidth)||0;
    tip.animate([{transform:'translateX('+(from/100*bw).toFixed(1)+'px)'},
                 {transform:'translateX('+(to/100*bw).toFixed(1)+'px)'}],
      {duration:M4.dBar,easing:M4.easeOut,fill:'forwards'});
    if(to>from)tip.animate([{opacity:0},{opacity:.9},{opacity:0}],
      {duration:200,delay:M4.dBar-60,easing:'linear',iterations:1});
  }
  return a;
}
function m4BumpCell(el,stage,grad){
  if(!el)return null;
  el.classList.remove('m4-bump','m4-grad');void el.offsetWidth;
  el.dataset.stage=String(stage);
  el.classList.add('m4-bump');
  if(grad)el.classList.add('m4-grad');
  return el.getAnimations();
}
function m4AdvanceBox(segsEl,indEl,from,to){
  if(!segsEl||!indEl)return null;
  var segs=segsEl.children,n=segs.length,fwd=to>from,i;
  var ease=fwd?M4.easeOut:M4.easeIn;
  for(i=0;i<n;i++)segs[i].classList.toggle('on',i<=to);
  var moved=fwd?segs[to]:segs[from];
  if(moved){
    var bar=moved.firstElementChild;
    if(bar)bar.animate(fwd?[{transform:'scaleY(0)'},{transform:'scaleY(1)'}]
                          :[{transform:'scaleY(1)'},{transform:'scaleY(0)'}],
      {duration:M4.dBox,easing:ease,fill:'none'});
  }
  var p=function(k){return ((k+0.5)/n*100)+'%'};
  indEl.animate([{left:p(from)},{left:p(to)}],{duration:M4.dBox,easing:ease,fill:'forwards'});
  return indEl.getAnimations();
}
function m4SetBadge(el,stage,label){
  if(!el)return null;
  var b=el.querySelector('b');if(!b)return null;
  var half=Math.round(M4.dBadge/2);
  var down=b.animate([{transform:'rotateX(0deg)',opacity:1},{transform:'rotateX(-90deg)',opacity:.15}],
    {duration:half,easing:M4.easeIn,fill:'forwards'});
  var swapped=false;
  function swap(){
    if(swapped)return;swapped=true;
    down.cancel();                     /* fill:'forwards' を必ず畳む（M4_numbers.md §3-1の罠） */
    b.textContent=label;
    el.dataset.stage=String(stage);
    b.animate([{transform:'rotateX(90deg)',opacity:.15},{transform:'rotateX(0deg)',opacity:1}],
      {duration:half,easing:M4.back,fill:'none'});
  }
  down.onfinish=swap;
  clearTimeout(el._m4to);el._m4to=setTimeout(swap,half+60);
  return down;
}
/* ヘッダーの成績＝DOMを作り直さず値だけ動かす */
var M4PREV={total:0,right:0,rate:0,prog:0};
function m4UpdateHead(ses){
  var tot=ses.total||0,ri=ses.right||0,rate=tot?ri/tot*100:0;
  m4CountUp(document.getElementById('hTotal'),M4PREV.total,tot,450,{big:10});
  m4CountUp(document.getElementById('hRight'),M4PREV.right,ri,450,{big:10});
  m4CountUp(document.getElementById('hRate'),M4PREV.rate,rate,450,{dec:1,big:8,suf:'%'});
  M4PREV.total=tot;M4PREV.right=ri;M4PREV.rate=rate;
}
/* 進捗バーは描画のたびに前回値→今回値へ伸ばす（先端に光が1回） */
function m4Progress(){
  var b=document.getElementById('hBar');
  if(!b){PROGPREV=PROGNEW;return}
  if(Math.abs(PROGNEW-PROGPREV)>0.0001)m4Gauge(b,document.getElementById('hTip'),PROGPREV*100,PROGNEW*100);
  PROGPREV=PROGNEW;M4PREV.prog=PROGNEW;
}

/* =========================================================================
   M5 — 起動・開始・完走（polish/M5_intro.html から移植）
   app.html 用の差分：
     ① resetAnims の対象を M5 のオーバーレイ内だけに限定（M1/M3/M4 のアニメを消さない）
     ② showView は no-op（画面の出し分けは既存の render() が担当）
     ③ #stack → #view（縮む対象）、.m5-rise → ホームの .pad の子要素
     ④ 暗幕の blur は使わない（CSS側のコメント参照）
   ========================================================================= */
var M5=(function(){
  var EO='cubic-bezier(.16,1,.3,1)';
  var EI='cubic-bezier(.7,0,.84,0)';
  var RM=(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)?0.01:1;
  var LIMIT={intro:800,intro2:400,start:900,closed:1600,result:null};
  var log={};
  var run=null;
  function $(s){return document.querySelector(s)}
  function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function riseEls(){return $$('#view .pad > *').slice(0,6)}
  function stackEl(){return document.getElementById('view')}
  /* ①M5のオーバーレイ内のアニメだけ消す */
  function resetAnims(){
    if(!document.getAnimations)return;
    var ovs=$$('.m5-ov');
    document.getAnimations().forEach(function(a){
      try{
        var t=a.effect&&a.effect.target;
        if(!t)return;
        for(var i=0;i<ovs.length;i++)if(ovs[i]===t||ovs[i].contains(t)){a.cancel();return}
      }catch(e){}
    });
  }
  function settle(els){
    /* app.html では対象が0個になり得る（例：ホーム以外で起動演出が終わるとき）。
       デモの実装は空配列で [els] に落ちて [].style を触り例外になるので、ここだけ直した。 */
    var a=(els&&typeof els.length==='number')?Array.prototype.slice.call(els):[els];
    a.forEach(function(el){if(el&&el.style){el.style.opacity='1';el.style.transform='none'}});
  }
  function begin(name,total,final,limit){
    if(run)skip();
    resetAnims();
    run={name:name,total:total,limit:limit||null,anims:[],timers:[],ops:[],cancels:[],
         final:final,t0:performance.now(),t0doc:(document.timeline&&document.timeline.currentTime)||0,res:null};
    var p=new Promise(function(r){run.res=r});
    run.endTimer=setTimeout(function(){done(false)},total*RM);
    run.timers.push(run.endTimer);
    return p;
  }
  function A(el,frames,o){
    o=o||{};
    if(!el)return null;
    var a=el.animate(frames,{duration:(o.duration||0)*RM,delay:(o.delay||0)*RM,
      easing:o.easing||EO,fill:o.fill||'both'});
    if(run)run.anims.push(a);
    return a;
  }
  function T(ms,fn){
    var o={fn:fn,ran:false};
    if(!run){fn();return}
    run.ops.push(o);
    run.timers.push(setTimeout(function(){if(!o.ran){o.ran=true;o.fn()}},ms*RM));
  }
  function done(skipped){
    if(!run)return;
    var r=run;
    r.timers.forEach(clearTimeout);
    r.ops.forEach(function(o){if(!o.ran){o.ran=true;o.fn()}});
    r.cancels.forEach(function(f){f()});
    var m=0;
    r.anims.forEach(function(a){
      try{
        var st=(a.startTime==null?r.t0doc:a.startTime);
        var e=st+(a.effect.getComputedTiming().endTime||0)-r.t0doc;
        if(e>m)m=e;
      }catch(e2){}
    });
    if(skipped)r.anims.forEach(function(a){try{a.finish()}catch(e){}});
    run=null;
    var out={name:r.name,declared:r.total,ms:Math.round(performance.now()-r.t0),
             anim:Math.round(m),anims:r.anims.length,skipped:!!skipped,limit:r.limit};
    if(r.final)r.final();
    log[r.name]=out;
    r.res(out);
  }
  function skip(){if(run)done(true)}
  function confetti(n){
    var col=['#2fa37c','#c8a24a','#7fd0b0','#f2d98b','#4bbf95','#bfe6d5'],s='';
    function rnd(a,b){return a+Math.random()*(b-a)}
    for(var i=0;i<n;i++){
      var ang=rnd(-58,58),d=rnd(260,420),fall=rnd(430,620),dl=(0.12+rnd(0,.14)).toFixed(2),
          spin=rnd(-720,720).toFixed(0),thin=(i%4===0);
      s+='<div class="p" style="animation-delay:'+dl+'s;--fall:'+fall.toFixed(0)+'px">'
        +'<div class="dir" style="--ang:'+ang.toFixed(1)+'deg">'
        +'<div class="up" style="--d:'+d.toFixed(0)+'px;animation-delay:'+dl+'s">'
        +'<span class="pc'+(thin?' thin':'')+'" style="background:'+col[i%col.length]
        +';--spin:'+spin+'deg;animation-delay:'+dl+'s"></span></div></div></div>';
    }
    var w=document.createElement('div');w.className='m5-launch';w.innerHTML=s;
    return w;
  }
  function countUp(el,to,ms,dec){
    if(!el)return;
    var t0=performance.now(),id;
    function step(t){
      var k=Math.min(1,(t-t0)/(ms*RM));
      el.textContent=(to*k).toFixed(dec||0);
      if(k<1)id=requestAnimationFrame(step);else el.textContent=to.toFixed(dec||0);
    }
    id=requestAnimationFrame(step);
    if(run)run.cancels.push(function(){cancelAnimationFrame(id);el.textContent=to.toFixed(dec||0)});
  }
  /* ① 起動 */
  var introSeen=false;
  function playIntro(first){
    if(typeof first!=='boolean')first=!introSeen;
    introSeen=true;
    var ov=$('#m5-intro'),line=$('#i-line'),name=$('#i-name'),cap=$('#i-cap');
    var rise=riseEls();
    ov.hidden=false;ov.style.opacity=1;
    var P=first
      ?{line:[0,190],name:[110,230],cap:[230,200],out:[290,150],card:[300,42,270],total:760}
      :{line:[0,110],name:[0,200],cap:[60,160],out:[140,120],card:[100,20,180],total:380};
    var p=begin('intro',P.total,function(){
      ov.hidden=true;settle(rise);settle([line,name,cap]);
    },first?800:400);
    A(line,[{transform:'scaleX(.06)',opacity:.35},{transform:'scaleX(1)',opacity:.85}],
      {duration:P.line[1],delay:P.line[0]});
    A(name,[{transform:'translateY(112%)',opacity:0},{transform:'none',opacity:1}],
      {duration:P.name[1],delay:P.name[0]});
    A(cap,[{opacity:0},{opacity:1}],{duration:P.cap[1],delay:P.cap[0]});
    A(ov,[{opacity:1},{opacity:0}],{duration:P.out[1],delay:P.out[0],easing:EI});
    T(P.out[0]+P.out[1],function(){ov.hidden=true});
    rise.forEach(function(el,i){
      A(el,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],
        {duration:P.card[2],delay:P.card[0]+P.card[1]*i});
    });
    return p;
  }
  /* ② セッション開始（go('quiz') の直後に呼ぶ＝カードは既に描かれている） */
  function playStart(label,n){
    var ov=$('#m5-start'),box=$('#s-box'),stack=stackEl();
    $('#s-label').textContent=label||'出題';
    $('#s-n').textContent=(n==null?0:n);
    ov.hidden=false;
    var p=begin('start',840,function(){
      ov.hidden=true;if(stack)stack.style.transform='none';
      settle($$('.m5-qr'));settle([box]);
    },900);
    A(ov,[{opacity:0},{opacity:1}],{duration:120,easing:'ease-out'});
    if(stack)A(stack,[{transform:'scale(1)'},{transform:'scale(.985)'}],{duration:120,easing:'ease-out'});
    A(box,[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:260,delay:120});
    A(box,[{opacity:1},{opacity:0}],{duration:180,delay:500,easing:EI});
    A(ov,[{opacity:1},{opacity:0}],{duration:200,delay:520,easing:EI});
    if(stack)A(stack,[{transform:'scale(.985)'},{transform:'scale(1)'}],{duration:240,delay:500});
    T(720,function(){ov.hidden=true});
    T(500,function(){
      $$('.m5-qr').forEach(function(el,i){
        A(el,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],
          {duration:200,delay:10+22*i});
      });
    });
    return p;
  }
  /* ③ 完走リザルト */
  function showResult(d){
    d=d||{};
    var ov=$('#m5-result');
    /* 周回しているときは「N周目」を小さく出す（何周もしていることが分かるように）。
       全問正解のときは見出しを「全問正解」にする（もう一度解く必要がないと分かる）。 */
    $('#r-kind').textContent=(d.round?(d.round+'周目'):'COMPLETE');
    $('#r-title').textContent=(d.perfect?'全問正解':(d.wrong?('間違い '+d.wrong+'問'):'この範囲を解き終えました'));
    $('#r-total').textContent='／ '+(d.total||0)+'問';
    $('#r-best').textContent=(d.best||0);
    $('#r-time').textContent=(d.time||'0:00');
    $('#r-per').textContent='／ 1問あたり '+(d.per||0).toFixed(1)+'秒';
    $('#r-cat').textContent=(d.catFrom||0);
    $('#r-grad').textContent=(d.grad||0);
    $('#r-catk').textContent=(d.catLabel||'達成度');
    $('#r-catfrom').textContent='%　／ 開始 '+(d.catFrom||0)+'%';
    $('#r-right').textContent='0';$('#r-rate').textContent='0.0';
    $('#r-catbar').style.transform='scaleX(0)';
    ov.hidden=false;
    var STG=400,rows=['#r-1','#r-2','#r-3','#r-4','#r-5'],last=300+STG*4;
    var total=last+300+280;
    var p=begin('result',total,function(){
      $('#r-right').textContent=(d.right||0);$('#r-rate').textContent=(d.rate||0).toFixed(1);
      $('#r-cat').textContent=(d.catTo||0);$('#r-catbar').style.transform='scaleX('+((d.catTo||0)/100)+')';
      settle([$('#r-head'),$('#r-btns')].concat(rows.map(function(s){return $(s)})));
      ov.style.opacity='1';
    });
    A(ov,[{opacity:0},{opacity:1}],{duration:200});
    A($('#r-head'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:260});
    rows.forEach(function(s,i){
      A($(s),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],
        {duration:280,delay:300+STG*i});
    });
    A($('#r-btns'),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],
      {duration:280,delay:last+300});
    T(380,function(){countUp($('#r-right'),d.right||0,700,0);countUp($('#r-rate'),d.rate||0,700,1)});
    T(300+STG*3,function(){
      A($('#r-catbar'),[{transform:'scaleX('+((d.catFrom||0)/100)+')'},
                        {transform:'scaleX('+((d.catTo||0)/100)+')'}],{duration:600});
      countUp($('#r-cat'),d.catTo||0,600,0);
    });
    return p;
  }
  /* ④ 分野を閉じた（導入→破裂→収束→確定） */
  function showClosed(cat,nb){
    var ov=$('#m5-closed'),seal=$('#c-seal'),ring=$('#c-ring'),
        glow=$('#c-glow'),word=$('#c-word'),line=$('#c-line'),catn=$('#c-cat'),tap=$('#c-tap');
    catn.textContent=(cat||'')+'　全'+(nb==null?0:nb)+'問';
    ov.hidden=false;
    var old=ov.querySelector('.m5-launch');if(old)old.remove();
    var p=begin('closed',1550,function(){
      settle([seal,word,line,catn,tap]);
      glow.style.opacity='0';ring.style.opacity='0';ov.style.opacity='1';
      var c=ov.querySelector('.m5-launch');if(c)c.remove();
    },1600);
    A(ov,[{opacity:0},{opacity:1}],{duration:120,easing:'ease-out'});
    A(seal,[{transform:'scale(.55)',opacity:0},{transform:'scale(.88)',opacity:1}],
      {duration:120,easing:'ease-in'});
    A(seal,[{transform:'scale(.88)'},{transform:'scale(1.14)'}],
      {duration:320,delay:120,easing:'cubic-bezier(.2,1.4,.4,1)'});
    A(ring,[{transform:'scale(.45)',opacity:.6},{transform:'scale(1.95)',opacity:0}],
      {duration:320,delay:130});
    A(glow,[{opacity:0},{opacity:.75},{opacity:0}],{duration:420,delay:130,easing:'ease-out'});
    T(150,function(){ov.appendChild(confetti(30))});
    A(seal,[{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:280,delay:440});
    A(word,[{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'none'}],{duration:240,delay:440});
    A(line,[{transform:'scaleX(.05)',opacity:0},{transform:'scaleX(1)',opacity:1}],{duration:300,delay:720});
    A(catn,[{opacity:0},{opacity:1}],{duration:240,delay:800});
    A(tap,[{opacity:0},{opacity:1}],{duration:240,delay:1200});
    return p;
  }
  function showView(){}                    /* ②画面の出し分けは render() が担当 */
  function closeAll(){
    ['#m5-intro','#m5-start','#m5-result','#m5-closed'].forEach(function(s){
      var e=$(s);if(e){e.hidden=true;e.style.opacity=''}
    });
    var c=$('#m5-closed').querySelector('.m5-launch');if(c)c.remove();
  }
  return {playIntro:playIntro,playStart:playStart,showResult:showResult,showClosed:showClosed,
          skip:skip,closeAll:closeAll,showView:showView,log:log,limit:LIMIT,
          running:function(){return !!run}};
})();

/* =========================================================================
   M1 — 画面遷移の連続性（FLIP。polish/M1_transition.md §3 をそのまま）
   出発要素の矩形を控える → go() で同期描画 → 着地要素へ1枚の面を育てる
   ========================================================================= */
var M1_REDUCED=M2.reduce;
var M1D={main:M1_REDUCED?1:320,back:M1_REDUCED?1:260,bg:M1_REDUCED?1:420,lift:M1_REDUCED?1:110};
var M1E='cubic-bezier(.2,.85,.3,1)';
var M1STEP=M1_REDUCED?0:40;
var m1live=[],m1token=0,M1BUSY=false;
function m1fx(){return document.getElementById('m1fx')}
function m1Rect(el){
  var r=el.getBoundingClientRect();
  return {x:r.left+window.scrollX,y:r.top+window.scrollY,w:r.width,h:r.height};
}
function m1Snap(el){
  /* 入場アニメーション（m3-rise/cardIn）が走っている最中に測ると縮んだ矩形を拾うので、
     先に終わらせてから測る（M1_transition.md §5-3 と同じ理由） */
  if(el.getAnimations)el.getAnimations().forEach(function(a){
    if(a.animationName==='m3-rise'||a.animationName==='cardIn'){try{a.finish()}catch(_){}}
  });
  return m1Rect(el);
}
function m1Play(el,frames,dur,opts){
  opts=opts||{};
  var a=el.animate(frames,{duration:dur,easing:opts.easing||M1E,fill:opts.fill||'both',delay:opts.delay||0});
  m1live.push(a);return a;
}
function m1Cancel(){
  for(var i=0;i<m1live.length;i++){try{m1live[i].cancel()}catch(e){}}
  m1live=[];m1fx().textContent='';
}
/* 全部終わってから畳む。これをしないと fill:both が溜まって次の測定がズレる */
function m1Settle(my){
  var arr=m1live.slice();
  return Promise.all(arr.map(function(a){return a.finished.catch(function(){})})).then(function(){
    if(my!==m1token)return;
    for(var i=0;i<arr.length;i++){try{arr[i].cancel()}catch(e){}}
    m1live=m1live.filter(function(a){return arr.indexOf(a)===-1});
    m1fx().textContent='';
    M1BUSY=false;
  });
}
function m1FlipTo(from,toEl,opts){
  opts=opts||{};
  var dur=opts.dur||M1D.main;
  var f=(from&&from.nodeType===1)?m1Rect(from):from;
  var t=m1Rect(toEl);
  if(!t.w||!t.h)return null;
  var sx=f.w/t.w,sy=f.h/t.h,dx=f.x-t.x,dy=f.y-t.y;
  var rF=(opts.rFrom==null?8:opts.rFrom),rT=(opts.rTo==null?10:opts.rTo);
  var g=document.createElement('div');
  g.className='m1-ghost';
  g.style.cssText='left:'+t.x+'px;top:'+t.y+'px;width:'+t.w+'px;height:'+t.h+'px';
  g.innerHTML='<div class="m1-ghost-bg"></div><div class="m1-g-out"></div><div class="m1-g-in"></div>';
  m1fx().appendChild(g);
  var bg=g.children[0],out=g.children[1],inn=g.children[2];
  out.style.cssText='left:'+dx+'px;top:'+dy+'px;width:'+f.w+'px;height:'+f.h+'px';
  out.innerHTML=opts.outHTML||'';
  inn.innerHTML=opts.inHTML||'';
  var box=m1Play(bg,[
    {transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')',
     borderRadius:(rF/Math.max(sx,.001))+'px / '+(rF/Math.max(sy,.001))+'px'},
    {transform:'translate(0px,0px) scale(1,1)',borderRadius:rT+'px'}
  ],dur);
  m1Play(out,[{opacity:1,transform:'translate(0,0)'},
              {opacity:0,transform:'translate('+(-dx*.12)+'px,'+(-dy*.12)+'px)'}],Math.round(dur*.45));
  m1Play(inn,[{opacity:0,transform:'translateY(8px)'},
              {opacity:1,transform:'translateY(0)'}],Math.round(dur*.72),{delay:Math.round(dur*.28)});
  return {ghost:g,box:box};
}
function m1BgIn(el,dur,from){
  return m1Play(el,[{transform:'scale('+(from||1.03)+')',opacity:0},
                    {transform:'scale(1)',opacity:1}],dur||M1D.bg);
}
function m1Stagger(els,startAt,dist){
  Array.prototype.forEach.call(els,function(el,i){
    m1Play(el,[{opacity:0,transform:'translateY('+(dist||10)+'px)'},
               {opacity:1,transform:'translateY(0)'}],
      M1_REDUCED?1:280,{delay:(startAt||0)+i*M1STEP});
  });
}
/* 小分類のマス → 学習カードのヘッダー */
function m1ToStudy(el,cat){
  var my=++m1token;m1Cancel();M1BUSY=true;
  var snap=m1Snap(el);
  S.cat=cat;S.anim=null;go('study');
  var hero=document.getElementById('m1hero');
  if(!hero){M1BUSY=false;return}
  hero.style.visibility='hidden';
  /* 一覧の行から開いたときは、育っていく面の文字も動画の見出しにする（引き継ぎを崩さない） */
  var lab=S.studyVid?(vlab(S.studyVid)||cat):cat;
  var r=m1FlipTo(snap,hero,{dur:M1D.main,rFrom:8,rTo:10,outHTML:esc(lab),
    inHTML:'<div class="h" style="margin:0">'+esc(lab)+'</div>'});
  m1BgIn(document.getElementById('view'),M1D.bg,1.03);
  m1Stagger(document.querySelectorAll('#view .panel'),Math.round(M1D.main*.45),10);
  m1Settle(my);
  if(r)r.box.finished.then(function(){if(my===m1token)hero.style.visibility='visible'}).catch(function(){});
  else hero.style.visibility='visible';
}
/* 章の行 → 出題カード */
function m1ToQuiz(el,startFn){
  var my=++m1token;m1Cancel();M1BUSY=true;
  var row=(el.closest&&el.closest('.li'))||el;
  var snap=m1Snap(row);
  m1Play(row,[{transform:'translateY(0)'},{transform:'translateY(-3px)'}],M1D.lift,{easing:'ease-out'});
  var v=document.getElementById('view'),vr=m1Rect(v),rr=m1Rect(row);
  v.style.transformOrigin=(rr.x-vr.x+rr.w/2)+'px '+(rr.y-vr.y+rr.h/2)+'px';
  m1Play(v,[{transform:'scale(1)',opacity:1},{transform:'scale(1.06)',opacity:0}],M1D.bg);
  startFn();                                  /* 内部で go('quiz') される */
  var card=document.getElementById('m1quizcard');
  var v2=document.getElementById('view');
  v2.style.transformOrigin='50% 50%';
  if(!card){M1BUSY=false;return}
  card.style.visibility='hidden';
  var r2=m1FlipTo(snap,card,{dur:M1D.main,rFrom:10,rTo:10});
  m1BgIn(v2,M1D.bg,1.03);
  m1Settle(my);
  if(r2)r2.box.finished.then(function(){if(my===m1token)card.style.visibility='visible'}).catch(function(){});
  else card.style.visibility='visible';
}
/* 学習カード → 小分類のマス（逆再生・進むより短く） */
function m1Back(){
  var hero=document.getElementById('m1hero');
  if(!hero)return false;
  var my=++m1token;m1Cancel();M1BUSY=true;
  var snap=m1Snap(hero),cat=S.cat,vid=S.studyVid;
  /* 着地する行が畳まれていると戻り先が無いので、その大分類を開いておく
     （見た目のためだけでなく「戻ったら元の場所にいる」ためにも必要） */
  var bg=vid?VBIG[vid]:(CINFO[cat]?CINFO[cat].big:null);
  if(bg)S.openBig[bg]=true;
  S.anim=null;go('fields');
  /* 戻り先＝一覧の動画の行（49マスは廃止したので、行が着地点になる） */
  var cell=vid?document.querySelector('[data-act="vid"][data-v="'+cssEsc(vid)+'"]'):null;
  if(!cell)cell=document.querySelector('[data-act="cat"][data-c="'+cssEsc(cat)+'"]');
  if(!cell){M1BUSY=false;return true}
  var lab=vid?(vlab(vid)||cat):cat;
  var r=m1FlipTo(snap,cell,{dur:M1D.back,rFrom:10,rTo:8,outHTML:esc(lab)});
  m1BgIn(document.getElementById('view'),M1D.bg,.995);
  m1Settle(my);
  return true;
}

/* ---------- テスト用フック（検証スクリプトから呼ぶ） ---------- */
window.TK={S:S,F:F,get ST(){return ST},ITEMS:ITEMS,BY:BY,
  answer:answer,applyWhy:applyWhy,startQueue:startQueue,render:render,go:go,
  filtered:filtered,closed:closed,catStat:catStat,stateOf:stateOf,
  severeTopics:severeTopics,allStats:allStats,
  plan:plan,sneakBase:sneakBase,sneakExtra:sneakExtra,learnedCats:learnedCats,catReady:catReady,
  wrongPool:wrongPool,wrongByBigMap:wrongByBigMap,wrongToday:wrongToday,restDays:restDays,restReady:restReady,
  restLeft:restLeft,newQueue:newQueue,unseenItems:unseenItems,bigValue:bigValue,videoStat:videoStat,
  nextVid:nextVid,vidOrder:vidOrder,scoreNow:scoreNow,dayCap:dayCap,daysLeft:daysLeft,REST:REST,
  /* 配点表と得点予測（検証用）。CATQ を直したときに検証担当が同じ検算を再現できるように出す */
  CATQ:CATQ,CATQ_OFF:CATQ_OFF,CATQ_TOTAL:CATQ_TOTAL,BIGQ:BIGQ,BIGQ_WANT:BIGQ_WANT,
  catqCheck:catqCheck,catReach:catReach,
  /* 単元一覧の描画（検証用） */
  catSubs:catSubs,CSUB:CSUB,urowHtml:urowHtml,
  subDupMap:subDupMap,subLabel:subLabel,subExtra:subExtra,subHead:subHead,usubLab:usubLab,
  /* 表示ラベルの優先順位（論点名→小見出し→章名）。検証担当が同じ答えを再現できるように出す */
  jtopOf:jtopOf,trimCite:trimCite,vlabOf:vlabOf,chapTopicLab:chapTopicLab,chapRowLab:chapRowLab,
  CHLAB:CHLAB,          /* 章の行のラベルの覚え書き。データを差し替えて試すときは中を消す */
  USUB_MIN:USUB_MIN,USUB_MAX:USUB_MAX,
  catsSorted:catsSorted,catsOrdered:catsOrdered,nextUnit:nextUnit,
  /* 難易度3段階（検証用）と1本目の動画 */
  d3:d3,d3Rank:d3Rank,d3Hard:d3Hard,D3:D3,dotsHtml:dotsHtml,MINQ:MINQ,bigStat:bigStat,
  firstVid:firstVid,catOfVid:catOfVid,sneakSort:sneakSort,
  doAnswer:doAnswer,next:next,advance:advance,playFx:playFx,clearFx:clearFx,fxLevel:fxLevel,FXST:FXST,
  pickTier:pickTier,FXDUR:FXDUR,itemsOfTopic:itemsOfTopic,att:att,R:R,mk:mk,
  saveRun:saveRun,dropRun:dropRun,hasRun:hasRun,resumeRun:resumeRun,
  secOf:secOf,sortQ:sortQ,SORTS:SORTS,TABS:TABS,
  /* 動画の紐づけ（検証用） */
  vidsOf:vidsOf,pickRank:pickRank,videoItems:videoItems,chapItems:chapItems,chapsOf:chapsOf,chapsFor:chapsFor,
  chapFor:chapFor,whyOf:whyOf,secIn:secIn,NOVID:NOVID,VIDIDS:VIDIDS,CHIDS:CHIDS,
  CHIDS2:CHIDS2,VSECS:VSECS,csecOf:csecOf,isJudged:isJudged,JMARK:JMARK,
  JLINKN:JLINKN,JSPAN:JSPAN,IPOS:IPOS,
  VSRC:VSRC,VTIT:VTIT,SRCS:SRCS,CHAP:CHAP,CINFO:CINFO,CATS:CATS,itemsOfCat:itemsOfCat,
  save:saveST,load:function(){ST=loadST();render()},BOXD:BOXD,addD:addD,today:today,
  /* 動画の通し番号・既習範囲（検証用） */
  NEEDOK:NEEDOK,SEQV:SEQV,seqOfVid:seqOfVid,needSeq:needSeq,nsRank:nsRank,
  watchedMaxSeq:watchedMaxSeq,seqCap:seqCap,inRange:inRange,newAvail:newAvail,
  videoItemsUp:videoItemsUp,chapItemsUp:chapItemsUp,
  /* 一覧（大分類→動画の再生リスト順）と実測時間（検証用） */
  /* 単元の並び（習う順）と大分類の開閉（検証用） */
  catSeqMap:catSeqMap,ubOpenMap:ubOpenMap,vFieldsCat:vFieldsCat,catsOfBig:catsOfBig,
  BIGLEARN:BIGLEARN,BIGVIDS:BIGVIDS,VBIG:VBIG,bigsOrdered:bigsOrdered,bigProg:bigProg,
  vno:vno,vlabel:vlabel,vlab:vlab,VLAB:VLAB,VNOC:VNOC,vshort:vshort,vrowHtml:vrowHtml,
  nextVidOf:nextVidOf,nextCardHtml:nextCardHtml,vlistHtml:vlistHtml,cumItems:cumItems,VCHN:VCHN,
  nextVidAll:nextVidAll,vidsLeft:vidsLeft,flowVids:flowVids,openBigs:openBigs,openBigsNow:openBigsNow,
  contChap:contChap,chapsOf2:chapsOf2,nextChap:nextChap,flowHtml:flowHtml,
  bigOfVid:bigOfVid,severeItem:severeItem,dayOfStamp:dayOfStamp,restCount:restCount,srcRank:srcRank,
  vidMs:vidMs,vpOf:vpOf,tlogSum:tlogSum,tlogDay:tlogDay,addStudyMs:addStudyMs,
  watchStart:watchStart,watchEnd:watchEnd,vminReal:vminReal,vminUsed:vminUsed,TKINDS:TKINDS,
  setResultBtns:setResultBtns,vDone:vDone,VLEN:VLEN,closeRunClock:closeRunClock,
  standalone:standalone,askPersist:askPersist,exportGap:exportGap,needExport:needExport,markExport:markExport,
  M2:M2,M4:M4,M5:M5,get m3T(){return m3T},m3Set:function(){m3Set()},m3Focus:m3Focus,m3Heat:m3Heat,
  m4CountUp:m4CountUp,m4Gauge:m4Gauge,m4BumpCell:m4BumpCell,m4AdvanceBox:m4AdvanceBox,
  m4SetBadge:m4SetBadge,m4UpdateHead:m4UpdateHead,STG:STG,
  hero:function(){return m3hero}};

/* ---------- 視聴の実測（アプリに戻ってきたら締める） ----------
   YouTubeアプリへ飛ばすのでアプリ内では再生時間を測れない。「動画を見る」を押した時刻と
   戻ってきた時刻の差を積む。他のアプリを触っていた時間が混ざり得るため、その動画の尺の
   1.5倍で切り捨て、10秒未満は積まない（watchEnd に同じ注記あり）。 */
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState!=='visible')return;
  var ms=watchEnd();
  if(ms&&S.view==='study')render();
});

/* =========================================================================
   M6 — 手で触る層（polish/M6_feel2.html からの移植）
   1 シート／2 リストの出入りと並び替え（FLIP）／3 初回のスケルトン／
   4 数字の桁ロール／5 タブアイコン／6 長押しのプレビュー／7 iOS 26.6 の4つの手
   ・動かすのは transform と opacity だけ（例外＝タブの stroke-dashoffset）。
   ・作らないもの：端からの戻りジェスチャ／View Transitions／animation-timeline:view()。
   ========================================================================= */
var M6D={sheetIn:320,sheetOut:240,move:320,enter:280,leave:200,fill:400,stag:40,
         roll:400,rollStag:30,tab:300,tabOut:150,pop:200,press:350};
var M6E={eo:'cubic-bezier(.2,.85,.3,1)',ei:'cubic-bezier(.45,.02,.75,1)',
         eio:'cubic-bezier(.4,0,.2,1)',back:'cubic-bezier(.2,1.45,.4,1)'};
var M6TH={sheet:0.30,slop:10};        /* シート＝高さ比／slop＝長押しを取り消す指のブレ(px) */
var M6RMQ=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function m6Reduced(){return !!(M6RMQ&&M6RMQ.matches)}
function m6d(ms){return m6Reduced()?1:ms}     /* 尺だけを落とす（操作の閾値には使わない） */
/* 終わったアニメを畳む責任を持つ（畳まないと getAnimations() に死んだアニメが溜まり実測がずれる）。
   畳むのは onfinish の後（setTimeout 0）。先に cancel すると finish が飛ばず後始末が走らない。 */
function m6anim(el,kf,opt){
  opt=opt||{};
  var a=el.animate(kf,{duration:m6d(opt.duration||300),delay:m6d(opt.delay||0),
    easing:opt.easing||M6E.eo,fill:opt.fill||'forwards'});
  a.finished.then(function(){
    setTimeout(function(){
      if(opt.keep){try{a.commitStyles()}catch(e){}}   /* 終了状態＝休止状態でないものだけ書き戻す */
      try{a.cancel()}catch(e){}
    },0);
  },function(){});
  return a;
}

/* ---------- 1. シート（自前の div。<dialog>／Popover は使わない＝退場が効かないため） ---------- */
var M6SH={drag:false,y0:0,dy:0,h:0};
function m6SheetOpen(){                        /* innerHTML を入れた後に呼ぶ */
  var m=document.getElementById('modal'),s=m.querySelector('.sheet');
  if(!s){m.hidden=false;return}
  if(!s.querySelector('.m6-handle'))           /* ハンドルと上端の影は開くときに1回だけ差す */
    s.insertAdjacentHTML('afterbegin','<div class="m6-handle"><i></i></div><div class="m6-shadow"></div>');
  var was=!m.hidden;
  m.hidden=false;
  if(was){m.style.opacity='1';s.style.transform='translate3d(0,0,0)';return}  /* 開いたまま作り直した */
  s.scrollTop=0;
  m6anim(s,[{transform:'translate3d(0,100%,0)'},{transform:'translate3d(0,0,0)'}],
    {duration:M6D.sheetIn,easing:M6E.eo,keep:true});
  m6anim(m,[{opacity:0},{opacity:1}],{duration:M6D.sheetIn,easing:M6E.eo,keep:true});
}
function m6SheetClose(dy,after){
  var m=document.getElementById('modal'),s=m.querySelector('.sheet');
  if(!s){m.hidden=true;if(after)after();return null}
  var h=s.getBoundingClientRect().height||1,y=dy||0;
  var a=m6anim(s,[{transform:'translate3d(0,'+y+'px,0)'},{transform:'translate3d(0,100%,0)'}],
    {duration:M6D.sheetOut,easing:M6E.ei});
  m6anim(m,[{opacity:Math.max(0,1-y/h*0.9)},{opacity:0}],{duration:M6D.sheetOut,easing:M6E.ei});
  a.onfinish=function(){m.hidden=true;s.style.transform='translate3d(0,100%,0)';m.style.opacity='0';
    if(after)after()};
  return a;
}
/* 指で下に引く（#modal は render() で作り直されないので1回だけ付ければよい） */
(function(){
  var m=document.getElementById('modal');
  if(!m)return;
  m.addEventListener('pointerdown',function(e){
    var s=m.querySelector('.sheet'); if(!s||m.hidden)return;
    if(!s.contains(e.target))return;                       /* 暗幕タップ＝閉じる（既存動作） */
    if(e.target.closest&&e.target.closest('textarea,input,select'))return;
    if(s.scrollTop>0)return;                               /* 中身がスクロール中は引かない */
    M6SH.drag=true;M6SH.y0=e.clientY;M6SH.dy=0;M6SH.h=s.getBoundingClientRect().height||1;
    s.getAnimations().forEach(function(a){a.cancel()});
    m.getAnimations().forEach(function(a){a.cancel()});
    s.style.transform='translate3d(0,0,0)';m.style.opacity='1';
  });
  window.addEventListener('pointermove',function(e){
    if(!M6SH.drag)return;
    var s=m.querySelector('.sheet'); if(!s){M6SH.drag=false;return}
    M6SH.dy=Math.max(0,e.clientY-M6SH.y0);                 /* 上へは引かない */
    s.style.transform='translate3d(0,'+M6SH.dy+'px,0)';
    m.style.opacity=String(Math.max(0,1-(M6SH.dy/M6SH.h)*0.9));
  },{passive:true});
  function up(){
    if(!M6SH.drag)return; M6SH.drag=false;
    var s=m.querySelector('.sheet'); if(!s)return;
    if(M6SH.dy/M6SH.h>M6TH.sheet){m6SheetClose(M6SH.dy,function(){render()});return}
    m6anim(s,[{transform:'translate3d(0,'+M6SH.dy+'px,0)'},{transform:'translate3d(0,0,0)'}],
      {duration:M6D.sheetOut,easing:M6E.eo,keep:true});
    m6anim(m,[{opacity:Math.max(0,1-(M6SH.dy/M6SH.h)*0.9)},{opacity:1}],
      {duration:M6D.sheetOut,easing:M6E.eo,keep:true});
  }
  window.addEventListener('pointerup',up);
  window.addEventListener('pointercancel',up);
})();
/* 出典・根拠・章のリンクはシートに寄せる（その場で開かない＝問題文の座標が動かない） */
function srcSheet(id){
  var it=BY[id]; if(!it)return;
  var chs=chapsFor(it),why=whyOf(it,S.baseVid||null);
  if(!why.length)why=whyOf(it);
  var m=document.getElementById('modal');
  m.innerHTML='<div class="sheet">'
   +'<div class="spread" style="margin-bottom:10px"><div class="h" style="margin:0">出典と根拠</div>'
   +'<button class="btn sm" data-act="closeModal">'+IC.close+'閉じる</button></div>'
   +'<div class="m6-stxt">'+esc(srcLabel(it))+'</div>'
   /* 出題中は根拠（判定の理由）も出さない＝何を問われているかの手がかりになる */
   +((why.length&&!(S.view==='quiz'&&S.phase==='q'))
      ?'<div class="mini" style="margin-top:6px">根拠 '+esc(why.join('・'))+'</div>':'')
   /* 出題中は動画リンクを出さない（章名が答えを示す。2026-08-18 本人指摘）。
      答えた後の解説には同じリンクが出るので、学習の妨げにはならない。 */
   +((S.view==='quiz'&&S.phase==='q')
      ?'<div class="mini" style="margin-top:8px">動画のリンクと章は、答えた後に出します</div>'
      :'')
   +((chs.length&&!(S.view==='quiz'&&S.phase==='q'))?'<div class="hr"></div>'+chs.map(function(ch){
       return '<a class="link" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.yt
        +'<span class="lbl'+(ch.jt?' w':'')+'">'+esc(ch.label)+(ch.src?'（'+esc(ch.src)+'）':'')+'</span>'
        +'<span class="tm num">'+mmss(ch.sec)+'</span>'+IC.chev+'</a>';
     }).join(''):'')
   +'</div>';
  m6SheetOpen();
}

/* ---------- 2. リストの出入りと並び替え（FLIP／render() を挟んでも動く） ---------- */
var M6FV={};                                   /* 進捗の塗りの前回値（render で DOM が変わるため外に持つ） */
function m6Keys(){return document.querySelectorAll('#view [data-m6k]')}
function m6FlipRender(mutate){
  var first={},node={},els=m6Keys(),i,el,k;
  for(i=0;i<els.length;i++){k=els[i].dataset.m6k;first[k]=els[i].getBoundingClientRect();node[k]=els[i]}
  mutate();                                    /* ここで render() が走る＝DOMは別物になる */
  var now=m6Keys(),n=0,seen={};
  for(i=0;i<now.length;i++){
    el=now[i];k=el.dataset.m6k;seen[k]=1;
    var b0=first[k];
    if(!b0){                                   /* 新しく現れた行＝フェードイン */
      m6anim(el,[{opacity:0,transform:'translate3d(0,6px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],
        {duration:M6D.enter,delay:Math.min(n++,7)*M6D.stag,easing:M6E.eo});
      continue;
    }
    var b1=el.getBoundingClientRect(),dy=b0.top-b1.top;
    if(Math.abs(dy)>0.5)                       /* 残った行＝もとの位置から滑らせる */
      m6anim(el,[{transform:'translate3d(0,'+dy+'px,0)'},{transform:'translate3d(0,0,0)'}],
        {duration:M6D.move,delay:Math.min(n++,7)*M6D.stag,easing:M6E.eio});
  }
  var g=0;                                     /* 消えた行＝その場でフェードして流れから外す */
  for(k in first){
    if(seen[k]||g>=8)continue;
    var r=first[k];
    if(r.bottom<0||r.top>window.innerHeight)continue;   /* 画面外の行にゴーストは作らない */
    m6Ghost(node[k],r);g++;
  }
}
function m6Ghost(el,r){
  var fx=document.getElementById('m1fx');
  if(!fx||!el)return;
  var g=document.createElement('div');
  /* left/top は一度だけ置くための静的な値。動かすのは opacity と transform だけ */
  g.style.cssText='position:absolute;left:'+(r.left+window.scrollX)+'px;top:'+(r.top+window.scrollY)+'px;'
    +'width:'+r.width+'px;height:'+r.height+'px;pointer-events:none;overflow:hidden';
  g.appendChild(el);                           /* 作り直しで外れた実物のノードをそのまま使う */
  fx.appendChild(g);
  var a=m6anim(g,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.985)'}],
    {duration:M6D.leave,easing:M6E.ei});
  a.onfinish=function(){if(g.parentNode)g.parentNode.removeChild(g)};
}
/* 進捗の塗り（width:% をやめて scaleX にした本体）。render() の最後に1回呼ぶ */
function m6Fills(root){
  var f=(root||document).querySelectorAll('[data-m6v]'),i;
  for(i=0;i<f.length;i++){
    var el=f[i],to=parseFloat(el.dataset.m6v)||0,key=el.dataset.m6vk||'';
    var cur=(key&&M6FV[key]!==undefined)?M6FV[key]:0;
    if(key)M6FV[key]=to;
    if(Math.abs(to-cur)<0.001){el.style.transform='scaleX('+to+')';continue}
    m6anim(el,[{transform:'scaleX('+cur+')'},{transform:'scaleX('+to+')'}],
      {duration:M6D.fill,easing:M6E.eo,keep:true});
  }
}

/* ---------- 3. 初回のスケルトン（待ちが実際にあるのは「データの読み込み」だけ） ----------
   単一HTML（宅建.html）はデータが十数MBあり、body を描いてから JS が動き出すまでに実際の待ちがある。
   その間だけ #m6boot（静的な骨組み）が見えている。実データが来たら位置を動かさずクロスフェード。
   明滅は 0.9秒×2＝1.8秒で必ず止まる（infinite にしない＝安全基準）。 */
var M6BOOT=true;
/* ---------- 起動の演出（2026-08-18 本人指示） ----------
   本人「筋トレのアプリの時みたくなんか出てる…デザインというかアニメーションつけてほしい」
   「最初の画面はランダムで色々出るようにしたい」
   採用11案（B・D・I2・K・L・N・O・P・Q・R・S）から**起動ごとに1つ引く**。
   覆いは全画面。演出が終わったら消してホームが現れる。1回だけ（同じ起動で2回出さない）。
   ・束は殻の bootfx.js（tools/build_bootfx.py が作る）。無ければ何もしない＝学習は止めない
   ・演出中でも触れば飛ばせる（待たされない）
   ・端末が「動きを控える」設定なら出さない（bootfx 側で判定） */
var BOOTFXDONE=false;
function bootFx(){
  if(BOOTFXDONE)return; BOOTFXDONE=true;
  var B=window.TAKKEN_BOOTFX;
  if(!B||typeof B.play!=='function')return;
  var ov=document.createElement('div');
  ov.id='bfx';
  document.body.appendChild(ov);
  var id=B.play(ov);
  if(!id){if(ov.parentNode)ov.parentNode.removeChild(ov);return}
  var gone=false;
  function bye(){
    if(gone)return; gone=true;
    var a=ov.animate?ov.animate([{opacity:1},{opacity:0}],
      {duration:260,easing:'cubic-bezier(.4,0,.7,.2)',fill:'forwards'}):null;
    var rm=function(){if(ov.parentNode)ov.parentNode.removeChild(ov)};
    if(a)a.onfinish=rm; else rm();
  }
  ov.addEventListener('pointerdown',bye);      /* 触れば飛ばせる */
  setTimeout(bye,2300);                        /* どの案も2.2秒以内に終わる */
}
function m6BootSwap(){
  if(!M6BOOT)return; M6BOOT=false;
  var b=document.getElementById('m6boot'),v=document.getElementById('view');
  if(!b){return}
  var sk=b.querySelectorAll('.m6-skel'),i;
  m6anim(v,[{opacity:0},{opacity:1}],{duration:M6D.leave,easing:M6E.eo});
  for(i=0;i<sk.length;i++){
    (function(el,k){
      var a=m6anim(el,[{opacity:1},{opacity:0}],
        {duration:M6D.leave,delay:Math.min(k,7)*M6D.stag,easing:M6E.ei});
      a.onfinish=function(){if(el.parentNode)el.parentNode.removeChild(el)};
    })(sk[i],i);
  }
  setTimeout(function(){if(b.parentNode)b.parentNode.removeChild(b)},
    m6d(M6D.leave)+m6d(7*M6D.stag)+60);
}

/* ---------- 4. 数字の桁ロール（1〜3桁の整数の「入れ替わり」。m4CountUp とは併用しない） ---------- */
var M6RV={};                                   /* 前回値（render() で DOM が作り直されるため外に持つ） */
function m6RollBuild(el,str){
  el.textContent='';
  var i,ch,col,strip,sp;
  for(i=0;i<str.length;i++){
    ch=str.charAt(i);
    col=document.createElement('span');col.className='m6-col';
    strip=document.createElement('span');strip.className='m6-strip';
    sp=document.createElement('span');sp.textContent=ch;
    strip.appendChild(sp);col.appendChild(strip);el.appendChild(col);
  }
  el.dataset.str=str;
}
function m6RollFit(el,v){                      /* 書式（data-fmt）の桁数へ必ず空白で右詰め＝幅一定 */
  var fmt=el.dataset.fmt||'__';
  var dec=fmt.indexOf('.')>=0?(fmt.length-fmt.indexOf('.')-1):0;
  var s=dec?Number(v).toFixed(dec):String(Math.round(v));
  while(s.length<fmt.length)s=' '+s;
  if(s.length>fmt.length)s=s.slice(s.length-fmt.length);
  return s;
}
function m6RollTo(el,v){
  var to=m6RollFit(el,v),from=el.dataset.str,out=[],k=0,i;
  if(from===undefined||from.length!==to.length){m6RollBuild(el,to);return out}
  for(i=0;i<to.length;i++){
    if(from.charAt(i)===to.charAt(i))continue;
    out.push(m6RollCol(el.children[i],to.charAt(i),k++));
  }
  el.dataset.str=to;
  return out;
}
function m6RollCol(col,ch,k){
  var strip=col.firstElementChild;
  var h=col.getBoundingClientRect().height;
  var nx=document.createElement('span');nx.textContent=ch;
  strip.appendChild(nx);                       /* [旧, 新] を縦に積んで上へ回す */
  var a=m6anim(strip,[{transform:'translate3d(0,0,0)'},{transform:'translate3d(0,'+(-h)+'px,0)'}],
    {duration:M6D.roll,delay:k*M6D.rollStag,easing:M6E.eo});
  a.onfinish=function(){
    strip.textContent='';strip.appendChild(nx);strip.style.transform='translate3d(0,0,0)';
    try{a.cancel()}catch(e){}
  };
  return a;
}
/* render() の直後に呼ぶ。前回値から作り直してから今回値へ回す（初期化直後は回らない） */
function m6Rolls(root){
  var f=(root||document).querySelectorAll('[data-m6r]'),i;
  for(i=0;i<f.length;i++){
    var el=f[i],id=el.dataset.m6id||'',to=parseFloat(el.dataset.m6r)||0;
    var prev=(id&&M6RV[id]!==undefined)?M6RV[id]:to;
    m6RollBuild(el,m6RollFit(el,prev));
    m6RollTo(el,to);
    if(id)M6RV[id]=to;
  }
}

/* ---------- 5. タブアイコン（選択したタブだけ線を引くように描く） ---------- */
var M6TAB=null;
function m6TabDraw(){
  var cur=document.querySelector('#tabs button.on');
  if(!cur){M6TAB=null;return}
  var u=cur.querySelector('.m6-uline'),key=cur.dataset.v;
  if(!u)return;
  if(key===M6TAB){u.style.transform='scaleX(1)';u.style.opacity='1';return}  /* 同じタブの再描画は動かさない */
  M6TAB=key;
  var sh=cur.querySelectorAll('svg *'),i,el,L;
  for(i=0;i<sh.length;i++){
    el=sh[i];L=el.getTotalLength?el.getTotalLength():40;
    if(!L)continue;
    el.style.strokeDasharray=L+' '+L;
    m6anim(el,[{strokeDashoffset:L},{strokeDashoffset:0}],{duration:M6D.tab,delay:i*12,easing:M6E.eo});
  }
  m6anim(u,[{transform:'scaleX(0)',opacity:0},{transform:'scaleX(1)',opacity:1}],
    {duration:M6D.tab,easing:M6E.eo,keep:true});
  m6anim(cur.querySelector('svg'),
    [{transform:'translate3d(0,0,0) scale(1)'},{transform:'translate3d(0,-2px,0) scale(1.06)'},
     {transform:'translate3d(0,0,0) scale(1)'}],{duration:M6D.tab,easing:M6E.back});
}

/* ---------- 6. 長押しのプレビュー（350ms。閾値なので reduced-motion でも短縮しない） ---------- */
var M6PR={t:null,row:null,x:0,y:0,fired:false,lift:null};
function m6Pop(){
  var p=document.getElementById('m6pop');
  if(!p){
    p=document.createElement('div');p.className='m6-pop';p.id='m6pop';
    p.setAttribute('aria-hidden','true');
    p.innerHTML='<div class="m6-pk"></div><div class="m6-ptxt"></div>';
    document.getElementById('m1fx').appendChild(p);
  }
  return p;
}
function m6PopShow(row){
  var v=String(row.getAttribute('data-m6pv')||''),ix=v.indexOf('|');
  var p=m6Pop(),b=row.getBoundingClientRect();
  p.firstChild.textContent=ix>=0?v.slice(0,ix):'';
  p.lastChild.textContent=ix>=0?v.slice(ix+1):v;
  p.classList.add('on');p.setAttribute('aria-hidden','false');
  p.style.left=(b.left+window.scrollX)+'px';
  p.style.width=b.width+'px';
  p.style.top='0px';
  var ph=p.getBoundingClientRect().height;
  var top=b.top+window.scrollY-ph-8;
  if(b.top-ph-8<8)top=b.bottom+window.scrollY+8;          /* 上に入らなければ下に出す */
  p.style.top=top+'px';                                    /* top は一度置くだけで動かさない */
  M6PR.lift=row;
  m6anim(row,[{transform:'scale(1)'},{transform:'scale(1.015)'}],
    {duration:M6D.pop,easing:M6E.eo,keep:true});           /* 押した行を1.5%持ち上げる＝主役 */
  var from=(b.top+window.scrollY)<top?-6:6;
  return m6anim(p,[{opacity:0,transform:'translate3d(0,'+from+'px,0) scale(.96)'},
                   {opacity:1,transform:'translate3d(0,0,0) scale(1)'}],
    {duration:M6D.pop,easing:M6E.eo,keep:true});
}
function m6PopHide(){
  var p=document.getElementById('m6pop');
  if(M6PR.lift){
    (function(row){
      var la=m6anim(row,[{transform:'scale(1.015)'},{transform:'scale(1)'}],
        {duration:M6D.pop,easing:M6E.ei});
      la.onfinish=function(){row.style.transform=''};      /* 残った inline を消す＝FLIPの初期値を汚さない */
    })(M6PR.lift);
    M6PR.lift=null;
  }
  if(!p||p.getAttribute('aria-hidden')==='true')return null;
  p.setAttribute('aria-hidden','true');
  var a=m6anim(p,[{opacity:1,transform:'translate3d(0,0,0) scale(1)'},
                  {opacity:0,transform:'translate3d(0,0,0) scale(.98)'}],
    {duration:M6D.pop,easing:M6E.ei,keep:true});
  a.onfinish=function(){p.classList.remove('on');try{a.cancel()}catch(e){}};
  return a;
}
document.addEventListener('contextmenu',function(e){
  if(e.target.closest&&e.target.closest('[data-m6pv]'))e.preventDefault();
});
document.addEventListener('pointerdown',function(e){
  var row=e.target.closest?e.target.closest('[data-m6pv]'):null;
  if(!row)return;
  M6PR.row=row;M6PR.x=e.clientX;M6PR.y=e.clientY;M6PR.fired=false;
  clearTimeout(M6PR.t);
  M6PR.t=setTimeout(function(){M6PR.fired=true;m6PopShow(row)},M6D.press);   /* m6d() を通さない */
},true);
document.addEventListener('pointermove',function(e){
  if(!M6PR.row)return;
  if(Math.abs(e.clientX-M6PR.x)>M6TH.slop||Math.abs(e.clientY-M6PR.y)>M6TH.slop){
    clearTimeout(M6PR.t);M6PR.row=null;if(M6PR.fired)m6PopHide();
  }
},{passive:true,capture:true});
function m6PressEnd(){
  clearTimeout(M6PR.t);M6PR.row=null;
  if(M6PR.lift||document.getElementById('m6pop'))m6PopHide();
}
document.addEventListener('pointerup',m6PressEnd,true);
document.addEventListener('pointercancel',m6PressEnd,true);
document.addEventListener('click',function(e){
  if(M6PR.fired){e.stopPropagation();e.preventDefault();M6PR.fired=false}
},true);
/* 章の開閉（<details>）＝JSで開閉しない。開いた状態だけ S.openChap に写して再描画に耐えさせる。
   大分類（data-k が "B:" で始まる）だけは記録（settings.ubOpen）にも残す
   ＝アプリを開き直しても同じ状態にする（2026-08-15 本人指示「開閉の状態を覚える」）。 */
document.addEventListener('toggle',function(e){
  var d=e.target;
  if(!d||!d.classList||!d.classList.contains('m6-det'))return;
  var k=d.getAttribute('data-k');
  if(!k)return;
  if(k.slice(0,2)==='B:'){
    var m=ubOpenMap();
    m[k.slice(2)]=d.open;
    ST.settings.ubOpen=m;saveST();
    return;
  }
  S.openChap[k]=d.open;
},true);

/* ---------- 起動 ---------- */
catqCheck();                                 /* 配点表の検算（合計50.00・単元名の一致）を console に出す */
askPersist();                                /* 記録を消されないように永続化を要求（未対応環境では何もしない） */
m3Init();                                    /* 3層の生成とスクロール視差 */
M2.setSound(!!(ST.settings&&ST.settings.sound));
/* 押した感は委譲で当てる（innerHTML で作り直しても消えない）。
   問題のカードは押すものではないので入れない（触ったときの動きは M3 の傾きだけ） */
M2.delegate('[data-act],.cell,.b,.tog,.cb,.tapline,#tabs button');
/* 【一度きり】単元学習を既定に寄せる（2026-08-15 本人指示「単元学習をメインにしたい」）。
   既定値を変えるだけでは本人の画面は変わらない：旧版は起動のたびに settings.fmode='video' を
   書き込んでいたので、記録の 'video' が「本人が動画を選んだ」のか「まだ選んでいない」のかを
   区別できない。区別できない以上、注文どおりにするにはこの版で1回だけ寄せるしかない。
   印（fmode1）を立てて二度とやらない。切り替えボタンで「動画で進む」に戻せば、
   そのとき saveST() で fmode='video' と fmode1=true が一緒に残るので、以後は本人の選択が勝つ。 */
if(ST.settings&&ST.settings.fmode1!==true){
  ST.settings.fmode1=true;ST.settings.fmode='cat';S.fmode='cat';
  if(!STBROKEN)saveST();
}
render();
/* 起動の区切り。初回だけ長め（0.77秒）、2回目以降は0.39秒（毎回長い演出を強制しない） */
var m5first=!(ST.settings&&ST.settings.launched);
/* 起動のたびに ST 全体を書き戻さない（壊れた記録を確定的に潰すため。2026-08-15 批評）。
   launched は「初回だけ演出を長くする」ためだけの印なので、他の保存のついでで足りる。 */
if(ST.settings&&!ST.settings.launched){ST.settings.launched=true;if(!STBROKEN)saveST()}
M5.playIntro(m5first);
