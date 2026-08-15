
'use strict';
/* =========================================================
   宅建 一問一答（SPEC.md §2〜§5 実装 / デザイン案6 カード式）
   データは window.TAKKEN_ITEMS / window.TAKKEN_CHAPTERS のみ（fetch不使用）
   ========================================================= */

/* ---------- 定数 ---------- */
var LSK='takken_v1';
var RAW=window.TAKKEN_ITEMS||[];
var CHAP=window.TAKKEN_CHAPTERS||{};
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
var SEC_PER_Q=30;                   /* 1問あたりの想定時間（秒）＝学習時間の換算に使う */
var EXAM_DEFAULT='2026-10-18';      /* 試験日（10月第3日曜・受験票で確認） */
var PASS_LINE=35;                   /* 合格ラインの目安 */
/* 本試験の出題数（計50） */
var BIGQ={'権利関係':14,'法令上の制限':8,'宅地建物取引業法等':20,'税に関する法令':2,
          '不動産価格の評定':1,'土地・建物その他の需給':5};

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
 play:svg('<circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.6l5 3.4-5 3.4z"/>'),
 check:svg('<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',2),
 chev:svg('<path d="M9 5l7 7-7 7"/>'),
 down:svg('<path d="M5 9l7 7 7-7"/>'),
 up:svg('<path d="M5 15l7-7 7 7"/>'),
 warn:svg('<path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4"/><path d="M12 16.7v.3"/>'),
 io:svg('<path d="M12 3.5v11"/><path d="M8 11l4 4 4-4"/><path d="M4.5 19.5h15"/>'),
 close:svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'),
 clock:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
 lock:svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>')
};

/* ---------- 大分類・小分類・章の索引 ---------- */
var BIGS=[],CATS=[],CINFO={};
ITEMS.forEach(function(it){
  if(BIGS.indexOf(it.big)<0)BIGS.push(it.big);
  if(!CINFO[it.cat]){CINFO[it.cat]={big:it.big,ids:[],topics:[]};CATS.push(it.cat)}
  var c=CINFO[it.cat];c.ids.push(it.id);
  var t=it.topic||'未分類';if(c.topics.indexOf(t)<0)c.topics.push(t);
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
function vidsOf(it){
  if(it._vs)return it._vs;
  var a=[];
  if(it.videos&&it.videos.length)a=it.videos;
  else if(it.video&&it.video.vid)a=[it.video];
  a=a.filter(function(v){return v&&v.vid&&!SRCHIDE[VSRC[v.vid]]});
  a.sort(function(x,y){
    var d=srcRank(x.vid)-srcRank(y.vid);
    if(d)return d;
    return (VUP[y.vid]||'').localeCompare(VUP[x.vid]||'');   /* 新しい動画を先に */
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
var DEFSRC='こざりえ';                    /* 出題順・一覧・ホームの基準 */
var SRCHIDE={'れくお':1};                  /* 使わないチャンネル（本人指定・2026-08-14） */
var SRCS=[DEFSRC];                        /* 基準に選べるチャンネル（既定を先頭に） */
Object.keys(VSRC).forEach(function(v){
  var sc=VSRC[v];
  if(sc&&!SRCHIDE[sc]&&SRCS.indexOf(sc)<0)SRCS.push(sc);
});
var VIDIDS={},CHIDS={},SECOK={},NOVID=[];
ITEMS.forEach(function(it){
  var vs=vidsOf(it);
  if(!vs.length){NOVID.push(it.id);return}
  var seen={};
  vs.forEach(function(v){
    if(!seen[v.vid]){seen[v.vid]=1;(VIDIDS[v.vid]=VIDIDS[v.vid]||[]).push(it.id)}
    if(typeof v.sec==='number'){var k=v.vid+'#'+v.sec;(CHIDS[k]=CHIDS[k]||[]).push(it.id);SECOK[v.vid]=true}
  });
});
function videoItems(vid){return (VIDIDS[vid]||[]).map(function(i){return BY[i]})}
/* 章の問題＝「vid＋秒」だけで引く（実データは 8,074/8,074 が秒で一致する）。
   章名も併用すると、同じ章名が2か所に出てくる動画（こうのすけ）で同じ問題が
   2つの行に二重に出て、行の合計が動画の問題数を超える。だから秒に一本化する。
   秒が合わないデータが来た場合は章が0問になるので、vStudy 側で警告を出して気づけるようにする。 */
function chapItems(vid,sec){
  return (CHIDS[vid+'#'+sec]||[]).map(function(i){return BY[i]});
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
function inRange(it,cap){
  if(ST.settings&&ST.settings.ahead)return true;
  var ob=openBigs();
  if(S.baseVid){var b=bigOfVid(S.baseVid);if(b)ob[b]=1}
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
function chapOf(v,it){
  return {vid:v.vid,sec:(typeof v.sec==='number'?v.sec:0),title:v.title||VTIT[v.vid]||'',
          label:v.chapter||it.topic||it.cat,member:!!(v.member||VMEM[v.vid]),
          src:VSRC[v.vid]||'',why:v.why||[]};
}
/* その問題を代表する章（基準の動画→既定チャンネル→先頭） */
function chapFor(it){
  var vs=vidsOf(it);if(!vs.length)return null;
  var pick=null,bp=9;
  vs.forEach(function(v){
    var p=(S.baseVid&&v.vid===S.baseVid)?0:((VSRC[v.vid]===baseSrc())?1:2);
    if(p<bp){bp=p;pick=v}
  });
  return chapOf(pick||vs[0],it);
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
function today(){return nowStamp().slice(0,10)}
function dnum(s){if(!s)return null;var p=String(s).slice(0,10).split('-');if(p.length<3)return null;return Date.UTC(+p[0],+p[1]-1,+p[2])/86400000}
function dgap(a,b){var x=dnum(a),y=dnum(b);return (x===null||y===null)?0:Math.round(y-x)}
function addD(day,n){var d=new Date((dnum(day)+n)*86400000);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}

/* ---------- 進行状況（localStorage takken_v1） ---------- */
var LSOK=true;
var ST=loadST();
applyTheme();          /* 保存されている配色を、描画より前に当てる（切り替わりが見えない） */
setTimeout(function(){try{ghAuto('boot')}catch(e){}},4000);    /* 起動のたび（中身が変わっていれば） */
function loadST(){var o={};try{o=JSON.parse(localStorage.getItem(LSK)||'{}')||{}}catch(e){o={};LSOK=false}return normST(o)}
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
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.settings.exam||''))o.settings.exam=EXAM_DEFAULT;  /* 試験日 */
  if(typeof o.settings.min!=='number'||o.settings.min<10)o.settings.min=120;         /* 1日の学習時間（分） */
  if(typeof o.settings.vmin!=='number'||o.settings.vmin<0)o.settings.vmin=39;        /* うち動画を見る時間（分） */
  /* settings.hint（スワイプの案内を出した回数）はスワイプ廃止で不要になったので持たない */
  if(o.settings.hint!==undefined)delete o.settings.hint;
  if(typeof o.settings.ahead!=='boolean')o.settings.ahead=false;  /* 未習の範囲も出す（既定＝オフ） */
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
  return String(d).slice(0,10);
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
function nextVid(vid){
  var a=vidOrder(),i=-1;
  for(var k=0;k<a.length;k++)if(a[k].vid===vid){i=k;break}
  if(i<0)return null;
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
/* 重症の基準（2026-08-14 見直し）。旧＝「誤答3回」または「同じ章で2問ミス」だったが、
   1小分類は平均108問あるので、2問ミス（1.9%）で章ごと重症になり広すぎた。
   ・問題：誤答3回以上で、かつ直近が正解していない（正解が続けば重症から外れる）
   ・章　：5問以上解いたうえで誤答した問題が35%以上、または重症の問題が2つ以上 */
function severeItem(id){var r=R(id);return !!r&&(r.ng||0)>=3&&(r.streak||0)===0}
var SEV_MIN=5,SEV_RATE=0.35,SEV_HARD=2;
function severeTopics(){
  var m={},out=[];
  ITEMS.forEach(function(it){
    var r=R(it.id);if(!r||att(r)===0)return;
    var k=it.cat+'|:|'+(it.topic||'未分類');
    var o=m[k]||(m[k]={att:0,ids:[],ng:0,hard:0});
    o.att++;
    if((r.ng||0)>0){o.ids.push(it.id);o.ng+=r.ng||0}
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
  var its=itemsOfCat(cat),n=its.length,a=0,ok=0,ng=0,grad=0,keep=0,okn=0;
  its.forEach(function(it){var r=R(it.id);if(!r)return;if(att(r)>0)a++;ok+=r.ok||0;ng+=r.ng||0;
    if((r.ok||0)>0)okn++;          /* 一度でも正解した問題の数＝達成度の分子 */
    var s=stateOf(it.id);if(s==='卒業')grad++;else if(s==='定着')keep++;});
  var lv=0;
  if(closed(cat))lv=3;else if(a>0&&(grad+keep)>=Math.ceil(n*0.5))lv=2;else if(a>0)lv=1;
  return {n:n,att:a,ok:ok,ng:ng,okn:okn,grad:grad,keep:keep,lv:lv,rate:(ok+ng)?ok/(ok+ng):null,
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
    return !!r&&(r.streak||0)===0&&(r.ng||0)>0&&r.lastNg&&String(r.lastNg).slice(0,10)===t;
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
function bigOfVid(vid){
  for(var b in BIGVIDS){if((BIGVIDS[b]||[]).indexOf(vid)>=0)return b}
  return null;
}
function unseenItems(all){
  var lim=NEEDOK&&!all&&!(ST.settings&&ST.settings.ahead);
  var ob=lim?openBigs():null;
  var a=ITEMS.filter(function(it){
    if(att(R(it.id))!==0)return false;
    if(!lim)return true;
    if(!ob[it.big])return false;      /* その科目の動画をまだ見ていない */
    return true;
  });
  var _unused=function(it){
    var n=needSeq(it);
    /* 通し番号が無い問題は「新規」に含めない（順序が決められないものを混ぜると
       「新規＝既習範囲の未着手」の定義が崩れる。2026-08-14 メイン担当の判断）。
       出題順では末尾のまま／復習・抜き打ち・絞り込みからは外さない＝自分で選べば解ける。 */
    if(n===null)return false;
    return false;
  };
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
  /* ③それでも余ったら新規を増やし（1周を早める）、新規が尽きていれば抜き打ちを上積みする */
  var newN=Math.min(unseen.length,newRes+Math.max(0,cap-newRes-sneak.length));
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
  if(F.recent){if(!(r&&r.lastNg))return false;if(dgap(r.lastNg,today())>F.recent-1)return false}
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
    return bigRank(x)-bigRank(y)||kvRank(x)-kvRank(y)||secOf(x)-secOf(y)
      ||nsRank(x)-nsRank(y)||d3Rank(x)-d3Rank(y)||unseenRank(x)-unseenRank(y)||cmpId(x,y);
  });
  return a;
}
/* まだ解いていない問題だけに絞る。1問も残っていなければ全部返す（＝復習として解き直せる）。 */
function restOnly(list){
  var rest=list.filter(function(it){return att(R(it.id))===0});
  return rest.length?rest:list;
}
/* 通し番号（並べ替え用）。番号が無い問題は末尾へ */
function nsRank(it){var n=needSeq(it);return n===null?99999:n}
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
        openBig:{},openCat:{},openOther:{},openDone:{},openFilter:false,anim:null,baseVid:null,baseSrc:DEFSRC,openChap:{},
        wrongs:[],round:0,roundVid:null,srcOpen:false,lockedOut:0,kind:'new',studyVid:null,
        sT:0,sR:0,sStreak:0,sBest:0,spent:0,
        enter:true,dir:null,tier:null,ev:null,broke:false};

function startQueue(list,label,withSneak,baseVid,keepGrad){
  S.baseVid=baseVid||null;                 /* 基準の動画（指定が無ければ既定のチャンネル基準） */
  /* 卒業した問題は通常出題から外す。ただし抜き打ち（keepGrad）と周回は別 */
  var arr=list.filter(function(it){return !isGrad(R(it.id))||S.round>0||keepGrad});
  /* 未習の範囲を出さない（既定）。need_seq が「見た動画の最大の通し番号」を超える問題は、
     まだ習っていない知識が必要なので出さない。設定「未習の範囲も出す」でこの制限を外せる。
     一度でも解いた問題は対象にしない（間違い直し・抜き打ちが消えてしまうため）。
     周回（間違い直し）も対象にしない。除外した件数は出題画面に小さく出す（黙って消さない）。 */
  /* 未習の範囲を出さない判定は inRange（大分類ベース）に一本化した。
     ここで通し番号（あこ課長の再生リスト順）を使うと、主教材がこざりえになった今は
     ほぼ全部が落ちる（2026-08-14 実測：162問→1問）。 */
  S.lockedOut=0;
  if(!S.round&&!(ST.settings&&ST.settings.ahead)){
    var before=arr.length;
    arr=arr.filter(function(it){return att(R(it.id))>0||inRange(it)});
    S.lockedOut=before-arr.length;
  }
  arr=sortQ(arr);
  S.sneak={};
  /* 抜き打ちは「復習」として独立した枠で出す（新規の順序を乱さない）ので、
     通常のセッションに混ぜ込むことはしない。 */
  if(!S.round){S.wrongs=[];S.roundVid=baseVid||null}  /* 周回でないセッションの開始で溜め直す */
  S.queue=arr.map(function(it){return it.id});
  S.qi=0;S.phase='q';S.res=null;S.label=label||'';
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
  if(r.filter){for(var k in F){if(r.filter[k]!==undefined)F[k]=r.filter[k]}}
  /* 難易度の絞り込みは5段階（A〜E）から3段階（易・普・難）へ変わったので、古い値は落とす
     （残すと「どのチップも選ばれていないのに該当0問」になる） */
  if(F.difs&&F.difs.length)F.difs=F.difs.filter(function(d){return D3.indexOf(d)>=0});
  saveRun(fromStart);
  S.anim='card';
  go('quiz');
}
function go(v){S.view=v;S.enter=true;window.scrollTo(0,0);render()}

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
  m6BootSwap();                        /* 初回だけ：骨組み→実データのクロスフェード */
  S.enter=false;S.dir=null;S.anim=null;ANIMON=false;
  LASTVIEW=S.view;
  if(S.view==='quiz')bindTilt();
  /* 入場アニメーションが終わったらクラスを外す。終わった時点の見た目は最終状態と同じなので
     見た目は変わらず、あとで再描画されても座標が飛ばない。 */
  Array.prototype.forEach.call(v.querySelectorAll('.qin'),function(el){
    el.addEventListener('animationend',function(){el.classList.remove('qin')},{once:true});
  });
}
var LASTVIEW=null,ANIMON=false;
/* 段差クラス（入場時だけ付ける） */
function stag(){return ANIMON?' stag':''}
var TABS=[['home','ホーム',IC.home],['fields','動画学習',IC.book],['review','復習',IC.again],['analysis','分析',IC.chart]];
function renderTabs(){
  var cur=(S.view==='study'||S.view==='fields')?'fields':(S.view==='quiz'?'':S.view);
  /* アイコンのみ（文字ラベルなし）。読み上げ用に aria-label と title を残す */
  document.getElementById('tabs').innerHTML=TABS.map(function(x){
    return '<button data-act="tab" data-v="'+x[0]+'" class="'+(cur===x[0]?'on':'')+'"'
      +' aria-label="'+x[1]+'" title="'+x[1]+'"'+(cur===x[0]?' aria-current="page"':'')+'>'+x[2]
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
  h+='<div class="hpair">'
    +'<div class="hcard">'+flw(17)+'<div class="hlab">試験まで</div>'
    +'<div class="hnum'+(dl<=30?' near':'')+'">'+n3(dl)+'<span>日</span></div></div>'
    +'<div class="hcard">'+flw(17)+'<div class="hlab">1日あたり</div>'
    +'<div class="hnum">'+n3(newToday())+'<span>/ '+n3(perday)+'問</span></div></div>'
    +'</div>';
  /* 今日の実績を1行だけ。カードは増やさない（引き算の原則）。
     合計＝その日の回答数／新規＝はじめて解いた数／復習＝残り／正解＝その日の正答率。 */
  /* 新規の数は上の「◯/83」に出ているので書かない。正解率は分析にある。
     ここは「今日の合計と復習」＋「いま何点取れるか」だけ（2026-08-15 本人指摘）。 */
  var dd=ST.days[today()]||{n:0,ok:0},dn=dd.n||0,dnew=dd.newq||0,sc0=scoreNow();
  if(dn||sc0.pts>0)
    h+='<div class="mini" style="text-align:center;margin:-4px 0 10px">'
      +(dn?'今日 '+n3(dn)+'問（復習 '+n3(dn-dnew)+'）　':'')
      +'いま '+sc0.pts.toFixed(1)+' / 50点</div>';
  h+=hdots();
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

  /* ボタンは2つだけ＝「動画を見る」「問題を解く」（2026-08-14 本人指定） */
  var cv=nextVidAll();
  h+='<div class="hbtns">';
  if(cv){
    h+='<a class="btn pri" href="'+vurl(cv,0)+'" target="_blank" rel="noreferrer"'
      +' data-act="vwatch" data-k="'+esc(cv+'#0')+'">'+IC.play+'動画を見る</a>'
      +'<button class="btn" style="margin-top:10px" data-act="startNew">'
      +IC.book+'問題を解く</button>';
  }else{
    h+='<button class="btn pri" data-act="tab" data-v="fields">'+IC.book+'動画学習</button>';
  }
  h+='</div>';
  h+='</div>';
  return h;
}
/* 全部の大分類を学習の順（宅建業法→権利関係→法令→税・その他）にたどって、
   まだ終わっていない主教材の動画を返す。 */
function nextVidAll(){
  var out=null;
  bigsOrdered().some(function(b){
    /* 同じ科目に複数あるので、公開が新しい順（＝2026年版が先）に見る */
    var main=(BIGVIDS[b]||[]).filter(function(v){return VSRC[v]===DEFSRC})
      .sort(function(x,y){return (VUP[y]||'').localeCompare(VUP[x]||'')});
    var v=nextVidOf(main);
    if(v){out=v;return true}
    return false;
  });
  return out;
}
/* まだ終わっていない主教材の動画の本数（1日あたりの本数の分子） */
function vidsLeft(){
  var n=0;
  bigsOrdered().forEach(function(b){
    (BIGVIDS[b]||[]).forEach(function(v){
      if(VSRC[v]!==DEFSRC)return;
      if(!videoStat(v).done)n++;
    });
  });
  return n;
}
/* 今日の流れ＝「直前に終わった問題」「いまの動画」「その動画の問題」の3行 */
/* 今日の流れ＝①いまの科目の動画 ②その科目の未着手（新規） ③抜き打ち。
   主教材が「1本＝1科目」になったので、動画は科目単位・問題は枠ぶんで出す。 */
function flowHtml(){
  var cur=nextVidAll(),pl=plan(),h='<div class="flow">';
  if(cur){
    var big=bigOfVid(cur)||'',watched=!!ST.watched[cur+'#0'];
    h+='<a class="frow'+(watched?' done':' now')+'" href="'+vurl(cur,0)+'" target="_blank" rel="noreferrer"'
      +' data-act="vwatch" data-k="'+esc(cur+'#0')+'">'
      +'<span>'+esc(big||vshort(vlab(cur)||cur))+' の動画</span>'
      +'<span class="fst">'+(watched?'見た':'いま')+'</span></a>';
    /* 次は「その科目の新規を今日の枠ぶん」。こざりえの章は1章＝小分類まるごと
       （100〜344問）なので、章をそのまま1回分にはしない。章を選んで解くのは一覧から。 */
    h+='<button class="frow'+(watched?' now':' yet')+'" data-act="startNew">'
      +'<span>新規</span><span class="fst">'
      +(pl.newOk&&pl.newN?n3(pl.newN)+'問':'動画を見てから')+'</span></button>';
  }
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
function vFields(){
  var h='<div class="pad'+stag()+'"><div class="h">動画学習</div>';
  /* 誰の動画かを先に選ぶ。ここで絞ると、下の一覧はそのチャンネルの動画だけになる。 */
  h+='<div style="margin:0 0 12px">'
    +'<button class="tog'+(S.srcF?'':' on')+'" style="margin:0 6px 6px 0" data-act="srcf" data-v="">すべて</button>'
    +SRCS.map(function(x){
      return '<button class="tog'+(S.srcF===x?' on':'')+'" style="margin:0 6px 6px 0" data-act="srcf" data-v="'
        +esc(x)+'">'+esc(x)+(x===DEFSRC?'（主）':'')+'</button>';}).join('')
    +'</div>';
  h+='<div class="m3-heat">';
  bigsOrdered().forEach(function(b){
    var vids=(BIGVIDS[b]||[]),bp=bigProg(b),open=!!S.openBig[b];
    var mainN=vids.filter(function(v){return VSRC[v]===DEFSRC}).length;
    h+='<div class="bigrow" data-m6k="big:'+esc(b)+'"><button class="t" data-act="big" data-b="'+esc(b)+'">'
      +'<span>'+esc(b)+'</span>'
      +'<span class="cnt">動画 '+mainN+' ／ '+n3(bp.n)+'問</span>'
      +'<span class="ar">'+(open?IC.up:IC.down)+'</span></button>'
      +'<div class="bar3"><i data-m6v="'+(bp.pct/100).toFixed(4)+'" data-m6vk="big:'+esc(b)+'"></i></div></div>';
    if(!open)return;
    var main=[],other=[];
    /* チャンネルで絞る（S.srcF）。指定が無ければ主教材が本編・他は「他のチャンネル」。
       2026-08-15 本人指摘：チャンネルで選べず、題名から誰の動画か察するしかなかった。 */
    vids.forEach(function(v){
      var sc2=VSRC[v];
      if(SRCHIDE[sc2])return;
      if(S.srcF){ (sc2===S.srcF?main:other).push(v); }
      else { (sc2===DEFSRC?main:other).push(v); }
    });
    h+=nextCardHtml(main);          /* 次にやる1本＝主役のカード（全部完了なら出さない） */
    h+=cumRowHtml(b);               /* ここまでで解ける N問（累積で解く入口） */
    h+='<div class="vlist">'+vlistHtml(b,main)+'</div>';
    if(other.length){
      var ok=!!S.openOther[b];
      h+='<div class="vlist"><button class="vrow" data-act="other" data-b="'+esc(b)+'">'
        +'<span class="rc"><span class="no"></span><span class="nm">他のチャンネル</span>'
        +'<span class="n2">'+other.length+'本</span><span class="ar">'+(ok?IC.up:IC.down)+'</span></span></button>'
        +(ok?other.map(vrowHtml).join(''):'')+'</div>';
    }
  });
  h+='</div>';
  /* 章がない小分類（その他の法令など）と、章が付かなかった問題の件数は黙って消さずに出す */
  h+='<div class="panel"><div class="spread"><span class="mini">出題順</span></div>'
    +SORTS.map(function(s){return '<button class="tog'+(S.sort===s[0]?' on':'')+'" style="margin:0 6px 6px 0" data-act="sort" data-s="'+s[0]+'">'+s[1]+'</button>'}).join('');
  /* 下の「基準のチャンネル」は廃止（2026-08-15 本人指摘「意味ない」）。
     チャンネルは一覧の先頭の絞り込み（S.srcF）で選ぶ。基準は主教材で固定。 */
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
  h+='</div>';
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
  var q=vs.done?'':(vs.n===0?'':(vs.ok>0?vs.ok+'/'+vs.n:vs.n+'問'));
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
   対応する問題が0問の動画は完了になりようがないので飛ばす（ここで止まると先へ進めない）。 */
function nextVidOf(vids){
  for(var i=0;i<vids.length;i++){
    var vs=videoStat(vids[i]);
    if(vs.n>0&&!vs.done)return vids[i];
  }
  return null;
}
function nextCardHtml(vids){
  var vid=nextVidOf(vids);
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
    +'data-act="vwatch" data-k="'+esc(vid+'#0')+'">'+IC.play+'動画を見る</a>'
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
function vStudy(){
  var c=S.cat,s=catStat(c);
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
      +IC.play+'動画を見る</a>'
      +'<button class="btn" style="margin-top:8px" data-act="startVid" data-v="'+esc(v.vid)+'"'+(vn?'':' disabled')
      +'>この動画の問題を解く（'+vn+'問）</button>';
    var empty=0;
    list.forEach(function(ch){
      var its=chapItemsUp(v.vid,ch.sec),n=its.length;
      if(!n){empty++;return}                               /* 0問の章は最初から出さない */
      shown++;
      var key=v.vid+'#'+ch.sec,w=ST.watched[key];
      if(w)seen++;
      var ck=v.vid+'|'+ch.sec,op=!!S.openChap[ck];
      /* まだ解いていない数を出す。「37/54」だと残りが何問か分からない（2026-08-15 本人指摘） */
      var rest=chapItemsUp(v.vid,ch.sec).filter(function(it){return att(R(it.id))===0}).length;
      /* 章の開閉は <details>＝JSで開閉しない（開くたびに render() を呼ばない）。
         入場は ::details-content ＋ @starting-style（iOS 18.4+／26.4+ で2回目以降も出る）。
         高さは動かさず、中身のフェード＋4pxだけ（高さを動かすと layout が起きる）。 */
      h+='<details class="m6-det" data-k="'+esc(ck)+'"'+(op?' open':'')+'>'
        +'<summary data-act="openchap" data-k="'+esc(ck)+'">'
        +'<span class="nm">'+esc(ch.label)+' <span class="sec">'+mmss(ch.sec)+'</span>'
        +(w?' <span class="mini num">視聴 '+esc(String(w).slice(5))+'</span>':'')+'</span>'
        +'<span class="badge">'+(rest>0&&rest<n?('残り '+rest):(n+'問'))+'</span>'
        +'<a class="btn sm" href="'+vurl(v.vid,ch.sec)+'" target="_blank" rel="noreferrer" data-act="vwatch" data-k="'+esc(key)+'">'+IC.play+'</a>'
        +'<button class="btn sm" data-act="startChap" data-v="'+esc(v.vid)+'" data-s="'+ch.sec+'" data-l="'+esc(ch.label)+'">'+(rest>0&&rest<n?'残りを解く':'この章だけ解く')+'</button>'
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
    if(empty)h+='<div class="mini" style="margin-top:8px">対応する問題がない章 '+empty+'件（この動画では出しません）</div>';
    /* 動画には問題が紐づいているのに章が1つも出ない＝データの秒がずれている合図（黙って畳まない） */
    if(vn&&empty===list.length&&list.length)
      h+='<div class="warn" style="margin-top:8px">'+IC.warn+' この動画は '+vn+'問 紐づいていますが、'
        +'章の秒数が問題データと一致しないため章ごとに分けられません（データ側の確認が必要）。</div>';
    h+='</div>';
  });
  /* 学習の単位は動画1本なので、動画1本を開いているときは小分類まとめのボタンを出さない */
  if(!S.studyVid)
    h+='<div class="panel"><div class="mini" style="margin-bottom:8px">視聴 '+seen+'/'+shown+'</div>'
      +'<button class="btn '+(shown&&seen===shown?'acc':'pri')+'" data-act="startCat" data-c="'+esc(c)+'">'
        +(s.n-s.att>0&&s.att>0?'残りを解く（'+n3(s.n-s.att)+'問）':'この小分類の問題を解く（'+n3(s.n)+'問）')+'</button>'
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
        var vs=S.roundVid?videoStat(S.roundVid):null,nx=(vs&&vs.done)?nextVid(S.roundVid):null;
        var perfect=(wn===0&&sT>0&&sR===sT);
        setResultBtns(wn,nx,perfect);
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
  h+='<div class="qhead m5-qr'+ac()+'"'+ad(0)+'><div class="qrow">'+flw(16)
    +'<span class="qname">'+esc((chs[0]&&chs[0].label)||it.topic||it.cat)+'</span>'
    +(S.sneak[id]?'<span class="chip">抜き打ち</span>':'')
    +'<span class="sdot s'+STG[stateOf(id)]+' m4-badge" id="stBadge" data-stage="'+STG[stateOf(id)]
    +'" title="'+stateOf(id)+'" aria-label="'+stateOf(id)+'"></span>'
    +'<span class="qcnt"><span class="m6-roll" style="--rh:16px;font-size:12px"'
    +' data-m6id="qprog" data-fmt="'+new Array(String(tot).length+1).join('_')+'" data-m6r="'+(S.qi+1)+'"></span>'
    +' / '+n3(tot)+'</span>'
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
  var showLinks=chs.slice(0,1);
  showLinks.forEach(function(ch){
    h+='<a class="link'+ac()+'" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
      +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'"'+ad(4)+'>'+IC.play
      +'<span class="lbl">'+esc(ch.label)+'</span>'
      +'<span class="tm num">'+mmss(ch.sec)+'</span>'+IC.chev+'</a>';
  });
  if(chs.length>1)
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
      +'<div style="display:flex"><button class="pass" data-act="pass">パス</button></div></div>';
  }else{
    h+='<div class="expwrap'+(EA?' stagexp':'')+'">'+expBlock(it,id)+'</div>';
  }
  h+='<div class="qsp" style="height:20px"></div></div>';
  return h;
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
  if(sp)w.insertBefore(ew,sp);else w.appendChild(ew);
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
  return '<div class="hd"><div class="sc"><b class="scn">'
    +'<span class="m4-num" id="hRight">'+ri+'</span>/'
    +'<span class="m4-num" id="hTotal">'+tot+'</span>問</b>　正解率 <b class="scr">'
    +'<span class="m4-num" id="hRate">'+(tot?rate.toFixed(1)+'%':'—')+'</span></b></div>'
    +'<div class="combow">'+cw+'</div>'
    +'<button class="rst" data-act="rsess">リセット</button></div>'
    +'<div class="bar"><i id="hBar" style="transform:scaleX('+PROGPREV.toFixed(4)+')"></i>'
    +'<span class="m4-tip" id="hTip" style="left:'+(PROGPREV*100).toFixed(1)+'%"></span></div>';
}
var PROGPREV=0,PROGNEW=0;
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
  h+='<div class="exp">'+(it.exp?esc(it.exp):'<span class="mini">解説データがありません。</span>')+'</div>';
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
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.play+'この章の動画を '+mmss(ch.sec)+' から見る</a>';
    }
  }
  /* 抜き打ちで間違えたら「この分野は怪しい」＋その章のタイムスタンプへ（自分で見に行く導線） */
  if(!res.ok&&S.sneak[id]){
    var ch2=chapFor(it);
    h+='<div class="warn" style="margin-top:10px">'+IC.warn+' この分野は怪しい'
      +(ch2?'<a class="link" style="margin-top:6px;color:#a33a2f" href="'+vurl(ch2.vid,ch2.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch2.vid+'#'+ch2.sec)+'"><span class="lbl">'+esc(ch2.label)+'</span>'
        +'<span class="tm num">'+mmss(ch2.sec)+' から見る</span>'+IC.chev+'</a>':'')+'</div>';
  }
  h+=boxMeterHtml(r);      /* 休ませる段が動く（M4：進む＝Ease Out／戻る＝Ease In） */
  var sv=severeTopics().filter(function(x){return x.cat===it.cat&&x.topic===(it.topic||'未分類')})[0];
  if(sv)h+='<div class="warn" style="margin-top:10px">'+IC.warn+' 重症：この章は動画に戻る（'+esc(sv.topic)+'／誤答'+sv.ng+'回）</div>';
  h+='<button class="btn pri" style="margin-top:12px" data-act="next">次の問題</button>';
  return h;
}
/* 完走リザルトのボタンの出し分け（2026-08-14 本人の指示）
   ・全問正解（perfect）＝「もう一度この範囲を解く」は出さない
   ・間違いが残っている＝「間違えた N問を解く」が最上段（主役）。0になるまで周回する
   ・0になったときだけ「次の動画へ」を主役にする（この動画を仕上げた合図）
   ・「ホームへ戻る」は置かない（下部タブがある） */
function setResultBtns(wn,nx,perfect){
  var rb=document.getElementById('r-round'),nb=document.getElementById('r-next'),
      ag=document.getElementById('r-again');
  if(rb){rb.hidden=!wn;if(wn)rb.textContent='間違えた '+n3(wn)+'問を解く'}
  if(nb){nb.hidden=!nx;if(nx){nb.setAttribute('data-v',nx.vid);nb.className=wn?'pri':'acc'}}
  /* パスで解き残しがあるときだけ「もう一度この範囲を解く」を残す
     （全問正解なら不要、間違いがあるなら上の「間違えた…」がその役目） */
  if(ag)ag.hidden=(wn>0||perfect);
}
function vDone(){
  var tot=S.queue.length,nw=S.wrongs.length,sT=S.sT||0,sR=S.sR||0;
  var vs=S.roundVid?videoStat(S.roundVid):null;
  var nx=(vs&&vs.done)?nextVid(S.roundVid):null;
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
  if(nx)h+='<button class="btn '+(nw?'':'acc')+'" style="margin-top:10px" data-act="nextvid" data-v="'+esc(nx.vid)+'">次の動画へ</button>';
  h+='<div class="hr"></div>';
  /* 全問正解なら「もう一度」は出さない。ホームへ戻るボタンは下部タブで代用するので置かない。 */
  if(!nw&&!perfect)h+='<button class="btn" data-act="again">もう一度この範囲を解く</button>';
  h+='<button class="btn" style="margin-top:8px" data-act="tab" data-v="fields">別の分野を選ぶ</button>'
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
    h+='<div class="li"'+(pv?' data-m6pv="'+esc(pv)+'"':'')+'><div class="nm"><b>'+esc(x.topic)+'</b><div class="mini">'+esc(x.cat)+' ／ '+x.ids.length+' / '+x.att+'問ミス（'+Math.round(x.rate*100)+'%） ／ 誤答'+x.ng+'回 — この章は動画に戻る</div></div>'
      +(ch?'<a class="btn sm" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.play+mmss(ch.sec)+' から</a>':'')
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
/* ①今受けたら何点＝大分類の正解率 × 本試験の出題数
   ・1問しか解いていない分野の正解率で点数を出すと誤解を招くので、
     各大分類で MINQ 問（10問）解くまでは推定に入れない（「測定中 3/10問」と出す）。
   ・1分野も10問に達していなければ点数そのものを出さない（pts=null＝画面は「—」）。 */
var MINQ=10;
/* 「いま確実に取れると言える点数」（2026-08-15 本人指摘で作り直し）。
   旧：その分野を10問解いたら、配点20点ぶんを正答率で丸ごと推定していた。
       宅建業法を37問（2,016肢中1.8%）解いただけで「20点満点ぶん」を見積もるのは無理がある。
   新：**配点 × その分野の消化率 × 直近の正答率**。未着手のぶんは0点として数える。
       だから進めば増える。分母は本試験と同じ50点で固定する。 */
function scoreNow(){
  var pts=0,covered=0,done=[];
  BIGS.forEach(function(b){
    var s=bigStat(b);
    if(!s.n)return;
    var cov=s.att/s.n;                                  /* その分野をどれだけ見たか */
    var rate=(s.nowRate===null)?0:s.nowRate;
    pts+=s.q*cov*rate;
    covered+=s.q*cov;
    if(s.att>0)done.push({big:b,q:s.q,att:s.att,n:s.n,cov:cov,rate:rate});
  });
  done.sort(function(x,y){return y.q*y.cov*y.rate-x.q*x.cov*x.rate});
  return {pts:pts,covered:covered,done:done,total:50};
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
     10問未満の分野は推定に入れない。どこも10問に達していなければ点数は「—」（1問で「14.0点」と出さない）。 */
  var hasPts=true,diff=sc.pts-PASS_LINE;
  h+='<div class="panel">'
    +'<div class="spread" style="align-items:flex-end;margin-bottom:8px">'
    +'<div><span class="score">'+sc.pts.toFixed(1)+'</span>'
    +'<span class="mini num"> / 50</span></div>'
    +'<div class="mini">いま確実に取れる点数</div></div>'
    /* ゲージは50点の目盛りのまま。測定できた配点まで色を塗り、その中の得点を濃く出す。
       未測定のぶんを「取れる」ように見せない（2026-08-14 本人指摘の修正）。 */
    +'<div class="gauge"><i style="width:'+(sc.pts/50*100).toFixed(1)+'%"></i>'
    +'<span class="gmeas" style="left:'+((sc.covered||0)/50*100).toFixed(1)+'%"></span>'
    +'<span class="gline" style="left:'+(PASS_LINE/50*100).toFixed(1)+'%"></span></div>'
    +'<div class="spread" style="margin-top:4px"><span class="mini num">0</span>'
    +'<span class="mini num">'+PASS_LINE+'</span><span class="mini num">50</span></div>'
    +'<div class="mini" style="margin-top:6px">配点 × 解いた割合 × 直近の正答率。'
    +'まだ解いていない問題は0点として数えます</div>'
    +(sc.done.length?'<div class="mini" style="margin-top:4px">'
      +sc.done.slice(0,4).map(function(d){
        return esc(d.big)+' '+(d.q*d.cov*d.rate).toFixed(1)+'点（'+n3(d.att)+'/'+n3(d.n)+'問・'
          +Math.round(d.rate*100)+'%）'}).join('<br>')+'</div>':'');
  /* 「測定中 n/10問」は③（失点ランキングの下）に1行でまとめて出すので、ここには出さない
     ＝同じ情報を同一画面に2回出さない（SPEC §5-1 引き算の原則）。ここは未測定の分野名だけ。 */
  /* 未測定の分野名はここには出さない。上の「配点×解いた割合×正答率」の内訳で
     どこがどれだけ進んでいるかが分かるため（2026-08-15 引き算）。 */
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
  /* ①と同じ下限＝その大分類で MINQ（10問）以上解いていない分野はランキングに出さない。
     1問の誤答で「権利関係 −14.0」と出るのは①の「1問で14.0点」と同じ誤解を招くため。
     10問未満の分野は、ランキングの下に1行でまとめて「測定中 …4/10問」と出す。 */
  var lossAll=BIGS.map(function(b){
    var s=bigStat(b),a=s.ok+s.ng,wr=a?s.ng/a:null;
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
  tp.sort(function(a,b){return b.wr-a.wr}).slice(0,10);
  h+='<div class="panel">';
  if(!tp.length)h+='<div class="mini">3問以上解いた章がまだありません</div>';
  tp.sort(function(a,b){return b.wr-a.wr}).slice(0,10).forEach(function(x){
    var ch=x.it?chapFor(x.it):null;
    h+='<div class="li"><div class="nm">'+esc(x.t)+'<div class="mini">'+esc(x.c)+'</div></div>'
      +'<span class="mini num">'+(x.wr*100).toFixed(0)+'%</span>'
      +(ch?'<a class="btn sm" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.play+mmss(ch.sec)+'</a>':'')+'</div>';
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
function dataSheet(){
  var m=document.getElementById('modal');
  var json=JSON.stringify(ST);
  var lv=fxLevel();
  var lvs=[['auto','デフォルト（3段階）'],['strong','強'],['weak','弱'],['off','なし']];
  m.innerHTML='<div class="sheet">'
   +'<div class="spread" style="margin-bottom:10px"><div class="h" style="margin:0">設定とデータ</div>'
   +'<button class="btn sm" data-act="closeModal">'+IC.close+'閉じる</button></div>'
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
      var body={message:'宅建の記録 '+nowStamp(),content:b64(JSON.stringify(ST))};
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
function ghFP(){
  var s2=JSON.stringify(ST.items||{}),h=5381;
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
  var json=JSON.stringify(ST),name='takken_'+today()+'.json';
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
  S.res=answer(id,userOx);S.phase='exp';
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
  playFx(S.res.ok,S.tier);
}
/* 「次の問題」＝今のカードを上へ8pxフェードアウト（0.16s）→ 次のカードが下から入る */
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
  S.qi++;S.phase='q';S.res=null;S.broke=false;
  if(S.qi>=S.queue.length){
    /* 完走。間違いが残っていなくて動画を仕上げていたら「この動画は完了」を記録する */
    if(!S.wrongs.length&&S.roundVid){
      var vp2=vpOf(S.roundVid);
      if(videoStat(S.roundVid).done&&!vp2.completedAt)vp2.completedAt=today();
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
  if(a==='cat'){S.studyVid=null;m1ToStudy(t,t.getAttribute('data-c'));return}
  /* 一覧の動画の行＝その動画1本の画面（章と問題）へ */
  if(a==='vid'){
    var tv=t.getAttribute('data-v'),tc=catOfVid(tv);
    if(!tc)return;
    S.studyVid=tv;m1ToStudy(t,tc);return;
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
  if(a==='next'){next();return}
  if(a==='why'){applyWhy(t.getAttribute('data-id'),t.getAttribute('data-w'));render();return}
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
  if(a==='gobig'){var gb=t.getAttribute('data-b');S.openBig={};S.openBig[gb]=true;go('fields');return}
  /* 新規は「デフォルト」の出題順（need_seq 昇順→章の秒数→難易度）で解く。
     need_seq が無い古いデータのときだけ従来の「章のタイムライン順」に落とす。 */
  if(a==='startNew'){S.round=0;S.kind='new';S.sort=NEEDOK?'std':'timeline';startQueue(newQueue(plan().newN),'新規',false);return}
  if(a==='startSneak'){
    if(sneakDone()){msg&&msg('今日の抜き打ちは終わっています');return}
    S.round=0;S.kind='sneak';var sq=plan().sneak;
    if(!sq.length)return;
    var d=ST.days[today()]||{n:0,ok:0};d.sneak=1;ST.days[today()]=d;saveST();  /* 1日1回の印 */
    startQueue(sq,'抜き打ち',false,null,true);
    sq.forEach(function(it){S.sneak[it.id]=true});   /* 画面に「抜き打ち」の印を出す */
    render();return;
  }
  if(a==='startWrong'){S.round=0;S.kind='review';startQueue(wrongToday(),'今日の間違い',false);return}
  if(a==='startWrongAll'){S.round=0;S.kind='review';startQueue(wrongPool(),'間違い',false);return}
  if(a==='startWrongBig'){
    var wbg=t.getAttribute('data-b');
    S.round=0;S.kind='review';startQueue(wrongPool().filter(function(it){return it.big===wbg}),wbg+' の間違い',false);return;
  }
  if(a==='startFilter'){S.kind='review';startQueue(filtered(),'絞り込み');return}
  if(a==='startSel'){S.kind='new';startQueue(selItems(),'選択範囲');return}
  if(a==='startAll'){S.kind='new';startQueue(ITEMS,'全範囲');return}
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
    S.kind='new';m1ToQuiz(t,function(){startQueue(restOnly(itemsOfCat(cc)),cc)});return;
  }
  if(a==='startTopic'){
    var c3=t.getAttribute('data-c'),t3=t.getAttribute('data-t');
    S.kind='review';m1ToQuiz(t,function(){startQueue(itemsOfTopic(c3,t3||'未分類'),t3||'未分類')});return;
  }
  /* 動画単位でまとめて解く＝その動画の章の秒数の昇順（基準の動画＝この動画） */
  if(a==='startVid'){
    var vv=t.getAttribute('data-v');
    m1ToQuiz(t,function(){
      S.sort='timeline';S.round=0;S.kind='new';S.roundVid=vv;
      startQueue(restOnly(videoItemsUp(vv)),VTIT[vv]||vv,true,vv);   /* 未着手だけ */
    });return;
  }
  /* 間違い直しの周回（間隔なし・当日中・全問正解するまで） */
  if(a==='round'){
    if(!S.wrongs.length)return;
    S.kind='review';                                 /* 間違い直しの時間は「復習」に積む */
    S.round=(S.round||0)+1;
    if(S.roundVid){var vp=vpOf(S.roundVid);vp.round=S.round;saveST()}
    startQueue(S.wrongs.map(function(i){return BY[i]}).filter(Boolean),'間違い直し '+S.round+'周目',false,S.baseVid);
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
    startQueue(videoItemsUp(nv),VTIT[nv]||nv,true,nv);
    return;
  }
  if(a==='startChap'){
    var cv=t.getAttribute('data-v'),cs2=+t.getAttribute('data-s'),cl=t.getAttribute('data-l');
    /* 未着手だけを出す。37/54 の章で「もう一度37問」から始まるのは無駄
       （2026-08-15 本人指摘）。全部やり直したいときは復習の絞り込みから。 */
    S.kind='new';m1ToQuiz(t,function(){startQueue(restOnly(chapItemsUp(cv,cs2)),cl||'章',true,cv)});return;
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
    ST=normST(o);saveST();msg('読み込みました（'+Object.keys(ST.items).length+'問）。');render();return;
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
  /* 難易度3段階（検証用）と1本目の動画 */
  d3:d3,d3Rank:d3Rank,d3Hard:d3Hard,D3:D3,dotsHtml:dotsHtml,MINQ:MINQ,bigStat:bigStat,
  firstVid:firstVid,catOfVid:catOfVid,sneakSort:sneakSort,
  doAnswer:doAnswer,next:next,advance:advance,playFx:playFx,clearFx:clearFx,fxLevel:fxLevel,FXST:FXST,
  pickTier:pickTier,FXDUR:FXDUR,itemsOfTopic:itemsOfTopic,att:att,R:R,mk:mk,
  saveRun:saveRun,dropRun:dropRun,hasRun:hasRun,resumeRun:resumeRun,
  secOf:secOf,sortQ:sortQ,SORTS:SORTS,TABS:TABS,
  /* 動画の紐づけ（検証用） */
  vidsOf:vidsOf,videoItems:videoItems,chapItems:chapItems,chapsOf:chapsOf,chapsFor:chapsFor,
  chapFor:chapFor,whyOf:whyOf,secIn:secIn,NOVID:NOVID,VIDIDS:VIDIDS,CHIDS:CHIDS,
  VSRC:VSRC,VTIT:VTIT,SRCS:SRCS,CHAP:CHAP,CINFO:CINFO,CATS:CATS,itemsOfCat:itemsOfCat,
  save:saveST,load:function(){ST=loadST();render()},BOXD:BOXD,addD:addD,today:today,
  /* 動画の通し番号・既習範囲（検証用） */
  NEEDOK:NEEDOK,SEQV:SEQV,seqOfVid:seqOfVid,needSeq:needSeq,nsRank:nsRank,
  watchedMaxSeq:watchedMaxSeq,seqCap:seqCap,inRange:inRange,newAvail:newAvail,
  videoItemsUp:videoItemsUp,chapItemsUp:chapItemsUp,
  /* 一覧（大分類→動画の再生リスト順）と実測時間（検証用） */
  BIGLEARN:BIGLEARN,BIGVIDS:BIGVIDS,VBIG:VBIG,bigsOrdered:bigsOrdered,bigProg:bigProg,
  vno:vno,vlabel:vlabel,vlab:vlab,VLAB:VLAB,VNOC:VNOC,vshort:vshort,vrowHtml:vrowHtml,
  nextVidOf:nextVidOf,nextCardHtml:nextCardHtml,vlistHtml:vlistHtml,cumItems:cumItems,VCHN:VCHN,
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
   +(why.length?'<div class="mini" style="margin-top:6px">根拠 '+esc(why.join('・'))+'</div>':'')
   +(chs.length?'<div class="hr"></div>'+chs.map(function(ch){
       return '<a class="link" href="'+vurl(ch.vid,ch.sec)+'" target="_blank" rel="noreferrer"'
        +' data-act="vwatch" data-k="'+esc(ch.vid+'#'+ch.sec)+'">'+IC.play
        +'<span class="lbl">'+esc(ch.label)+(ch.src?'（'+esc(ch.src)+'）':'')+'</span>'
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
/* 章の開閉（<details>）＝JSで開閉しない。開いた状態だけ S.openChap に写して再描画に耐えさせる */
document.addEventListener('toggle',function(e){
  var d=e.target;
  if(!d||!d.classList||!d.classList.contains('m6-det'))return;
  var k=d.getAttribute('data-k');
  if(k)S.openChap[k]=d.open;
},true);

/* ---------- 起動 ---------- */
askPersist();                                /* 記録を消されないように永続化を要求（未対応環境では何もしない） */
m3Init();                                    /* 3層の生成とスクロール視差 */
M2.setSound(!!(ST.settings&&ST.settings.sound));
/* 押した感は委譲で当てる（innerHTML で作り直しても消えない）。
   問題のカードは押すものではないので入れない（触ったときの動きは M3 の傾きだけ） */
M2.delegate('[data-act],.cell,.b,.tog,.cb,.tapline,#tabs button');
render();
/* 起動の区切り。初回だけ長め（0.77秒）、2回目以降は0.39秒（毎回長い演出を強制しない） */
var m5first=!(ST.settings&&ST.settings.launched);
if(ST.settings){ST.settings.launched=true;saveST()}
M5.playIntro(m5first);
